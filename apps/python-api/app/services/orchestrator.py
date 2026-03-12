"""
Lead Orchestrator Service
ประสาน Lead Finder + Enrichment + Scoring เป็น full pipeline:

  1. Search Places API (with cache)
  2. สำหรับ leads ที่มี website → find email (parallel, Semaphore(3))
  3. Score ทุก leads แบบ batch
  4. บันทึก leads + lead_scores ลง Supabase
  5. Return enriched results
"""

import asyncio
import logging
import time
from typing import Any, Optional

from app.schemas.orchestrator import EnrichedLead, OrchestrationResponse
from app.schemas.places import PlaceResult
from app.services import cache as cache_service
from app.services import email_finder as email_finder_service
from app.services import places as places_service
from app.services import scorer as scorer_service
from app.services.supabase_client import supabase

logger = logging.getLogger(__name__)

# จำกัด concurrent email enrichment ไม่เกิน 3 พร้อมกัน
_ENRICH_SEMAPHORE = asyncio.Semaphore(3)

# Timeout สำหรับ enrichment phase (วินาที)
_ENRICH_TIMEOUT_SECONDS = 30


class LeadOrchestrator:
    """Orchestrator Agent สำหรับ full lead generation pipeline"""

    async def process_search(
        self,
        keyword: str,
        latitude: float,
        longitude: float,
        radius: int,
        workspace_id: str,
        category: Optional[str] = None,
        auto_enrich: bool = True,
        auto_score: bool = True,
    ) -> OrchestrationResponse:
        """
        Full pipeline:
        1. Search Places API (with cache)
        2. สำหรับแต่ละ lead ที่มี website → find email (parallel)
        3. Score ทุก leads (batch)
        4. บันทึกผลลัพธ์ลง Supabase (leads + lead_scores)
        5. Return enriched results

        Args:
            keyword: คำค้นหา เช่น "ร้านอาหาร", "คาเฟ่"
            latitude: ละติจูด
            longitude: ลองจิจูด
            radius: รัศมีค้นหา (เมตร)
            workspace_id: UUID ของ workspace (multi-tenant)
            category: ประเภทธุรกิจ (optional)
            auto_enrich: ค้นหา email จาก website หรือไม่
            auto_score: ให้คะแนน lead ด้วย AI หรือไม่

        Returns:
            OrchestrationResponse พร้อม enriched leads และ stats
        """
        start_time = time.monotonic()
        logger.info(
            "Orchestrator เริ่ม | keyword='%s' | lat=%.4f | lng=%.4f | "
            "radius=%dm | workspace=%s | enrich=%s | score=%s",
            keyword,
            latitude,
            longitude,
            radius,
            workspace_id,
            auto_enrich,
            auto_score,
        )

        # --- Step 1: Search Places API (with cache) ---
        places, from_cache = await self._search_places_cached(
            keyword=keyword,
            latitude=latitude,
            longitude=longitude,
            radius=radius,
        )

        if not places:
            elapsed_ms = int((time.monotonic() - start_time) * 1000)
            logger.warning(
                "Orchestrator | ไม่พบ places | keyword='%s' | elapsed=%dms",
                keyword,
                elapsed_ms,
            )
            return OrchestrationResponse(
                leads=[],
                total=0,
                enriched=0,
                scored=0,
                saved=0,
                from_cache=from_cache,
                processing_time_ms=elapsed_ms,
            )

        logger.info(
            "Step 1 เสร็จ | พบ %d places | from_cache=%s",
            len(places),
            from_cache,
        )

        # --- Step 2: Email Enrichment (parallel, timeout 30s) ---
        # email_map: { place_id: EmailResult | None }
        email_map: dict[str, Any] = {}
        if auto_enrich:
            email_map = await self._enrich_emails(places)
            enriched_count = sum(1 for v in email_map.values() if v is not None)
            logger.info("Step 2 เสร็จ | enriched=%d/%d", enriched_count, len(places))
        else:
            enriched_count = 0

        # --- Step 3: Lead Scoring (batch) ---
        score_map: dict[str, dict[str, Any]] = {}
        if auto_score:
            score_map = await self._score_leads(places, email_map)
            scored_count = sum(
                1 for v in score_map.values() if not v.get("error")
            )
            logger.info("Step 3 เสร็จ | scored=%d/%d", scored_count, len(places))
        else:
            scored_count = 0

        # --- Step 4: บันทึกลง Supabase ---
        saved_lead_ids = await self._save_leads(
            places=places,
            workspace_id=workspace_id,
            keyword=keyword,
            email_map=email_map,
            score_map=score_map,
        )
        saved_count = len(saved_lead_ids)
        logger.info("Step 4 เสร็จ | saved=%d/%d", saved_count, len(places))

        # --- Step 5: Build response ---
        enriched_leads = self._build_response_leads(
            places=places,
            email_map=email_map,
            score_map=score_map,
            saved_lead_ids=saved_lead_ids,
        )

        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        logger.info(
            "Orchestrator เสร็จสิ้น | total=%d | enriched=%d | scored=%d | "
            "saved=%d | elapsed=%dms",
            len(enriched_leads),
            enriched_count,
            scored_count,
            saved_count,
            elapsed_ms,
        )

        return OrchestrationResponse(
            leads=enriched_leads,
            total=len(enriched_leads),
            enriched=enriched_count,
            scored=scored_count,
            saved=saved_count,
            from_cache=from_cache,
            processing_time_ms=elapsed_ms,
        )

    # ------------------------------------------------------------------ #
    # Private methods
    # ------------------------------------------------------------------ #

    async def _search_places_cached(
        self,
        keyword: str,
        latitude: float,
        longitude: float,
        radius: int,
    ) -> tuple[list[PlaceResult], bool]:
        """
        ค้นหา places ด้วย cache layer

        Returns:
            (places, from_cache) — from_cache=True ถ้าได้จาก cache
        """
        cache_key = cache_service.build_cache_key(
            keyword=keyword,
            latitude=latitude,
            longitude=longitude,
            radius=radius,
        )

        # ลอง cache ก่อน
        cached_data = await cache_service.get_cached(cache_key)
        if cached_data is not None:
            places = [PlaceResult(**item) for item in cached_data]
            return places, True

        # MISS — เรียก Places API
        try:
            places = await places_service.search_places(
                keyword=keyword,
                latitude=latitude,
                longitude=longitude,
                radius=radius,
            )
        except Exception as e:
            logger.error("Places API error: %s", str(e))
            return [], False

        # บันทึก cache แบบ non-blocking
        if places:
            asyncio.create_task(
                cache_service.set_cache(
                    cache_key=cache_key,
                    search_type="search",
                    results=[p.model_dump() for p in places],
                    ttl_days=cache_service.SEARCH_TTL_DAYS,
                )
            )

        return places, False

    async def _enrich_single(
        self,
        place: PlaceResult,
    ) -> tuple[str, Any]:
        """
        หา email จาก website ของ place เดียว
        ใช้ Semaphore เพื่อจำกัด concurrent requests

        Returns:
            (place_id, EmailResult | None)
        """
        if not place.website:
            return place.place_id, None

        async with _ENRICH_SEMAPHORE:
            try:
                results = await email_finder_service.find_emails(
                    website_url=place.website,
                    business_name=place.name,
                )
                # เอา email ที่ confidence สูงสุด
                best = results[0] if results else None
                logger.debug(
                    "Enrich | %s | email=%s | confidence=%s",
                    place.name,
                    best.email if best else None,
                    best.confidence if best else None,
                )
                return place.place_id, best
            except Exception as e:
                logger.warning(
                    "Email enrichment ล้มเหลวสำหรับ %s (%s): %s",
                    place.name,
                    place.website,
                    str(e),
                )
                return place.place_id, None

    async def _enrich_emails(
        self,
        places: list[PlaceResult],
    ) -> dict[str, Any]:
        """
        หา email แบบ parallel สำหรับ places ที่มี website
        มี timeout รวม 30 วินาที — ถ้า timeout return partial results

        Returns:
            dict { place_id: EmailResult | None }
        """
        # เฉพาะ places ที่มี website
        places_with_website = [p for p in places if p.website]
        places_without_website = [p for p in places if not p.website]

        email_map: dict[str, Any] = {p.place_id: None for p in places_without_website}

        if not places_with_website:
            return email_map

        tasks = [self._enrich_single(p) for p in places_with_website]

        try:
            results = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=_ENRICH_TIMEOUT_SECONDS,
            )

            for result in results:
                if isinstance(result, Exception):
                    logger.warning("Enrichment task error: %s", str(result))
                    continue
                place_id, email_result = result
                email_map[place_id] = email_result

        except asyncio.TimeoutError:
            logger.warning(
                "Enrichment timeout หลังจาก %ds — ใช้ partial results",
                _ENRICH_TIMEOUT_SECONDS,
            )
            # ใส่ None สำหรับ places ที่ยังไม่ได้รับผล
            for place in places_with_website:
                if place.place_id not in email_map:
                    email_map[place.place_id] = None

        return email_map

    async def _score_leads(
        self,
        places: list[PlaceResult],
        email_map: dict[str, Any],
    ) -> dict[str, dict[str, Any]]:
        """
        Score leads ทั้งหมดด้วย batch scoring

        Returns:
            dict { place_id: { score, reasoning, error? } }
        """
        # สร้าง lead_data list สำหรับส่งให้ scorer
        lead_data_list = []
        for place in places:
            email_result = email_map.get(place.place_id)
            lead_data_list.append({
                "id": place.place_id,
                "name": place.name,
                "website": place.website,
                "email": email_result.email if email_result else None,
                "phone": place.phone,
                "rating": place.rating,
                "reviews_count": place.reviews_count,
                "category": place.category,
                "address": place.address,
            })

        try:
            batch_results = await scorer_service.score_leads_batch(lead_data_list)
        except Exception as e:
            logger.error("Batch scoring เกิดข้อผิดพลาด: %s", str(e))
            # return default scores ทั้งหมด
            return {
                place.place_id: {
                    "score": 0,
                    "reasoning": f"ไม่สามารถให้คะแนนได้: {str(e)}",
                    "error": True,
                }
                for place in places
            }

        # map กลับด้วย place_id (ใช้ index เป็น key)
        score_map: dict[str, dict[str, Any]] = {}
        for result in batch_results:
            idx = result.get("lead_index", 0)
            if 0 <= idx < len(places):
                place_id = places[idx].place_id
                score_map[place_id] = {
                    "score": result.get("score", 0),
                    "reasoning": result.get("reasoning", ""),
                    **({"error": True} if result.get("error") else {}),
                }

        return score_map

    async def _save_leads(
        self,
        places: list[PlaceResult],
        workspace_id: str,
        keyword: str,
        email_map: dict[str, Any],
        score_map: dict[str, dict[str, Any]],
    ) -> dict[str, str]:
        """
        บันทึก leads และ lead_scores ลง Supabase

        Logic:
        - INSERT leads ด้วย ON CONFLICT (place_id, workspace_id) DO NOTHING
        - INSERT lead_scores สำหรับแต่ละ lead ที่ save สำเร็จ

        Returns:
            dict { place_id: lead_id (UUID) } สำหรับ leads ที่ save สำเร็จ
        """
        saved_lead_ids: dict[str, str] = {}

        for place in places:
            email_result = email_map.get(place.place_id)
            score_data = score_map.get(place.place_id)

            # สร้าง lead payload
            lead_payload: dict[str, Any] = {
                "workspace_id": workspace_id,
                "name": place.name,
                "address": place.address,
                "phone": place.phone,
                "website": place.website,
                "place_id": place.place_id,
                "latitude": place.latitude,
                "longitude": place.longitude,
                "rating": place.rating,
                "review_count": place.reviews_count,
                "category": place.category or keyword,
                "source_type": "places_api",
            }

            # เพิ่ม email ถ้าหาได้
            if email_result:
                lead_payload["email"] = email_result.email

            # Upsert lead (skip ถ้า place_id + workspace_id ซ้ำ)
            try:
                saved_rows = await supabase.upsert(
                    table="leads",
                    data=lead_payload,
                    on_conflict="place_id,workspace_id",
                    returning=True,
                )

                if not saved_rows:
                    logger.debug(
                        "Lead ซ้ำ — skip | place_id=%s | workspace=%s",
                        place.place_id,
                        workspace_id,
                    )
                    continue

                lead_id = saved_rows[0].get("id")
                if not lead_id:
                    logger.warning(
                        "Lead save ไม่มี id กลับมา | place_id=%s", place.place_id
                    )
                    continue

                saved_lead_ids[place.place_id] = lead_id

                # Insert lead_score ถ้ามีข้อมูล score
                if score_data and not score_data.get("error"):
                    score_payload = {
                        "lead_id": lead_id,
                        "score": score_data["score"],
                        "reasoning": score_data.get("reasoning", ""),
                    }
                    await supabase.upsert(
                        table="lead_scores",
                        data=score_payload,
                        on_conflict="lead_id",
                        returning=False,
                    )

            except Exception as e:
                logger.error(
                    "ไม่สามารถ save lead | place_id=%s | name=%s | error=%s",
                    place.place_id,
                    place.name,
                    str(e),
                )
                continue

        return saved_lead_ids

    def _build_response_leads(
        self,
        places: list[PlaceResult],
        email_map: dict[str, Any],
        score_map: dict[str, dict[str, Any]],
        saved_lead_ids: dict[str, str],
    ) -> list[EnrichedLead]:
        """
        รวมข้อมูลทุก step เป็น list ของ EnrichedLead สำหรับ response

        Returns:
            list of EnrichedLead เรียงตาม score (สูงสุดก่อน)
        """
        enriched: list[EnrichedLead] = []

        for place in places:
            email_result = email_map.get(place.place_id)
            score_data = score_map.get(place.place_id)
            lead_id = saved_lead_ids.get(place.place_id)

            lead = EnrichedLead(
                place_id=place.place_id,
                name=place.name,
                address=place.address,
                phone=place.phone,
                website=place.website,
                email=email_result.email if email_result else None,
                email_confidence=float(email_result.confidence) if email_result else None,
                rating=place.rating,
                review_count=place.reviews_count,
                category=place.category,
                score=score_data["score"] if score_data and not score_data.get("error") else None,
                score_reasoning=score_data.get("reasoning") if score_data else None,
                lead_id=lead_id,
            )
            enriched.append(lead)

        # เรียงตาม score (สูงสุดก่อน) — None score อยู่ท้าย
        enriched.sort(key=lambda x: x.score if x.score is not None else -1, reverse=True)
        return enriched


# Singleton instance
orchestrator = LeadOrchestrator()
