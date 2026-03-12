from typing import Optional
from pydantic import BaseModel, Field


# ---- Request Schemas ----

class PlaceSearchRequest(BaseModel):
    keyword: str = Field(..., min_length=1, description="คำค้นหา เช่น ร้านอาหาร, คาเฟ่")
    latitude: float = Field(..., ge=-90, le=90, description="ละติจูด")
    longitude: float = Field(..., ge=-180, le=180, description="ลองจิจูด")
    radius: int = Field(default=1000, ge=100, le=50000, description="รัศมีค้นหา (เมตร)")
    category_preset: Optional[str] = Field(
        default=None,
        description="preset: fnb | sme | realestate | b2b"
    )
    max_results: int = Field(
        default=20,
        ge=1,
        le=60,
        description="จำนวน results สูงสุด (default 20, max 60 = 3 pages)",
    )


class BatchSearchRequest(BaseModel):
    searches: list[PlaceSearchRequest] = Field(..., min_length=1, max_length=10)


# ---- Result Schemas ----

class PlaceResult(BaseModel):
    place_id: str
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    rating: Optional[float] = None
    reviews_count: Optional[int] = None
    category: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    google_maps_uri: Optional[str] = None


# ---- Response Schemas ----

class PlaceSearchResponse(BaseModel):
    results: list[PlaceResult]
    total: int
    cached: bool
    cache_key: Optional[str] = None


class BatchSearchResponse(BaseModel):
    searches: list[PlaceSearchResponse]
    total_results: int
    cache_hits: int
    cache_misses: int
