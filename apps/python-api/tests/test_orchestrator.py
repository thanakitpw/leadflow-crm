"""
Orchestrator API tests
Full pipeline: search → enrich → score → save
"""

import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, MagicMock, patch


class TestOrchestrate:
    """Orchestrator pipeline tests"""

    @pytest.mark.asyncio
    async def test_orchestrate_basic(self, client: AsyncClient):
        """ควรรัน full pipeline ได้"""
        request = {
            "keyword": "ร้านอาหาร",
            "latitude": 13.7563,
            "longitude": 100.5018,
            "radius": 1000,
            "workspace_id": "workspace_123",
            "auto_enrich": True,
            "auto_score": True,
        }
        with patch("app.services.orchestrator.orchestrator.process_search") as mock_process:
            mock_process.return_value = {
                "total": 5,
                "enriched": 5,
                "scored": 5,
                "saved": 5,
                "from_cache": False,
                "processing_time_ms": 5000,
                "leads": [
                    {
                        "place_id": "place_1",
                        "name": "ร้านอาหาร 1",
                        "email": "contact1@example.com",
                        "score": 75,
                    }
                ],
            }
            response = await client.post("/api/v1/orchestrate", json=request)
            assert response.status_code == 200
            data = response.json()
            assert "total" in data
            assert "enriched" in data
            assert "scored" in data
            assert "saved" in data

    @pytest.mark.asyncio
    async def test_orchestrate_without_enrichment(self, client: AsyncClient):
        """ควรรัน pipeline โดย skip enrichment"""
        request = {
            "keyword": "ร้านอาหาร",
            "latitude": 13.7563,
            "longitude": 100.5018,
            "radius": 1000,
            "workspace_id": "workspace_123",
            "auto_enrich": False,
            "auto_score": True,
        }
        with patch("app.services.orchestrator.orchestrator.process_search") as mock_process:
            mock_process.return_value = {
                "total": 5,
                "enriched": 0,
                "scored": 5,
                "saved": 5,
                "from_cache": False,
                "processing_time_ms": 3000,
                "leads": [],
            }
            response = await client.post("/api/v1/orchestrate", json=request)
            assert response.status_code == 200
            data = response.json()
            assert data["enriched"] == 0

    @pytest.mark.asyncio
    async def test_orchestrate_without_scoring(self, client: AsyncClient):
        """ควรรัน pipeline โดย skip scoring"""
        request = {
            "keyword": "ร้านอาหาร",
            "latitude": 13.7563,
            "longitude": 100.5018,
            "radius": 1000,
            "workspace_id": "workspace_123",
            "auto_enrich": True,
            "auto_score": False,
        }
        with patch("app.services.orchestrator.orchestrator.process_search") as mock_process:
            mock_process.return_value = {
                "total": 5,
                "enriched": 5,
                "scored": 0,
                "saved": 5,
                "from_cache": False,
                "processing_time_ms": 4000,
                "leads": [],
            }
            response = await client.post("/api/v1/orchestrate", json=request)
            assert response.status_code == 200
            data = response.json()
            assert data["scored"] == 0

    @pytest.mark.asyncio
    async def test_orchestrate_cache_hit(self, client: AsyncClient):
        """ควร return cache hit indicator"""
        request = {
            "keyword": "ร้านอาหาร",
            "latitude": 13.7563,
            "longitude": 100.5018,
            "radius": 1000,
            "workspace_id": "workspace_123",
        }
        with patch("app.services.orchestrator.orchestrator.process_search") as mock_process:
            mock_process.return_value = {
                "total": 5,
                "enriched": 5,
                "scored": 5,
                "saved": 0,  # 0 saved if all duplicates
                "from_cache": True,
                "processing_time_ms": 100,
                "leads": [],
            }
            response = await client.post("/api/v1/orchestrate", json=request)
            assert response.status_code == 200
            data = response.json()
            assert data["from_cache"] is True

    @pytest.mark.asyncio
    async def test_orchestrate_missing_keyword(self, client: AsyncClient):
        """ควร return 422 เมื่อ keyword หายไป"""
        request = {
            "latitude": 13.7563,
            "longitude": 100.5018,
            "workspace_id": "workspace_123",
        }
        response = await client.post("/api/v1/orchestrate", json=request)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_orchestrate_missing_coordinates(self, client: AsyncClient):
        """ควร return 422 เมื่อ coordinates หายไป"""
        request = {
            "keyword": "ร้านอาหาร",
            "workspace_id": "workspace_123",
        }
        response = await client.post("/api/v1/orchestrate", json=request)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_orchestrate_invalid_coordinates(self, client: AsyncClient):
        """ควร return 422 เมื่อ coordinates ไม่ valid"""
        request = {
            "keyword": "ร้านอาหาร",
            "latitude": 100.0,  # Must be -90 to 90
            "longitude": 100.5018,
            "workspace_id": "workspace_123",
        }
        response = await client.post("/api/v1/orchestrate", json=request)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_orchestrate_missing_workspace(self, client: AsyncClient):
        """ควร return 422 เมื่อ workspace_id หายไป"""
        request = {
            "keyword": "ร้านอาหาร",
            "latitude": 13.7563,
            "longitude": 100.5018,
        }
        response = await client.post("/api/v1/orchestrate", json=request)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_orchestrate_validation_error(self, client: AsyncClient):
        """ควร return 400 สำหรับ validation error"""
        with patch("app.services.orchestrator.orchestrator.process_search") as mock_process:
            mock_process.side_effect = ValueError("Invalid input")
            request = {
                "keyword": "ร้านอาหาร",
                "latitude": 13.7563,
                "longitude": 100.5018,
                "radius": 1000,
                "workspace_id": "workspace_123",
            }
            response = await client.post("/api/v1/orchestrate", json=request)
            assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_orchestrate_auth_error(self, client: AsyncClient):
        """ควร return 401 สำหรับ auth error"""
        with patch("app.services.orchestrator.orchestrator.process_search") as mock_process:
            mock_process.side_effect = PermissionError("Invalid API key")
            request = {
                "keyword": "ร้านอาหาร",
                "latitude": 13.7563,
                "longitude": 100.5018,
                "radius": 1000,
                "workspace_id": "workspace_123",
            }
            response = await client.post("/api/v1/orchestrate", json=request)
            assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_orchestrate_rate_limit(self, client: AsyncClient):
        """ควร return 503 สำหรับ rate limit error"""
        with patch("app.services.orchestrator.orchestrator.process_search") as mock_process:
            mock_process.side_effect = RuntimeError("Rate limit exceeded")
            request = {
                "keyword": "ร้านอาหาร",
                "latitude": 13.7563,
                "longitude": 100.5018,
                "radius": 1000,
                "workspace_id": "workspace_123",
            }
            response = await client.post("/api/v1/orchestrate", json=request)
            assert response.status_code == 503

    @pytest.mark.asyncio
    async def test_orchestrate_default_radius(self, client: AsyncClient):
        """ควร default radius เป็น 1000m"""
        request = {
            "keyword": "ร้านอาหาร",
            "latitude": 13.7563,
            "longitude": 100.5018,
            "workspace_id": "workspace_123",
        }
        with patch("app.services.orchestrator.orchestrator.process_search") as mock_process:
            mock_process.return_value = {
                "total": 0,
                "enriched": 0,
                "scored": 0,
                "saved": 0,
                "from_cache": False,
                "processing_time_ms": 0,
                "leads": [],
            }
            response = await client.post("/api/v1/orchestrate", json=request)
            assert response.status_code == 200
            # Verify default radius was used
            call_kwargs = mock_process.call_args[1]
            assert call_kwargs.get("radius") == 1000

    @pytest.mark.asyncio
    async def test_orchestrate_default_flags(self, client: AsyncClient):
        """ควร default auto_enrich และ auto_score เป็น True"""
        request = {
            "keyword": "ร้านอาหาร",
            "latitude": 13.7563,
            "longitude": 100.5018,
            "workspace_id": "workspace_123",
        }
        with patch("app.services.orchestrator.orchestrator.process_search") as mock_process:
            mock_process.return_value = {
                "total": 0,
                "enriched": 0,
                "scored": 0,
                "saved": 0,
                "from_cache": False,
                "processing_time_ms": 0,
                "leads": [],
            }
            response = await client.post("/api/v1/orchestrate", json=request)
            assert response.status_code == 200
            # Verify default flags
            call_kwargs = mock_process.call_args[1]
            assert call_kwargs.get("auto_enrich") is True
            assert call_kwargs.get("auto_score") is True

    @pytest.mark.asyncio
    async def test_orchestrate_with_category(self, client: AsyncClient):
        """ควรส่ง category parameter ได้"""
        request = {
            "keyword": "ร้านอาหาร",
            "latitude": 13.7563,
            "longitude": 100.5018,
            "radius": 1000,
            "workspace_id": "workspace_123",
            "category": "fnb",
        }
        with patch("app.services.orchestrator.orchestrator.process_search") as mock_process:
            mock_process.return_value = {
                "total": 0,
                "enriched": 0,
                "scored": 0,
                "saved": 0,
                "from_cache": False,
                "processing_time_ms": 0,
                "leads": [],
            }
            response = await client.post("/api/v1/orchestrate", json=request)
            assert response.status_code == 200
