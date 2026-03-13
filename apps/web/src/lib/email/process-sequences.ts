/**
 * Sequence Processing Engine
 * ประมวลผล enrollments ที่ active ทั้งหมด — ส่งอีเมลตาม step และ delay
 * เรียกจาก cron job ทุก 15–30 นาที
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { replaceVariables } from '@/lib/email/template-variables'

const PYTHON_API_URL = process.env.PYTHON_API_URL ?? 'http://localhost:8000'
const DEFAULT_FROM_EMAIL =
  process.env.DEFAULT_FROM_EMAIL ?? process.env.EMAIL_FROM ?? 'noreply@leadflow.app'

export interface ProcessSequencesResult {
  processed: number
  sent: number
  completed: number
  errors: number
}

/**
 * ประมวลผล enrollments ทั้งหมดที่มี status = 'active'
 * - ถ้ายังไม่ถึงเวลา delay → ข้ามไป
 * - ถ้าไม่มี step ถัดไป → mark completed
 * - ถ้ามี step และถึงเวลาแล้ว → ส่งอีเมล + อัพเดท enrollment
 */
export async function processSequences(): Promise<ProcessSequencesResult> {
  const supabase = createAdminClient()
  let processed = 0,
    sent = 0,
    completed = 0,
    errors = 0

  // โหลด enrollments ที่ active พร้อม sequence และ lead info
  const { data: enrollments, error: enrollErr } = await supabase
    .from('sequence_enrollments')
    .select(
      `
      id, sequence_id, lead_id, current_step, status, enrolled_at, last_step_at,
      sequences ( id, workspace_id, status ),
      leads ( id, name, email, phone, website, address, category )
    `,
    )
    .eq('status', 'active')

  if (enrollErr) {
    console.error('[process-sequences] Failed to load enrollments:', enrollErr)
    return { processed: 0, sent: 0, completed: 0, errors: 1 }
  }

  if (!enrollments || enrollments.length === 0) {
    return { processed: 0, sent: 0, completed: 0, errors: 0 }
  }

  for (const enrollment of enrollments) {
    try {
      processed++

      const seq = enrollment.sequences as any
      const lead = enrollment.leads as any

      // ข้ามถ้า sequence ไม่ active หรือ lead ไม่มีอีเมล
      if (!seq || seq.status !== 'active') continue
      if (!lead?.email) continue

      // คำนวณ step ที่ต้องส่ง:
      // - last_step_at = null → ยังไม่เคยส่งเลย → ส่ง step ที่ current_step (= 1 จาก enrollLeads)
      // - last_step_at มีค่า → step ที่แล้วส่งแล้ว → ส่ง current_step + 1
      const stepToSend = enrollment.last_step_at
        ? (enrollment.current_step ?? 0) + 1
        : (enrollment.current_step ?? 1)

      // โหลด step ที่ต้องส่ง
      const { data: step } = await supabase
        .from('sequence_steps')
        .select('id, step_number, delay_days, template_id, condition')
        .eq('sequence_id', enrollment.sequence_id)
        .eq('step_number', stepToSend)
        .single()

      if (!step) {
        // ไม่มี step ถัดไปแล้ว → mark completed
        await supabase
          .from('sequence_enrollments')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', enrollment.id)
        completed++
        continue
      }

      // ตรวจสอบ delay — นับจาก last_step_at ถ้าเคยส่งแล้ว ไม่งั้นนับจาก enrolled_at
      const referenceTime = enrollment.last_step_at
        ? new Date(enrollment.last_step_at)
        : new Date(enrollment.enrolled_at)
      const delayMs = (step.delay_days ?? 0) * 24 * 60 * 60 * 1000
      const sendAfter = new Date(referenceTime.getTime() + delayMs)

      if (new Date() < sendAfter) {
        // ยังไม่ถึงเวลา
        continue
      }

      // โหลด email template
      const { data: template } = await supabase
        .from('email_templates')
        .select('id, subject, body_html, body_text')
        .eq('id', step.template_id)
        .single()

      if (!template) {
        console.error(`[process-sequences] Template not found: ${step.template_id}`)
        errors++
        continue
      }

      // Build variable data สำหรับแทนที่ใน template
      const varData: Record<string, string> = {
        business_name: lead.name ?? '',
        first_name: lead.name?.split(' ')[0] ?? '',
        location: lead.address ?? '',
        category: lead.category ?? '',
        email: lead.email ?? '',
        phone: lead.phone ?? '',
        website: lead.website ?? '',
      }

      const subject = replaceVariables(template.subject, varData)
      const bodyHtml = replaceVariables(template.body_html, varData)
      const bodyText = template.body_text
        ? replaceVariables(template.body_text, varData)
        : undefined

      // ส่งอีเมลผ่าน Python API
      const res = await fetch(`${PYTHON_API_URL}/api/v1/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_email: DEFAULT_FROM_EMAIL,
          to_email: lead.email,
          subject,
          html_body: bodyHtml,
          body_text: bodyText,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        console.error(
          `[process-sequences] Send failed for enrollment ${enrollment.id}:`,
          text,
        )
        errors++
        continue
      }

      const { message_id } = await res.json()

      // ตรวจว่า step นี้เป็น step สุดท้ายหรือไม่
      const isLastStep = await checkIsLastStep(supabase, enrollment.sequence_id, stepToSend)

      // อัพเดท enrollment
      await supabase
        .from('sequence_enrollments')
        .update({
          current_step: stepToSend,
          last_step_at: new Date().toISOString(),
          ...(isLastStep
            ? { status: 'completed', completed_at: new Date().toISOString() }
            : {}),
        })
        .eq('id', enrollment.id)

      // บันทึก email event
      await supabase.from('email_events').insert({
        workspace_id: seq.workspace_id,
        lead_id: lead.id,
        sequence_id: enrollment.sequence_id,
        event_type: 'sent',
        message_id: message_id,
        metadata: { enrollment_id: enrollment.id, step_number: stepToSend },
      })

      sent++
      if (isLastStep) completed++
    } catch (err) {
      console.error(
        `[process-sequences] Error processing enrollment ${enrollment.id}:`,
        err,
      )
      errors++
    }
  }

  return { processed, sent, completed, errors }
}

/**
 * ตรวจสอบว่า currentStep เป็น step สุดท้ายของ sequence นี้หรือไม่
 * โดยนับ steps ที่มี step_number > currentStep
 */
async function checkIsLastStep(
  supabase: ReturnType<typeof createAdminClient>,
  sequenceId: string,
  currentStep: number,
): Promise<boolean> {
  const { count } = await supabase
    .from('sequence_steps')
    .select('id', { count: 'exact', head: true })
    .eq('sequence_id', sequenceId)
    .gt('step_number', currentStep)

  return (count ?? 0) === 0
}
