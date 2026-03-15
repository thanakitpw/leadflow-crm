"""
Scoring Endpoints — Claude Lead Scoring
POST /api/v1/scoring/score
POST /api/v1/scoring/score-batch
"""

import asyncio
import logging
import uuid

from fastapi import APIRouter, HTTPException, status

from app.schemas.scoring import (
    ScoreBatchRequest,
    ScoreBatchResponse,
    ScoreLeadRequest,
    ScoreLeadResponse,
    ScoreResult,
)
from app.services.scorer import score_lead, score_leads_batch
from app.services import lead_score_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scoring", tags=["Scoring"])


def _is_uuid(value: str) -> bool:
    """ตรวจว่า string เป็น UUID หรือไม่"""
    try:
        uuid.UUID(value)
        return True
    except (ValueError, AttributeError):
        return False


def _lead_to_dict(lead) -> dict:
    """แปลง LeadForScoring Pydantic model → dict สำหรับ scorer service"""
    return {
        "id": lead.id,
        "name": lead.name,
        "business_name": lead.name,  # scorer รองรับทั้งสอง key
        "rating": lead.rating,
        "review_count": lead.review_count,
        "reviews_count": lead.review_count,  # backward compat
        "website": lead.website,
        "email": lead.email,
        "phone": lead.phone,
        "category": lead.category,
        "address": lead.address,
    }


@router.post(
    "/score",
    response_model=ScoreLeadResponse,
    status_code=status.HTTP_200_OK,
    summary="ให้คะแนน lead เดียว",
    description=(
        "ใช้ Claude AI (claude-sonnet-4-6) วิเคราะห์คุณภาพ lead และให้คะแนน 0-100\n\n"
        "**เกณฑ์การให้คะแนน:**\n"
        "- มี Website: +15 คะแนน\n"
        "- มี Email: +10 คะแนน\n"
        "- Google Rating 4.5+: +20 | 4.0-4.4: +15 | 3.5-3.9: +10\n"
        "- Reviews 100+: +15 | 50-100: +10 | 10-49: +7\n"
        "- Category ตรงเป้า: +10 คะแนน\n"
        "- มีเบอร์โทร: +5 | ที่อยู่ชัดเจน: +5\n"
        "- ดุลยพินิจ AI: +20 คะแนน\n\n"
        "**หมายเหตุ:** ถ้าไม่มี ANTHROPIC_API_KEY จะ return score = 50"
    ),
)
async def score_single_lead(request: ScoreLeadRequest) -> ScoreLeadResponse:
    """
    ให้คะแนน lead เดียวด้วย Claude AI

    - Model: claude-sonnet-4-6
    - คะแนน 0-100 พร้อม reasoning ภาษาไทย
    - ถ้าไม่มี API key → score = 50, reasoning = "ไม่มี API key สำหรับ AI scoring"
    """
    lead = request.lead
    logger.info(f"Scoring lead: {lead.name} (id={lead.id})")

    try:
        lead_dict = _lead_to_dict(lead)
        raw_result = await score_lead(lead_dict)

        result = ScoreResult(
            lead_id=lead.id,
            score=raw_result["score"],
            reasoning=raw_result["reasoning"],
        )

        # บันทึก score ลง Supabase (เฉพาะเมื่อ lead_id เป็น UUID จริง)
        if not raw_result.get("error") and _is_uuid(lead.id):
            await lead_score_store.save_score(
                lead_id=lead.id,
                score=raw_result["score"],
                reasoning=raw_result["reasoning"],
            )

        return ScoreLeadResponse(result=result)

    except Exception as e:
        logger.error(f"Unexpected error scoring lead {lead.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"เกิดข้อผิดพลาดในการให้คะแนน: {str(e)}",
        )


@router.post(
    "/score-batch",
    response_model=ScoreBatchResponse,
    status_code=status.HTTP_200_OK,
    summary="ให้คะแนนหลาย leads พร้อมกัน",
    description=(
        "ให้คะแนนหลาย leads พร้อมกันด้วย Claude AI\n\n"
        "- รองรับสูงสุด **10 leads** ต่อ request\n"
        "- ส่ง leads ทั้งหมดใน 1 Claude API call (batch mode)\n"
        "- ถ้า batch fail → fallback เป็น concurrent individual scoring\n"
        "- ผลลัพธ์เรียงตาม lead_id ที่ส่งเข้ามา"
    ),
)
async def score_leads_batch_endpoint(request: ScoreBatchRequest) -> ScoreBatchResponse:
    """
    ให้คะแนนหลาย leads พร้อมกัน (Batch Scoring)

    - Max 10 leads ต่อ request
    - ส่ง context ทั้งหมดให้ Claude ใน 1 call เพื่อประหยัด API calls
    - Fallback เป็น concurrent individual scoring ถ้า batch fail
    """
    leads = request.leads
    total = len(leads)
    logger.info(f"Batch scoring request: {total} leads")

    try:
        # แปลง Pydantic models → dicts
        leads_dicts = [_lead_to_dict(lead) for lead in leads]

        # Batch score
        raw_results = await score_leads_batch(leads_dicts)

        # แปลงผลลัพธ์ — map กลับไปหา lead_id ด้วย index
        results: list[ScoreResult] = []
        scores_to_save: list[dict] = []

        for raw in raw_results:
            lead_index = raw.get("lead_index", 0)
            # ดึง lead_id จาก original request
            lead_id = leads[lead_index].id if lead_index < total else str(lead_index)

            results.append(
                ScoreResult(
                    lead_id=lead_id,
                    score=raw["score"],
                    reasoning=raw["reasoning"],
                )
            )

            # เก็บ scores ที่สำเร็จไว้บันทึก (เฉพาะ UUID lead_id, ข้าม Places ID)
            if not raw.get("error") and _is_uuid(lead_id):
                scores_to_save.append({
                    "lead_id": lead_id,
                    "score": raw["score"],
                    "reasoning": raw["reasoning"],
                })

        # บันทึก scores ลง Supabase แบบ non-blocking
        if scores_to_save:
            asyncio.create_task(
                lead_score_store.save_scores_batch(scores=scores_to_save)
            )

        logger.info(f"Batch scoring เสร็จสิ้น: {len(results)} results")

        return ScoreBatchResponse(results=results)

    except Exception as e:
        logger.error(f"Batch scoring error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"เกิดข้อผิดพลาดในการให้คะแนน batch: {str(e)}",
        )
