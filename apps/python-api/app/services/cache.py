"""
Cache Layer สำหรับ Places API
ใช้ Supabase REST API ผ่าน httpx (ไม่ใช้ supabase-py เพื่อลด deps)
"""

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# TTL constants
SEARCH_TTL_DAYS = 7
DETAILS_TTL_DAYS = 30

# Radius buckets (meters)
RADIUS_BUCKETS = [500, 1000, 2000, 5000, 10000]


def bucket_radius(radius: int) -> int:
    """ปัด radius ไปยัง bucket ที่ใกล้ที่สุด (เท่าหรือมากกว่า)"""
    for bucket in RADIUS_BUCKETS:
        if radius <= bucket:
            return bucket
    return RADIUS_BUCKETS[-1]


def bucket_coordinate(value: float) -> float:
    """Bucket lat/lng ด้วย 3 decimal places (~100m accuracy)"""
    return round(value, 3)


def build_cache_key(
    keyword: str,
    latitude: float,
    longitude: float,
    radius: int,
    max_results: int = 20,
) -> str:
    """
    สร้าง cache key จาก hash ของ keyword + location_bucket + radius_bucket + max_results
    max_results รวมอยู่ใน key เพราะ pagination ทำให้ผลลัพธ์ต่างกัน
    """
    lat_bucket = bucket_coordinate(latitude)
    lng_bucket = bucket_coordinate(longitude)
    radius_bucket = bucket_radius(radius)

    normalized_keyword = keyword.strip().lower()
    key_string = f"{normalized_keyword}|{lat_bucket}|{lng_bucket}|{radius_bucket}|{max_results}"

    return hashlib.sha256(key_string.encode()).hexdigest()


def _supabase_headers() -> dict:
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


async def get_cached(cache_key: str) -> Optional[list[dict]]:
    """
    ดึงข้อมูลจาก places_cache ถ้ายังไม่หมดอายุ
    Return: list of place dicts หรือ None ถ้า MISS
    """
    now_iso = datetime.now(timezone.utc).isoformat()

    url = f"{settings.supabase_url}/rest/v1/places_cache"
    params = {
        "cache_key": f"eq.{cache_key}",
        "select": "results,cached_at,expires_at,hit_count",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=_supabase_headers(), params=params)
            response.raise_for_status()

        rows = response.json()
        if not rows:
            logger.info("CACHE MISS | key=%s", cache_key[:16])
            return None

        row = rows[0]
        expires_at = row.get("expires_at")
        if expires_at and expires_at < now_iso:
            logger.info("CACHE EXPIRED | key=%s | expired_at=%s", cache_key[:16], expires_at)
            return None

        logger.info(
            "CACHE HIT | key=%s | cached_at=%s | hit_count=%s",
            cache_key[:16],
            row.get("cached_at"),
            row.get("hit_count", 0),
        )

        # increment hit_count แบบ fire-and-forget (ไม่รอผล)
        import asyncio
        asyncio.ensure_future(_increment_hit_count(cache_key))

        return row["results"]

    except httpx.HTTPStatusError as e:
        logger.error("Cache read HTTP error: %s %s", e.response.status_code, e.response.text)
        return None
    except Exception as e:
        logger.error("Cache read error: %s", str(e))
        return None


async def _increment_hit_count(cache_key: str) -> None:
    """
    เพิ่ม hit_count ของ cache entry (fire-and-forget)
    ใช้ Supabase RPC หรือ PATCH ด้วย raw SQL increment
    """
    url = f"{settings.supabase_url}/rest/v1/places_cache"
    params = {"cache_key": f"eq.{cache_key}"}
    headers = {**_supabase_headers(), "Prefer": "return=minimal"}

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.patch(
                url,
                headers=headers,
                params=params,
                json={"hit_count": "hit_count + 1"},
            )
            # ถ้า Supabase ไม่รองรับ expression ใน PATCH ให้ใช้ RPC แทน
            if response.status_code not in (200, 204):
                # fallback: เรียก RPC increment_cache_hit_count
                rpc_url = f"{settings.supabase_url}/rest/v1/rpc/increment_cache_hit_count"
                await client.post(
                    rpc_url,
                    headers=_supabase_headers(),
                    json={"p_cache_key": cache_key},
                )
    except Exception as e:
        logger.debug("hit_count increment failed (non-critical): %s", str(e))


async def set_cache(
    cache_key: str,
    search_type: str,
    results: list[dict],
    ttl_days: int = SEARCH_TTL_DAYS,
) -> bool:
    """
    บันทึกผลลัพธ์ลง places_cache
    search_type: 'search' | 'details'
    Return: True ถ้า success
    """
    now = datetime.now(timezone.utc)
    from datetime import timedelta

    expires_at = now + timedelta(days=ttl_days)

    payload = {
        "cache_key": cache_key,
        "search_type": search_type,
        "results": results,
        "cached_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
    }

    url = f"{settings.supabase_url}/rest/v1/places_cache"
    # upsert โดยใช้ on_conflict กับ cache_key
    headers = {**_supabase_headers(), "Prefer": "resolution=merge-duplicates,return=minimal"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()

        logger.info(
            "CACHE SET | key=%s | type=%s | ttl=%d days | count=%d",
            cache_key[:16],
            search_type,
            ttl_days,
            len(results),
        )
        return True

    except httpx.HTTPStatusError as e:
        logger.error("Cache write HTTP error: %s %s", e.response.status_code, e.response.text)
        return False
    except Exception as e:
        logger.error("Cache write error: %s", str(e))
        return False
