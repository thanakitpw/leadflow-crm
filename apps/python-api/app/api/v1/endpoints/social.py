"""
Social Media Finder Endpoints
POST /api/v1/social/find  — ค้นหา Facebook Page และ LINE OA จากเว็บไซต์
"""

import logging

from fastapi import APIRouter, HTTPException, status

from app.schemas.social import SocialFinderRequest, SocialLink, SocialMediaResponse
from app.services.social_finder import find_social_media, SocialLinkResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/social", tags=["Social Media Finder"])


def _to_schema(result: SocialLinkResult | None) -> SocialLink | None:
    """แปลง internal SocialLinkResult dataclass → Pydantic SocialLink schema"""
    if result is None:
        return None
    return SocialLink(
        platform=result.platform,
        url=result.url,
        handle=result.handle,
        source=result.source,
        confidence=result.confidence,
    )


@router.post(
    "/find",
    response_model=SocialMediaResponse,
    status_code=status.HTTP_200_OK,
    summary="ค้นหา Facebook Page และ LINE OA จากเว็บไซต์",
    description=(
        "Scrape เว็บไซต์ธุรกิจเพื่อค้นหา Facebook Page และ LINE OA\n\n"
        "**Flow:** Scrape pages → Parse HTML → Extract FB links → Extract LINE links\n\n"
        "**Confidence Scores:**\n"
        "- Direct link (anchor tag) → 90\n"
        "- Text pattern ใกล้ LINE/Facebook keyword → 70\n"
        "- QR code image → 50\n\n"
        "**หมายเหตุ:** ใช้ 24-hour cache ร่วมกับ email finder — "
        "ถ้า scrape เว็บเดิมไปแล้วใน 24 ชั่วโมงจะใช้ cache ทันที"
    ),
)
async def find_social(request: SocialFinderRequest) -> SocialMediaResponse:
    """
    ค้นหา Facebook Page และ LINE OA จากเว็บไซต์ของธุรกิจ

    - Scrape homepage, /contact, /about, /team, /เกี่ยวกับเรา
    - ค้นหา Facebook จาก anchor links ที่มี facebook.com/fb.com/fb.me
    - ค้นหา LINE จาก line.me/lin.ee links, @handle text patterns, และ QR code images
    - หยุดเมื่อพบทั้ง Facebook และ LINE แล้ว (ประหยัด request)
    - Return null สำหรับ platform ที่ไม่พบ — ไม่ error
    """
    website_url = request.website
    logger.info(f"Social finder request สำหรับ: {website_url}")

    try:
        social_result = await find_social_media(website_url)

        return SocialMediaResponse(
            website=social_result.website,
            facebook=_to_schema(social_result.facebook),
            line=_to_schema(social_result.line),
            pages_scraped=social_result.pages_scraped,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Social finder error สำหรับ {website_url}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"เกิดข้อผิดพลาดในการค้นหา social media: {str(e)}",
        )
