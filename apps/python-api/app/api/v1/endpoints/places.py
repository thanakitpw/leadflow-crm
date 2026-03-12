"""
Places API Endpoints
POST /api/v1/places/search        — ค้นหาธุรกิจ (single keyword)
POST /api/v1/places/search-batch  — ค้นหาหลาย keyword พร้อมกัน
GET  /api/v1/places/details/{id}  — ดึง place details (cached)
"""

import asyncio
import logging

from fastapi import APIRouter, HTTPException

from app.schemas.places import (
    BatchSearchRequest,
    BatchSearchResponse,
    PlaceResult,
    PlaceSearchRequest,
    PlaceSearchResponse,
)
from app.services import cache as cache_service
from app.services import places as places_service

logger = logging.getLogger(__name__)

# prefix ถูกกำหนดใน main.py แล้ว ("/api/v1/places") จึงไม่ใส่ซ้ำที่นี่
router = APIRouter(tags=["Places"])


async def _search_single(request: PlaceSearchRequest) -> PlaceSearchResponse:
    """
    Core search logic:
    1. ถ้ามี category_preset → ใช้ searchNearby ด้วย includedTypes
    2. ถ้าไม่มี preset → ใช้ searchText ด้วย keyword
    3. ตรวจสอบ cache ก่อนทุกครั้ง
    4. ถ้า MISS → เรียก Places API → บันทึก cache
    """
    all_results: list[PlaceResult] = []
    is_cached = True  # จะเป็น False ถ้า MISS อย่างน้อย 1 ครั้ง

    if request.category_preset:
        # --- Nearby Search โดยใช้ includedTypes จาก preset ---
        preset_types = places_service.CATEGORY_PRESETS.get(request.category_preset, [])
        if not preset_types:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown category_preset: {request.category_preset}. "
                       f"Valid values: {list(places_service.CATEGORY_PRESETS.keys())}",
            )

        # cache key สำหรับ nearby search ใช้ preset name แทน keyword
        # Nearby Search API ไม่รองรับ pagination จึงไม่รวม max_results ใน key
        cache_key = cache_service.build_cache_key(
            keyword=f"preset:{request.category_preset}",
            latitude=request.latitude,
            longitude=request.longitude,
            radius=request.radius,
        )

        cached_data = await cache_service.get_cached(cache_key)
        if cached_data is not None:
            results = [PlaceResult(**item) for item in cached_data]
            all_results.extend(results)
        else:
            is_cached = False
            try:
                results = await places_service.search_nearby(
                    latitude=request.latitude,
                    longitude=request.longitude,
                    radius=request.radius,
                    included_types=preset_types,
                    max_results=request.max_results,
                )
            except PermissionError as e:
                raise HTTPException(status_code=401, detail=str(e))
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
            except RuntimeError as e:
                raise HTTPException(status_code=503, detail=str(e))

            results_as_dicts = [r.model_dump() for r in results]
            asyncio.create_task(
                cache_service.set_cache(
                    cache_key=cache_key,
                    search_type="search",
                    results=results_as_dicts,
                    ttl_days=cache_service.SEARCH_TTL_DAYS,
                )
            )
            all_results.extend(results)

    else:
        # --- Text Search โดยใช้ keyword (รองรับ pagination สูงสุด 3 pages) ---
        # รวม max_results ใน cache key เพราะ pagination ให้ผลลัพธ์ต่างกัน
        cache_key = cache_service.build_cache_key(
            keyword=request.keyword,
            latitude=request.latitude,
            longitude=request.longitude,
            radius=request.radius,
            max_results=request.max_results,
        )

        cached_data = await cache_service.get_cached(cache_key)
        if cached_data is not None:
            results = [PlaceResult(**item) for item in cached_data]
            all_results.extend(results)
        else:
            is_cached = False
            try:
                results = await places_service.search_places(
                    keyword=request.keyword,
                    latitude=request.latitude,
                    longitude=request.longitude,
                    radius=request.radius,
                    max_results=request.max_results,
                )
            except PermissionError as e:
                raise HTTPException(status_code=401, detail=str(e))
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
            except RuntimeError as e:
                raise HTTPException(status_code=503, detail=str(e))

            results_as_dicts = [r.model_dump() for r in results]
            asyncio.create_task(
                cache_service.set_cache(
                    cache_key=cache_key,
                    search_type="search",
                    results=results_as_dicts,
                    ttl_days=cache_service.SEARCH_TTL_DAYS,
                )
            )
            all_results.extend(results)

    # Deduplicate ตาม place_id
    seen: set[str] = set()
    unique_results: list[PlaceResult] = []
    for r in all_results:
        if r.place_id not in seen:
            seen.add(r.place_id)
            unique_results.append(r)

    return PlaceSearchResponse(
        results=unique_results,
        total=len(unique_results),
        cached=is_cached,
    )


