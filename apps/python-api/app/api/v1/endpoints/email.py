"""
Email Endpoints — API routes สำหรับ Email Writer และ Email Sender
"""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.schemas.email import (
    GenerateEmailRequest,
    GenerateEmailResponse,
    GenerateABResponse,
    SubjectSuggestionsRequest,
    SubjectSuggestionsResponse,
    SendEmailRequest,
    SendResult,
    BatchSendRequest,
    BatchSendResponse,
)
from app.services.email_writer import email_writer
from app.services.email_sender import email_sender

logger = logging.getLogger(__name__)
router = APIRouter()


def _lead_data_from_request(req: GenerateEmailRequest) -> dict[str, Any]:
    """แปลง GenerateEmailRequest เป็น lead_data dict"""
    return {
        "lead_name": req.lead_name,
        "name": req.lead_name,
        "business_name": req.business_name,
        "email": req.email,
        "category": req.category,
        "location": req.location,
        "rating": req.rating,
        "score": req.score,
    }


@router.post(
    "/email/generate",
    response_model=GenerateEmailResponse,
    summary="สร้าง personalized email draft",
    description="ใช้ Claude claude-sonnet-4-6 เขียน cold email outreach จาก lead data",
)
async def generate_email(req: GenerateEmailRequest) -> GenerateEmailResponse:
    """
    สร้าง personalized email draft จาก lead data

    - **tone**: formal | friendly | casual
    - **language**: th | en
    - **template_category**: หมวดหมู่ธุรกิจ เช่น restaurant, hotel
    """
    lead_data = _lead_data_from_request(req)

    draft = await email_writer.generate_email(
        lead_data=lead_data,
        template_category=req.template_category,
        tone=req.tone,
        language=req.language,
    )

    return GenerateEmailResponse(draft=draft)


@router.post(
    "/email/generate-ab",
    response_model=GenerateABResponse,
    summary="สร้าง A/B email variants",
    description="สร้าง 2 email versions ที่แตกต่างกันสำหรับ A/B testing",
)
async def generate_ab_variants(req: GenerateEmailRequest) -> GenerateABResponse:
    """
    สร้าง 2 email variants สำหรับ A/B testing

    - **Variant A**: เน้น value proposition
    - **Variant B**: เน้น social proof / urgency
    """
    lead_data = _lead_data_from_request(req)

    variant_a, variant_b = await email_writer.generate_ab_variants(
        lead_data=lead_data,
        template_category=req.template_category,
        tone=req.tone,
        language=req.language,
    )

    return GenerateABResponse(variant_a=variant_a, variant_b=variant_b)


@router.post(
    "/email/suggest-subjects",
    response_model=SubjectSuggestionsResponse,
    summary="แนะนำ subject lines",
    description="Claude แนะนำ subject lines สำหรับ email outreach",
)
async def suggest_subject_lines(req: SubjectSuggestionsRequest) -> SubjectSuggestionsResponse:
    """
    แนะนำ subject lines จาก Claude

    - **count**: จำนวน suggestions (default 3, max 10)
    - **language**: th | en
    """
    count = min(max(req.count, 1), 10)  # clamp 1-10

    lead_data = {
        "name": req.lead_name,
        "lead_name": req.lead_name,
        "business_name": req.business_name,
        "category": req.category,
        "location": req.location,
    }

    subjects = await email_writer.suggest_subject_lines(
        lead_data=lead_data,
        count=count,
        language=req.language,
    )

    return SubjectSuggestionsResponse(subjects=subjects)


@router.post(
    "/email/send",
    response_model=SendResult,
    summary="ส่ง email เดียวผ่าน Resend",
    description="ส่ง single email ผ่าน Resend API",
)
async def send_email(req: SendEmailRequest) -> SendResult:
    """
    ส่ง email เดียวผ่าน Resend API

    - **from_email**: เช่น "LeadFlow <hello@yourdomain.com>"
    - **to_email**: อีเมลผู้รับ
    - **reply_to**: Reply-to address (optional)
    """
    if not req.from_email or not req.to_email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="from_email และ to_email ต้องระบุ",
        )

    result = await email_sender.send_email(
        from_email=req.from_email,
        to_email=req.to_email,
        subject=req.subject,
        html_body=req.html_body,
        text_body=req.text_body,
        reply_to=req.reply_to,
        tags=req.tags,
    )

    return result


@router.post(
    "/email/send-batch",
    response_model=BatchSendResponse,
    summary="ส่ง email แบบ batch",
    description="ส่ง email หลายรายการพร้อมกัน (max 100 per batch)",
)
async def send_batch_emails(req: BatchSendRequest) -> BatchSendResponse:
    """
    ส่ง email หลายรายการพร้อมกัน

    - Max 100 emails per batch (Resend limit)
    - ใช้ asyncio.gather + Semaphore(10) จำกัด concurrent requests
    """
    if not req.emails:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="ต้องมี emails อย่างน้อย 1 รายการ",
        )

    if len(req.emails) > 100:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"ส่งได้สูงสุด 100 emails ต่อ batch (ส่งมา {len(req.emails)})",
        )

    emails_payload = [
        {
            "from_email": e.from_email,
            "to_email": e.to_email,
            "subject": e.subject,
            "html_body": e.html_body,
            "text_body": e.text_body,
            "reply_to": e.reply_to,
            "tags": e.tags,
        }
        for e in req.emails
    ]

    results = await email_sender.send_batch(emails_payload)

    total = len(results)
    sent = sum(1 for r in results if r.status == "sent")
    failed = total - sent

    logger.info("Batch send complete | total=%d | sent=%d | failed=%d", total, sent, failed)

    return BatchSendResponse(
        results=results,
        total=total,
        sent=sent,
        failed=failed,
    )
