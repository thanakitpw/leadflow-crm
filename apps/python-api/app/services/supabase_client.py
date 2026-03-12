"""
Supabase REST API Helper
ใช้ httpx async สำหรับ CRUD operations ผ่าน Supabase REST API
ใช้ service_role key — bypass RLS สำหรับ server-side operations
"""

import logging
from typing import Any, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Default timeout (วินาที)
_DEFAULT_TIMEOUT = 15.0


def _build_url(table: str) -> str:
    return f"{settings.supabase_url}/rest/v1/{table}"


def _base_headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }
    if extra:
        headers.update(extra)
    return headers


class SupabaseClient:
    """
    Async wrapper สำหรับ Supabase REST API

    ทุก method return None เมื่อเกิด error แทนการ raise exception
    เพื่อให้ orchestrator จัดการ partial failure ได้เอง
    """

    async def insert(
        self,
        table: str,
        data: dict[str, Any],
        returning: bool = True,
    ) -> Optional[dict[str, Any]]:
        """
        INSERT 1 row ลงตาราง

        Args:
            table: ชื่อ table
            data: dict ของข้อมูลที่จะ insert
            returning: ถ้า True จะ return row ที่ insert ไป (default True)

        Returns:
            dict ของ row ที่ insert หรือ None ถ้าเกิด error
        """
        prefer = "return=representation" if returning else "return=minimal"
        headers = _base_headers({"Prefer": prefer})
        url = _build_url(table)

        try:
            async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
                response = await client.post(url, headers=headers, json=data)
                response.raise_for_status()

            rows = response.json()
            if isinstance(rows, list) and rows:
                return rows[0]
            return None

        except httpx.HTTPStatusError as e:
            logger.error(
                "Supabase INSERT error | table=%s | status=%d | body=%s",
                table,
                e.response.status_code,
                e.response.text[:500],
            )
            return None
        except Exception as e:
            logger.error("Supabase INSERT unexpected error | table=%s | error=%s", table, str(e))
            return None

    async def insert_many(
        self,
        table: str,
        data_list: list[dict[str, Any]],
        returning: bool = True,
        on_conflict: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """
        INSERT หลาย rows พร้อมกัน

        Args:
            table: ชื่อ table
            data_list: list ของ dicts
            returning: ถ้า True จะ return rows ที่ insert ไป
            on_conflict: column name สำหรับ conflict resolution
                         ถ้าระบุจะใช้ upsert (merge-duplicates)

        Returns:
            list ของ rows ที่ insert ได้ หรือ [] ถ้าเกิด error
        """
        if not data_list:
            return []

        prefer_parts = ["return=representation" if returning else "return=minimal"]
        if on_conflict:
            prefer_parts.insert(0, "resolution=merge-duplicates")

        headers = _base_headers({"Prefer": ",".join(prefer_parts)})
        url = _build_url(table)
        params = {}
        if on_conflict:
            params["on_conflict"] = on_conflict

        try:
            async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
                response = await client.post(
                    url, headers=headers, json=data_list, params=params
                )
                response.raise_for_status()

            rows = response.json()
            if isinstance(rows, list):
                return rows
            return []

        except httpx.HTTPStatusError as e:
            logger.error(
                "Supabase INSERT MANY error | table=%s | status=%d | body=%s",
                table,
                e.response.status_code,
                e.response.text[:500],
            )
            return []
        except Exception as e:
            logger.error(
                "Supabase INSERT MANY unexpected error | table=%s | error=%s", table, str(e)
            )
            return []

    async def select(
        self,
        table: str,
        filters: dict[str, str],
        columns: str = "*",
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """
        SELECT rows จากตาราง

        Args:
            table: ชื่อ table
            filters: dict ของ PostgREST filter operators
                     เช่น {"workspace_id": "eq.abc-123", "place_id": "eq.ChIJxxx"}
            columns: columns ที่จะ select (default "*")
            limit: จำนวน rows สูงสุด (default 100)

        Returns:
            list ของ rows หรือ [] ถ้าเกิด error
        """
        headers = _base_headers()
        url = _build_url(table)
        params: dict[str, Any] = {"select": columns, "limit": limit}
        params.update(filters)

        try:
            async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
                response = await client.get(url, headers=headers, params=params)
                response.raise_for_status()

            rows = response.json()
            return rows if isinstance(rows, list) else []

        except httpx.HTTPStatusError as e:
            logger.error(
                "Supabase SELECT error | table=%s | status=%d | body=%s",
                table,
                e.response.status_code,
                e.response.text[:500],
            )
            return []
        except Exception as e:
            logger.error("Supabase SELECT unexpected error | table=%s | error=%s", table, str(e))
            return []

    async def upsert(
        self,
        table: str,
        data: dict[str, Any] | list[dict[str, Any]],
        on_conflict: str,
        returning: bool = True,
    ) -> list[dict[str, Any]]:
        """
        UPSERT (INSERT or UPDATE on conflict)

        Args:
            table: ชื่อ table
            data: dict หรือ list ของ dicts
            on_conflict: column name ที่ใช้ detect conflict (เช่น "place_id,workspace_id")
            returning: ถ้า True จะ return rows ที่ affected

        Returns:
            list ของ rows หรือ [] ถ้าเกิด error
        """
        if isinstance(data, dict):
            data = [data]

        prefer = "resolution=merge-duplicates"
        if returning:
            prefer += ",return=representation"
        else:
            prefer += ",return=minimal"

        headers = _base_headers({"Prefer": prefer})
        url = _build_url(table)
        params = {"on_conflict": on_conflict}

        try:
            async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
                response = await client.post(url, headers=headers, json=data, params=params)
                response.raise_for_status()

            rows = response.json()
            return rows if isinstance(rows, list) else []

        except httpx.HTTPStatusError as e:
            logger.error(
                "Supabase UPSERT error | table=%s | status=%d | body=%s",
                table,
                e.response.status_code,
                e.response.text[:500],
            )
            return []
        except Exception as e:
            logger.error("Supabase UPSERT unexpected error | table=%s | error=%s", table, str(e))
            return []

    async def check_exists(
        self,
        table: str,
        filters: dict[str, str],
    ) -> bool:
        """
        ตรวจสอบว่ามี row ที่ match filter หรือไม่ (HEAD request — ไม่ดึงข้อมูล)

        Args:
            table: ชื่อ table
            filters: dict ของ PostgREST filter operators

        Returns:
            True ถ้าพบ row, False ถ้าไม่พบหรือเกิด error
        """
        headers = _base_headers({"Prefer": "count=exact"})
        url = _build_url(table)
        params: dict[str, Any] = {"select": "id", "limit": 1}
        params.update(filters)

        try:
            async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
                response = await client.get(url, headers=headers, params=params)
                response.raise_for_status()

            rows = response.json()
            return isinstance(rows, list) and len(rows) > 0

        except Exception as e:
            logger.error(
                "Supabase check_exists error | table=%s | error=%s", table, str(e)
            )
            return False


# Singleton instance สำหรับใช้ทั่วทั้ง app
supabase = SupabaseClient()
