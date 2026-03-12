"""
Report Schemas — Pydantic models สำหรับ Report generation endpoints
"""

from typing import Any, Optional
from pydantic import BaseModel, Field


class CampaignStat(BaseModel):
    """ข้อมูล campaign สำหรับแสดงใน report"""

    name: str = Field(..., description="ชื่อ campaign")
    sent: int = Field(default=0, description="จำนวน email ที่ส่ง")
    opened: int = Field(default=0, description="จำนวน email ที่เปิด")
    clicked: int = Field(default=0, description="จำนวนครั้งที่คลิก")
    replied: int = Field(default=0, description="จำนวนการตอบกลับ")
    bounced: int = Field(default=0, description="จำนวน email ที่ bounce")
    status: str = Field(default="", description="สถานะ campaign เช่น active, paused, completed")


class SummaryStats(BaseModel):
    """สรุปสถิติภาพรวมสำหรับ report"""

    total_leads: int = Field(default=0, description="จำนวน leads ทั้งหมด")
    new_leads: int = Field(default=0, description="จำนวน leads ใหม่ในช่วงเวลาที่เลือก")
    emails_sent: int = Field(default=0, description="จำนวน email ที่ส่งทั้งหมด")
    open_rate: float = Field(default=0.0, description="อัตราการเปิด email (เปอร์เซ็นต์)")
    click_rate: float = Field(default=0.0, description="อัตราการคลิก (เปอร์เซ็นต์)")
    reply_rate: float = Field(default=0.0, description="อัตราการตอบกลับ (เปอร์เซ็นต์)")
    bounce_rate: float = Field(default=0.0, description="อัตราการ bounce (เปอร์เซ็นต์)")
    active_campaigns: int = Field(default=0, description="จำนวน campaigns ที่กำลัง active")


class TopLead(BaseModel):
    """ข้อมูล top lead สำหรับแสดงใน report"""

    name: str = Field(..., description="ชื่อ lead หรือชื่อบริษัท")
    email: str = Field(default="", description="อีเมล lead")
    score: Optional[int] = Field(default=None, description="คะแนน lead scoring (0-100)")
    category: str = Field(default="", description="ประเภทธุรกิจ")
    location: str = Field(default="", description="ที่ตั้ง")
    status: str = Field(default="", description="สถานะ lead")


class ReportGenerateRequest(BaseModel):
    """Request body สำหรับ generate HTML report"""

    workspace_name: str = Field(..., description="ชื่อ workspace")
    date_from: str = Field(..., description="วันที่เริ่มต้น (YYYY-MM-DD)")
    date_to: str = Field(..., description="วันที่สิ้นสุด (YYYY-MM-DD)")
    stats: SummaryStats = Field(default_factory=SummaryStats, description="สถิติภาพรวม")
    campaigns: list[CampaignStat] = Field(default_factory=list, description="รายการ campaigns")
    top_leads: list[TopLead] = Field(default_factory=list, description="Top leads ที่มีคะแนนสูง")
    extra: dict[str, Any] = Field(default_factory=dict, description="ข้อมูลเพิ่มเติม")


class ReportGenerateResponse(BaseModel):
    """Response body ที่ประกอบด้วย HTML report"""

    html: str = Field(..., description="HTML string สำหรับพิมพ์หรือแสดงใน browser")
    generated_at: str = Field(..., description="วันเวลาที่สร้าง report (ISO 8601)")
