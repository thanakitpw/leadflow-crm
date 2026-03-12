"""
Orchestrator API Endpoint
POST /api/v1/orchestrate — Full pipeline: search → enrich → score → save
"""

import logging

from fastapi import APIRouter, HTTPException

from app.schemas.orchestrator import OrchestrationRequest, OrchestrationResponse
from app.services.orchestrator import orchestrator

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/orchestrate", response_model=OrchestrationResponse)
async def orchestrate_search(request: OrchestrationRequest) -> OrchestrationResponse:
    """
    Full pipeline: search → enrich → score → save

    1. ค้นหา places ด้วย Google Places API (มี cache layer)
    2. หา email จาก website ของแต่ละ lead (parallel, max 3 concurrent)
    3. ให้คะแนน lead ทั้งหมดด้วย Claude AI (batch)
    4. บันทึก leads + scores ลง Supabase (skip ถ้า place_id ซ้ำใน workspace)
    5. Return enriched results เรียงตาม score

    หมายเหตุ:
    - Enrichment timeout 30 วินาที — ถ้า timeout จะ return partial results
    - Scoring และ saving ล้มเหลวบางส่วน ไม่ทำให้ request fail ทั้งหมด
    - ใช้ workspace_id สำหรับ multi-tenant isolation
    """
    logger.info(
        "POST /orchestrate | keyword='%s' | workspace=%s | "
        "lat=%.4f | lng=%.4f | radius=%dm | enrich=%s | score=%s",
        request.keyword,
        request.workspace_id,
        request.latitude,
        request.longitude,
        request.radius,
        request.auto_enrich,
        request.auto_score,
    )

    try:
        result = await orchestrator.process_search(
            keyword=request.keyword,
            latitude=request.latitude,
            longitude=request.longitude,
            radius=request.radius,
            workspace_id=request.workspace_id,
            category=request.category,
            auto_enrich=request.auto_enrich,
            auto_score=request.auto_score,
        )

        logger.info(
            "POST /orchestrate เสร็จสิ้น | total=%d | enriched=%d | "
            "scored=%d | saved=%d | from_cache=%s | time=%dms",
            result.total,
            result.enriched,
            result.scored,
            result.saved,
            result.from_cache,
            result.processing_time_ms,
        )

        return result

    except ValueError as e:
        # Input validation error จาก services ชั้นล่าง
        logger.warning("Orchestrate validation error: %s", str(e))
        raise HTTPException(status_code=400, detail=str(e))

    except PermissionError as e:
        # API key ไม่ถูกต้อง (Places API / Anthropic)
        logger.error("Orchestrate auth error: %s", str(e))
        raise HTTPException(status_code=401, detail=str(e))

    except RuntimeError as e:
        # Rate limit หรือ upstream service unavailable
        logger.error("Orchestrate runtime error: %s", str(e))
        raise HTTPException(status_code=503, detail=str(e))

    except Exception as e:
        logger.exception("Orchestrate unexpected error: %s", str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )
