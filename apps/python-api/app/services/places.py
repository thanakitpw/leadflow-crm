"""
Google Places API (New) Client
Text Search: https://places.googleapis.com/v1/places:searchText
Nearby Search: https://places.googleapis.com/v1/places:searchNearby
Place Details: https://places.googleapis.com/v1/places/{place_id}
"""

import asyncio
import logging
from typing import Optional

import httpx

from app.core.config import settings
from app.schemas.places import PlaceResult

logger = logging.getLogger(__name__)

PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PLACES_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby"
PLACES_DETAILS_URL = "https://places.googleapis.com/v1/places/{place_id}"

FIELD_MASK = (
    "places.id,"
    "places.displayName,"
    "places.formattedAddress,"
    "places.internationalPhoneNumber,"
    "places.websiteUri,"
    "places.rating,"
    "places.userRatingCount,"
    "places.primaryType,"
    "places.location,"
    "places.googleMapsUri"
)

DETAILS_FIELD_MASK = (
    "id,"
    "displayName,"
    "formattedAddress,"
    "internationalPhoneNumber,"
    "websiteUri,"
    "rating,"
    "userRatingCount,"
    "primaryType,"
    "location,"
    "googleMapsUri"
)

# Category preset type mappings (Google Places includedTypes)
CATEGORY_PRESETS: dict[str, list[str]] = {
    "fnb": ["restaurant", "cafe", "bar", "bakery", "food"],
    "sme": ["store", "shop", "beauty_salon", "gym", "doctor"],
    "realestate": ["real_estate_agency", "property", "general_contractor"],
    "b2b": ["corporate_office", "office_space", "warehouse", "factory"],
}


def _parse_place(raw: dict) -> PlaceResult:
    """แปลง raw API response เป็น PlaceResult"""
    location = raw.get("location", {})
    display_name = raw.get("displayName", {})

    return PlaceResult(
        place_id=raw.get("id", ""),
        name=display_name.get("text", "") if isinstance(display_name, dict) else str(display_name),
        address=raw.get("formattedAddress"),
        phone=raw.get("internationalPhoneNumber") or raw.get("nationalPhoneNumber"),
        website=raw.get("websiteUri"),
        rating=raw.get("rating"),
        reviews_count=raw.get("userRatingCount"),
        category=raw.get("primaryType"),
        latitude=location.get("latitude") if location else None,
        longitude=location.get("longitude") if location else None,
        google_maps_uri=raw.get("googleMapsUri"),
    )


async def _fetch_one_page(
    client: httpx.AsyncClient,
    headers: dict,
    payload: dict,
) -> tuple[list[PlaceResult], Optional[str]]:
    """
    เรียก 1 page จาก Text Search API
    Returns: (results, nextPageToken หรือ None)
    """
    response = await client.post(PLACES_SEARCH_URL, headers=headers, json=payload)

    if response.status_code == 400:
        logger.error("Places API bad request: %s", response.text)
        raise ValueError(f"Bad request to Places API: {response.text}")

    if response.status_code in (401, 403):
        logger.error("Places API auth error: %s", response.status_code)
        raise PermissionError("Invalid or unauthorized Google Places API key")

    if response.status_code == 429:
        logger.error("Places API rate limit exceeded")
        raise RuntimeError("Google Places API rate limit exceeded")

    response.raise_for_status()

    data = response.json()
    places_raw = data.get("places", [])
    next_page_token = data.get("nextPageToken")

    return [_parse_place(p) for p in places_raw], next_page_token


async def search_places(
    keyword: str,
    latitude: float,
    longitude: float,
    radius: int,
    max_results: int = 20,
) -> list[PlaceResult]:
    """
    ค้นหาสถานที่ด้วย Google Places Text Search API (New)
    รองรับ pagination สูงสุด 3 pages (60 results)
    Return: list of PlaceResult
    """
    if not settings.google_places_api_key:
        raise ValueError("GOOGLE_PLACES_API_KEY is not configured")

    # จำกัด max_results และคำนวณจำนวน pages ที่ต้องเรียก
    max_results = min(max_results, 60)
    max_pages = 3

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.google_places_api_key,
        "X-Goog-FieldMask": FIELD_MASK,
    }

    all_results: list[PlaceResult] = []

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Page 1 — ไม่มี pageToken
            payload: dict = {
                "textQuery": keyword,
                "locationBias": {
                    "circle": {
                        "center": {"latitude": latitude, "longitude": longitude},
                        "radius": float(radius),
                    }
                },
                "maxResultCount": 20,
                "languageCode": "th",
                "regionCode": "TH",
            }

            page_results, next_page_token = await _fetch_one_page(client, headers, payload)
            all_results.extend(page_results)

            logger.info(
                "Places API page 1 | keyword='%s' | found=%d | next=%s",
                keyword,
                len(page_results),
                bool(next_page_token),
            )

            # Pages 2-3 — วนต่อเมื่อมี nextPageToken และยังไม่ครบ max_results
            current_page = 1
            while (
                next_page_token
                and len(all_results) < max_results
                and current_page < max_pages
            ):
                # Google API requirement: รอ 2 วินาทีก่อน next page call
                await asyncio.sleep(2)

                next_payload: dict = {
                    "textQuery": keyword,
                    "locationBias": {
                        "circle": {
                            "center": {"latitude": latitude, "longitude": longitude},
                            "radius": float(radius),
                        }
                    },
                    "maxResultCount": 20,
                    "languageCode": "th",
                    "pageToken": next_page_token,
                }

                page_results, next_page_token = await _fetch_one_page(client, headers, next_payload)
                all_results.extend(page_results)
                current_page += 1

                logger.info(
                    "Places API page %d | keyword='%s' | found=%d | next=%s",
                    current_page,
                    keyword,
                    len(page_results),
                    bool(next_page_token),
                )

        # ตัดผลลัพธ์ให้ไม่เกิน max_results
        results = all_results[:max_results]

        logger.info(
            "Places API | keyword='%s' | lat=%.4f | lng=%.4f | radius=%dm | total_found=%d | returned=%d",
            keyword,
            latitude,
            longitude,
            radius,
            len(all_results),
            len(results),
        )
        return results

    except (ValueError, PermissionError, RuntimeError):
        raise
    except httpx.TimeoutException:
        logger.error("Places API timeout for keyword='%s'", keyword)
        raise RuntimeError("Places API request timed out")
    except httpx.HTTPStatusError as e:
        logger.error("Places API HTTP error: %s %s", e.response.status_code, e.response.text)
        raise RuntimeError(f"Places API error: {e.response.status_code}")
    except Exception as e:
        logger.error("Places API unexpected error: %s", str(e))
        raise


async def search_nearby(
    latitude: float,
    longitude: float,
    radius: int,
    included_types: list[str],
    max_results: int = 20,
) -> list[PlaceResult]:
    """
    ค้นหาสถานที่ใกล้เคียงด้วย Google Places Nearby Search API (New)
    ใช้สำหรับ category preset search ที่กำหนด includedTypes ตรง ๆ
    Return: list of PlaceResult
    """
    if not settings.google_places_api_key:
        raise ValueError("GOOGLE_PLACES_API_KEY is not configured")

    payload = {
        "locationRestriction": {
            "circle": {
                "center": {"latitude": latitude, "longitude": longitude},
                "radius": float(radius),
            }
        },
        "includedTypes": included_types[:50],  # API รองรับสูงสุด 50 types
        "maxResultCount": min(max_results, 20),
        "languageCode": "th",
        "regionCode": "TH",
    }

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": settings.google_places_api_key,
        "X-Goog-FieldMask": FIELD_MASK,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(PLACES_NEARBY_URL, headers=headers, json=payload)

            if response.status_code == 400:
                logger.error("Places Nearby API bad request: %s", response.text)
                raise ValueError(f"Bad request to Places Nearby API: {response.text}")

            if response.status_code in (401, 403):
                raise PermissionError("Invalid or unauthorized Google Places API key")

            if response.status_code == 429:
                raise RuntimeError("Google Places API rate limit exceeded")

            response.raise_for_status()

        data = response.json()
        places_raw = data.get("places", [])

        results = [_parse_place(p) for p in places_raw]
        logger.info(
            "Places Nearby | types=%s | lat=%.4f | lng=%.4f | radius=%dm | found=%d",
            included_types,
            latitude,
            longitude,
            radius,
            len(results),
        )
        return results

    except (ValueError, PermissionError, RuntimeError):
        raise
    except httpx.TimeoutException:
        logger.error("Places Nearby API timeout")
        raise RuntimeError("Places API request timed out")
    except httpx.HTTPStatusError as e:
        logger.error("Places Nearby HTTP error: %s %s", e.response.status_code, e.response.text)
        raise RuntimeError(f"Places API error: {e.response.status_code}")
    except Exception as e:
        logger.error("Places Nearby unexpected error: %s", str(e))
        raise


async def get_place_details(place_id: str) -> Optional[PlaceResult]:
    """
    ดึงรายละเอียดของสถานที่จาก place_id
    Return: PlaceResult หรือ None
    """
    if not settings.google_places_api_key:
        raise ValueError("GOOGLE_PLACES_API_KEY is not configured")

    url = PLACES_DETAILS_URL.format(place_id=place_id)
    headers = {
        "X-Goog-Api-Key": settings.google_places_api_key,
        "X-Goog-FieldMask": DETAILS_FIELD_MASK,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)

            if response.status_code == 404:
                logger.warning("Place not found: %s", place_id)
                return None

            if response.status_code == 401 or response.status_code == 403:
                raise PermissionError("Invalid or unauthorized Google Places API key")

            if response.status_code == 429:
                raise RuntimeError("Google Places API rate limit exceeded")

            response.raise_for_status()

        data = response.json()
        result = _parse_place(data)
        logger.info("Place Details | place_id=%s | name=%s", place_id, result.name)
        return result

    except (ValueError, PermissionError, RuntimeError):
        raise
    except httpx.TimeoutException:
        raise RuntimeError("Places API request timed out")
    except httpx.HTTPStatusError as e:
        logger.error("Places Details HTTP error: %s %s", e.response.status_code, e.response.text)
        raise RuntimeError(f"Places API error: {e.response.status_code}")
    except Exception as e:
        logger.error("Places Details unexpected error: %s", str(e))
        raise


def get_preset_keywords(category_preset: str) -> list[str]:
    """Return list of keywords สำหรับ category preset"""
    return CATEGORY_PRESETS.get(category_preset, [])
