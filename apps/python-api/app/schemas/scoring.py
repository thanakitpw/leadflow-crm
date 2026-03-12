"""
Pydantic schemas สำหรับ Lead Scoring endpoints
"""

from pydantic import BaseModel, Field


class LeadForScoring(BaseModel):
    id: str = Field(..., description="Unique identifier ของ lead")
    name: str = Field(..., description="ชื่อธุรกิจ")
    rating: float | None = Field(None, ge=0, le=5, description="Google rating 0-5")
    review_count: int | None = Field(None, ge=0, description="จำนวน Google reviews")
    website: str | None = Field(None, description="URL ของเว็บไซต์")
    email: str | None = Field(None, description="Email ของธุรกิจ")
    phone: str | None = Field(None, description="เบอร์โทร")
    category: str | None = Field(
        None,
        description="ประเภทธุรกิจ เช่น Restaurant, Hotel, Beauty Salon",
    )
    address: str | None = Field(None, description="ที่อยู่")


class ScoreResult(BaseModel):
    lead_id: str = Field(..., description="ID ของ lead")
    score: int = Field(..., ge=0, le=100, description="คะแนน lead 0-100")
    reasoning: str = Field(..., description="เหตุผลการให้คะแนน (ภาษาไทย)")


class ScoreLeadRequest(BaseModel):
    lead: LeadForScoring = Field(..., description="ข้อมูล lead ที่ต้องการให้คะแนน")


class ScoreLeadResponse(BaseModel):
    result: ScoreResult = Field(..., description="ผลลัพธ์การให้คะแนน")


class ScoreBatchRequest(BaseModel):
    leads: list[LeadForScoring] = Field(
        ...,
        min_length=1,
        max_length=10,
        description="รายการ leads ที่ต้องการให้คะแนน (สูงสุด 10 รายการ)",
    )


class ScoreBatchResponse(BaseModel):
    results: list[ScoreResult] = Field(
        ...,
        description="ผลลัพธ์การให้คะแนน เรียงตาม lead_id",
    )
