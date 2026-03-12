"""
Pydantic schemas สำหรับ Orchestrator pipeline
"""

from typing import Optional
from pydantic import BaseModel, Field, UUID4


class OrchestrationRequest(BaseModel):
    keyword: str = Field(..., min_length=1, description="คำค้นหา เช่น ร้านอาหาร, คาเฟ่")
    latitude: float = Field(..., ge=-90, le=90, description="ละติจูด")
    longitude: float = Field(..., ge=-180, le=180, description="ลองจิจูด")
    radius: int = Field(
        default=2000,
        ge=100,
        le=50000,
        description="รัศมีค้นหา (เมตร)",
    )
    workspace_id: str = Field(..., description="UUID ของ workspace")
    category: Optional[str] = Field(
        default=None,
        description="ประเภทธุรกิจ (optional) — ส่งต่อไปยัง Places API",
    )
    auto_enrich: bool = Field(
        default=True,
        description="ถ้า True จะค้นหา email จาก website (enrichment)",
    )
    auto_score: bool = Field(
        default=True,
        description="ถ้า True จะให้คะแนน lead ด้วย Claude AI",
    )


class EnrichedLead(BaseModel):
    place_id: Optional[str] = None
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    email_confidence: Optional[float] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    category: Optional[str] = None
    score: Optional[int] = None
    score_reasoning: Optional[str] = None
    lead_id: Optional[str] = None  # UUID หลังจาก save ลง DB


class OrchestrationResponse(BaseModel):
    leads: list[EnrichedLead]
    total: int = Field(description="จำนวน leads ทั้งหมดที่พบ")
    enriched: int = Field(description="จำนวน leads ที่หา email ได้")
    scored: int = Field(description="จำนวน leads ที่ score ได้")
    saved: int = Field(description="จำนวน leads ที่ save ลง DB สำเร็จ")
    from_cache: bool = Field(description="ข้อมูล places มาจาก cache หรือไม่")
    processing_time_ms: int = Field(description="เวลาประมวลผลทั้งหมด (มิลลิวินาที)")
