/**
 * Template Variable System
 * รองรับ syntax: {{variable_name}}
 * ใช้สำหรับ email templates ทั้งใน subject และ body
 */

export const AVAILABLE_VARIABLES = [
  { name: 'business_name', label: 'ชื่อธุรกิจ' },
  { name: 'first_name',    label: 'ชื่อ' },
  { name: 'location',      label: 'ที่อยู่' },
  { name: 'category',      label: 'หมวดหมู่' },
  { name: 'email',         label: 'อีเมล' },
  { name: 'phone',         label: 'เบอร์โทร' },
  { name: 'website',       label: 'เว็บไซต์' },
] as const

export type VariableName = (typeof AVAILABLE_VARIABLES)[number]['name']

/** Regex จับ {{variable_name}} — รองรับ space รอบชื่อ */
const VARIABLE_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g

/**
 * แทนที่ตัวแปรทั้งหมดใน template string ด้วยค่าจาก data
 * ตัวแปรที่ไม่มีใน data จะถูกแทนที่ด้วย string ว่าง
 *
 * @example
 * replaceVariables('สวัสดี {{business_name}}', { business_name: 'ร้านอาหารA' })
 * // => 'สวัสดี ร้านอาหารA'
 */
export function replaceVariables(template: string, data: Record<string, string>): string {
  return template.replace(VARIABLE_REGEX, (_match, varName: string) => {
    return data[varName] ?? ''
  })
}

/**
 * ดึงชื่อตัวแปรทั้งหมดที่ใช้ใน template (unique, ไม่ซ้ำ)
 *
 * @example
 * extractVariables('สวัสดี {{business_name}} จาก {{location}}')
 * // => ['business_name', 'location']
 */
export function extractVariables(template: string): string[] {
  const matches = new Set<string>()
  let match: RegExpExecArray | null

  // Reset lastIndex ก่อน loop เพื่อความปลอดภัย
  VARIABLE_REGEX.lastIndex = 0

  while ((match = VARIABLE_REGEX.exec(template)) !== null) {
    matches.add(match[1].trim())
  }

  // Reset อีกครั้งหลัง loop เพราะ regex มี global flag
  VARIABLE_REGEX.lastIndex = 0

  return Array.from(matches)
}

/**
 * ตรวจสอบว่าตัวแปรใน template ทั้งหมดมีค่าใน data หรือไม่
 * คืนค่า array ของตัวแปรที่ยังขาด
 */
export function findMissingVariables(
  template: string,
  data: Record<string, string>,
): string[] {
  const vars = extractVariables(template)
  return vars.filter((v) => !(v in data) || data[v] === '')
}
