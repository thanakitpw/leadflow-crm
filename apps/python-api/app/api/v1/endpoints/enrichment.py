"""
Enrichment Endpoints — AI Email Finder
POST /api/v1/enrichment/find-email
"""

import logging
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, status

from app.schemas.enrichment import EmailFinderRequest, EmailFinderResponse, EmailResult
from app.services.email_finder import find_emails
from app.services.mx_validator import validate_mx

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/enrichment", tags=["Enrichment"])


def _extract_domain(url: str) -> str:
    """แยก domain จาก URL"""
    parsed = urlparse(url)
    domain = parsed.netloc.lower()
    if domain.startswith("www."):
        domain = domain[4:]
    return domain or url


@router.post(
    "/find-email",
    response_model=EmailFinderResponse,
    status_code=status.HTTP_200_OK,
    summary="ค้นหา email จากเว็บไซต์",
    description=(
        "ใช้ AI Email Finder ค้นหา email address จากเว็บไซต์ของธุรกิจ\n\n"
        "**Flow:** Scrape → Regex/mailto → Claude Extract → Pattern Guess → MX Validation\n\n"
        "**Confidence Scores:**\n"
        "- `mailto:` link → 95%\n"
        "- Scraped จาก HTML attributes → 90%\n"
        "- Regex จาก text content → 80%\n"
        "- Claude extract → 75%\n"
        "- Pattern guess → 50%\n\n"
        "**หมายเหตุ:** เฉพาะ email ที่มี confidence >= 50% และ domain มี MX record เท่านั้น"
    ),
)
async def find_email(request: EmailFinderRequest) -> EmailFinderResponse:
    """
    ค้นหา email จากเว็บไซต์ของธุรกิจ

    - Scrape homepage, /contact, /about, /team, /เกี่ยวกับเรา
    - ใช้ Claude AI ช่วย extract email ที่ถูก obfuscate
    - MX record validation ทุก email domain
    - Return เรียงตาม confidence (สูงสุดก่อน)
    """
    website_url = request.website
    business_name = request.business_name

    logger.info(f"Email finder request สำหรับ: {website_url}")

    try:
        # หา emails ด้วย AI Email Finder
        email_results = await find_emails(website_url, business_name)

        # ตรวจสอบ MX record ของ domain หลัก
        domain = _extract_domain(website_url)
        domain_valid = await validate_mx(domain)

        # แปลง EmailResult objects → Pydantic models
        email_models = [
            EmailResult(
                email=result.email,
                confidence=result.confidence,
                source=result.source,
                verified=domain_valid,
            )
            for result in email_results
        ]

        return EmailFinderResponse(
            emails=email_models,
            website=website_url,
            pages_scraped=len(email_results),
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Email finder error สำหรับ {website_url}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"เกิดข้อผิดพลาดในการค้นหา email: {str(e)}",
        )
