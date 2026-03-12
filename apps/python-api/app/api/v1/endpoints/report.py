"""
Report Endpoints — API routes สำหรับ HTML report generation
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status

from app.schemas.report import ReportGenerateRequest, ReportGenerateResponse
from app.services.report_generator import generate_report_html

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/report/generate-html",
    response_model=ReportGenerateResponse,
    summary="สร้าง printable HTML report",
    description=(
        "Generate printable HTML report จาก stats และ campaign data. "
        "Frontend สามารถใช้ window.print() หรือ html2pdf เพื่อแปลงเป็น PDF ได้"
    ),
)
async def generate_html_report(req: ReportGenerateRequest) -> ReportGenerateResponse:
    """
    สร้าง HTML report สรุปผลการทำงานของ workspace

    Request body:
    - **workspace_name**: ชื่อ workspace ที่แสดงใน header
    - **date_from**: วันที่เริ่มต้น (YYYY-MM-DD)
    - **date_to**: วันที่สิ้นสุด (YYYY-MM-DD)
    - **stats**: สถิติภาพรวม (total_leads, emails_sent, open_rate, ฯลฯ)
    - **campaigns**: รายการ campaigns พร้อม performance metrics
    - **top_leads**: รายการ leads ที่มีคะแนนสูง (optional)

    Response:
    - **html**: HTML string ที่พร้อม render / print
    - **generated_at**: วันเวลาที่สร้าง report
    """
    # Validate date format เบื้องต้น
    for field_name, date_str in [("date_from", req.date_from), ("date_to", req.date_to)]:
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{field_name} ต้องอยู่ในรูปแบบ YYYY-MM-DD (ได้รับ: '{date_str}')",
            )

    # ตรวจสอบว่า date_from ไม่เกิน date_to
    if req.date_from > req.date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"date_from ({req.date_from}) ต้องไม่มากกว่า date_to ({req.date_to})",
        )

    try:
        html = await generate_report_html(
            workspace_name=req.workspace_name,
            date_from=req.date_from,
            date_to=req.date_to,
            stats=req.stats,
            campaigns=req.campaigns,
            top_leads=req.top_leads,
            extra=req.extra,
        )
    except Exception as e:
        logger.error(
            "report/generate-html: generation failed | workspace=%s | error=%s",
            req.workspace_name,
            str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ไม่สามารถสร้าง report ได้ กรุณาลองใหม่อีกครั้ง",
        )

    generated_at = datetime.now(timezone.utc).isoformat()

    logger.info(
        "Report generated | workspace=%s | date=%s to %s | campaigns=%d | leads=%d",
        req.workspace_name,
        req.date_from,
        req.date_to,
        len(req.campaigns),
        len(req.top_leads),
    )

    return ReportGenerateResponse(html=html, generated_at=generated_at)
