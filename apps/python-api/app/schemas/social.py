"""
Pydantic schemas สำหรับ Social Media Finder endpoints
"""

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Social Link — ผลลัพธ์ของ social link แต่ละ platform
# ---------------------------------------------------------------------------


class SocialLink(BaseModel):
    platform: str = Field(
        ...,
        description="platform ที่พบ: 'facebook' หรือ 'line'",
        examples=["facebook", "line"],
    )
    url: str | None = Field(
        default=None,
        description="URL เต็มของ page/profile เช่น https://facebook.com/restaurantbkk",
    )
    handle: str | None = Field(
        default=None,
        description="ชื่อ handle เช่น 'restaurantbkk' สำหรับ FB, '@restaurantbkk' สำหรับ LINE",
    )
    source: str = Field(
        ...,
        description="แหล่งที่มา: 'link' (anchor tag), 'text' (text pattern), 'qrcode' (QR code image)",
        examples=["link", "text", "qrcode"],
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="ความมั่นใจ 0-100 (link=90, text=70, near-context=50)",
    )


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------


class SocialFinderRequest(BaseModel):
    website: str = Field(
        ...,
        description="URL ของเว็บไซต์ที่ต้องการหา social links เช่น https://example.co.th",
        examples=["https://example.co.th"],
    )
    business_name: str = Field(
        default="",
        description="ชื่อธุรกิจ (optional — ใช้เป็น context เพิ่มเติม)",
    )

    @field_validator("website")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("website ต้องไม่ว่าง")
        if not v.startswith(("http://", "https://")):
            v = "https://" + v
        return v


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------


class SocialMediaResponse(BaseModel):
    website: str = Field(..., description="URL ที่ scrape")
    facebook: SocialLink | None = Field(
        default=None,
        description="ผลลัพธ์ Facebook Page ที่พบ (None ถ้าไม่พบ)",
    )
    line: SocialLink | None = Field(
        default=None,
        description="ผลลัพธ์ LINE OA ที่พบ (None ถ้าไม่พบ)",
    )
    pages_scraped: int = Field(
        ...,
        description="จำนวนหน้าที่ scrape สำเร็จ",
    )