@router.post("/search", response_model=PlaceSearchResponse)
async def search_places(request: PlaceSearchRequest) -> PlaceSearchResponse:
    """
    ค้นหาธุรกิจด้วย keyword และ location

    - ตรวจสอบ cache ก่อน (TTL 7 วัน)
    - ถ้า cache miss → เรียก Google Places API แล้วบันทึก cache
    - ถ้ามี category_preset (fnb|sme|realestate|b2b) → ใช้ Nearby Search ด้วย includedTypes
    - ถ้าไม่มี preset → ใช้ Text Search ด้วย keyword
    """
    return await _search_single(request)


@router.post("/search-batch", response_model=BatchSearchResponse)
async def search_places_batch(request: BatchSearchRequest) -> BatchSearchResponse:
    """
    ค้นหาหลาย keyword พร้อมกันด้วย asyncio.gather

    - รับ list ของ search requests (max 10)
    - Run ทุก search แบบ parallel
    - Log cache hit/miss ratio
    """
    tasks = [_search_single(search) for search in request.searches]
    responses: list[PlaceSearchResponse] = await asyncio.gather(*tasks)

    total_results = sum(r.total for r in responses)
    cache_hits = sum(1 for r in responses if r.cached)
    cache_misses = len(responses) - cache_hits
    hit_ratio = (cache_hits / len(responses) * 100) if responses else 0

    logger.info(
        "Batch search | count=%d | total_results=%d | cache_hits=%d | cache_misses=%d | hit_ratio=%.1f%%",
        len(responses),
        total_results,
        cache_hits,
        cache_misses,
        hit_ratio,
    )

    return BatchSearchResponse(
        searches=responses,
        total_results=total_results,
        cache_hits=cache_hits,
        cache_misses=cache_misses,
    )


@router.get("/details/{place_id}", response_model=PlaceSearchResponse)
async def get_place_details(place_id: str) -> PlaceSearchResponse:
    """
    ดึงรายละเอียดสถานที่จาก place_id

    - TTL 30 วัน
    - ถ้า cache miss → เรียก Places API Details endpoint
    """
    cache_key = f"details:{place_id}"

    # Check cache
    cached_data = await cache_service.get_cached(cache_key)
    if cached_data is not None:
        results = [PlaceResult(**item) for item in cached_data]
        return PlaceSearchResponse(
            results=results,
            total=len(results),
            cached=True,
            cache_key=cache_key,
        )

    # MISS — เรียก API
    try:
        result = await places_service.get_place_details(place_id)
    except PermissionError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    if result is None:
        raise HTTPException(status_code=404, detail=f"Place not found: {place_id}")

    # บันทึก cache (non-blocking)
    asyncio.create_task(
        cache_service.set_cache(
            cache_key=cache_key,
            search_type="details",
            results=[result.model_dump()],
            ttl_days=cache_service.DETAILS_TTL_DAYS,
        )
    )

    return PlaceSearchResponse(
        results=[result],
        total=1,
        cached=False,
        cache_key=cache_key,
    )
