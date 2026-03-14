"""
Pydantic schemas สำหรับ Email Finder (Enrichment) endpoints
"""

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Email Finder Schemas
# ---------------------------------------------------------------------------


class EmailFinderRequest(BaseModel):
    website: str = Field(
        ...,
        description="URL ของเว็บไซต์ที่ต้องการหา email เช่น https://example.co.th",
        examples=["https://example.co.th"],
    )
    business_name: str = Field(
        default="",
        description="ชื่อธุรกิจ (optional — ใช้เป็น context ให้ Claude)",
    )

    @field_validator("website")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("website ต้องไม่ว่าง")
        # เพิ่ม https:// ถ้าไม่มี schema
        if not v.startswith(("http://", "https://")):
            v = "https://" + v
        return v


class EmailResult(BaseModel):
    email: str = Field(..., description="Email address ที่พบ")
    source: str = Field(
        ...,
        description="แหล่งที่มา: 'mailto', 'scraped', 'regex', 'claude', หรือ 'pattern'",
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="ความมั่นใจ 0-100 (mailto=95, scraped=90, regex=80, claude=75, pattern=50)",
    )
    verified: bool = Field(
        default=False,
        description="True ถ้า domain มี MX record ที่ valid",
    )


class EmailFinderResponse(BaseModel):
    emails: list[EmailResult] = Field(
        default_factory=list,
        description="รายการ email ที่พบ เรียงตาม confidence (สูงสุดก่อน)",
    )
    website: str = Field(..., description="URL ที่ scrape")
    pages_scraped: int = Field(..., description="จำนวนหน้าที่ scrape สำเร็จ")
