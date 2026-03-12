"""
Lead Score Store — บันทึกผลการ scoring ลง Supabase lead_scores table
ใช้ httpx เรียก Supabase REST API ด้วย service role key (bypass RLS)
"""

import logging
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Model version ที่ใช้ score (sync กับ scorer.py)
MODEL_VERSION = "claude-sonnet-4-6"


def _supabase_headers() -> dict:
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


async def save_score(
    lead_id: str,
    score: int,
    reasoning: str,
    model_version: str = MODEL_VERSION,
) -> bool:
    """
    INSERT score ของ lead เดียวลง lead_scores table

    Args:
        lead_id: ID ของ lead
        score: คะแนน 0-100
        reasoning: เหตุผลจาก Claude (ภาษาไทย)
        model_version: Claude model ที่ใช้ score

    Returns:
        True ถ้า INSERT สำเร็จ, False ถ้าล้มเหลว
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.warning("Supabase ไม่ถูกตั้งค่า — ข้าม save_score สำหรับ lead_id=%s", lead_id)
        return False

    url = f"{settings.supabase_url}/rest/v1/lead_scores"
    scored_at = datetime.now(timezone.utc).isoformat()

    payload = {
        "lead_id": lead_id,
        "score": score,
        "reasoning": reasoning,
        "scored_at": scored_at,
        "model_version": model_version,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, headers=_supabase_headers(), json=payload)
            response.raise_for_status()

        logger.info(
            "lead_scores INSERT | lead_id=%s | score=%d | model=%s",
            lead_id,
            score,
            model_version,
        )
        return True

    except httpx.HTTPStatusError as e:
        logger.error(
            "lead_scores INSERT HTTP error | lead_id=%s | status=%d | body=%s",
            lead_id,
            e.response.status_code,
            e.response.text,
        )
        return False
    except Exception as e:
        logger.error("lead_scores INSERT error | lead_id=%s | error=%s", lead_id, str(e))
        return False


async def save_scores_batch(
    scores: list[dict],
    model_version: str = MODEL_VERSION,
) -> tuple[int, int]:
    """
    INSERT หลาย scores พร้อมกันลง lead_scores table (1 request ต่อ 1 lead)
    ใช้ asyncio.gather เพื่อส่งแบบ concurrent

    Args:
        scores: list ของ dict ที่มี keys: lead_id, score, reasoning
        model_version: Claude model ที่ใช้ score

    Returns:
        tuple(success_count, error_count)
    """
    import asyncio

    if not scores:
        return 0, 0

    tasks = [
        save_score(
            lead_id=item["lead_id"],
            score=item["score"],
            reasoning=item["reasoning"],
            model_version=model_version,
        )
        for item in scores
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    success = sum(1 for r in results if r is True)
    errors = len(results) - success

    logger.info(
        "lead_scores batch INSERT | total=%d | success=%d | error=%d",
        len(scores),
        success,
        errors,
    )
    return success, errors
