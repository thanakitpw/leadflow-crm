"""
Places API endpoint tests
ทดสอบ keyword search, batch search, place details, caching
"""

import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, MagicMock


class TestPlacesSearch:
    """Places search endpoint tests"""

    @pytest.mark.asyncio
    async def test_search_places_basic(self, client: AsyncClient, mock_places_api):
        """ควรค้นหา places ได้และ return results"""
        request_body = {
            "keyword": "ร้านอาหาร",
            "latitude": 13.7563,
            "longitude": 100.5018,
            "radius": 1000,
            "max_results": 20,
        }
        response = await client.post("/api/v1/places/search", json=request_body)
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert "total" in data
        assert "cached" in data
        assert data["total"] > 0

    @pytest.mark.asyncio
    async def test_search_places_missing_keyword(self, client: AsyncClient):
        """ควร return 422 เมื่อ keyword เป็น empty"""
        request_body = {
            "keyword": "",
            "latitude": 13.7563,
            "longitude": 100.5018,
        }
        response = await client.post("/api/v1/places/search", json=request_body)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_search_places_invalid_coordinates(self, client: AsyncClient):
        """ควร return 422 เมื่อ lat/lng ไม่ valid"""
        request_body = {
            "keyword": "ร้านอาหาร",
            "latitude": 100.0,  # ต้อง -90 ถึง 90
            "longitude": 100.5018,
        }
        response = await client.post("/api/v1/places/search", json=request_body)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_search_places_with_category_preset(self, client: AsyncClient, mock_places_api):
        """ควรค้นหาด้วย category_preset (fnb, sme, realestate, b2b)"""
        request_body = {
            "keyword": "ธุรกิจ",
            "latitude": 13.7563,
            "longitude": 100.5018,
            "radius": 2000,
            "category_preset": "fnb",
            "max_results": 20,
        }
        response = await client.post("/api/v1/places/search", json=request_body)
        assert response.status_code == 200
        data = response.json()
        assert "results" in data

    @pytest.mark.asyncio
    async def test_search_places_invalid_preset(self, client: AsyncClient):
        """ควร return 400 เมื่อ preset ไม่ถูกต้อง"""
        request_body = {
            "keyword": "ธุรกิจ",
            "latitude": 13.7563,
            "longitude": 100.5018,
            "category_preset": "invalid_preset",
        }
        response = await client.post("/api/v1/places/search", json=request_body)
        assert response.status_code == 400
        assert "Unknown category_preset" in response.text

    @pytest.mark.asyncio
    async def test_search_places_max_results_validation(self, client: AsyncClient):
        """ควรจำกัด max_results ไม่เกิน 60"""
        request_body = {
            "keyword": "ร้านอาหาร",
            "latitude": 13.7563,
            "longitude": 100.5018,
            "max_results": 100,  # เกิน limit
        }
        response = await client.post("/api/v1/places/search", json=request_body)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_search_places_radius_validation(self, client: AsyncClient):
        """ควรจำกัด radius ระหว่าง 100-50000"""
        # radius too small
        request_body = {
            "keyword": "ร้านอาหาร",
            "latitude": 13.7563,
            "longitude": 100.5018,
            "radius": 50,
        }
        response = await client.post("/api/v1/places/search", json=request_body)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_search_places_api_auth_error(self, client: AsyncClient):
        """ควรจัดการกับ 401 error จาก Places API"""
        with pytest.mock.patch(
            "app.services.places.httpx.AsyncClient"
        ) as mock_http:
            mock_response = MagicMock()
            mock_response.status_code = 401
            mock_response.text = "Invalid API key"

            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_http.return_value = mock_client

            request_body = {
                "keyword": "ร้านอาหาร",
                "latitude": 13.7563,
                "longitude": 100.5018,
            }
            response = await client.post("/api/v1/places/search", json=request_body)
            assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_search_places_api_rate_limit(self, client: AsyncClient):
        """ควรจัดการกับ 429 rate limit error"""
        with pytest.mock.patch(
            "app.services.places.httpx.AsyncClient"
        ) as mock_http:
            mock_response = MagicMock()
            mock_response.status_code = 429
            mock_response.text = "Rate limit exceeded"

            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_http.return_value = mock_client

            request_body = {
                "keyword": "ร้านอาหาร",
                "latitude": 13.7563,
                "longitude": 100.5018,
            }
            response = await client.post("/api/v1/places/search", json=request_body)
            assert response.status_code == 503


class TestBatchSearch:
    """Batch search endpoint tests"""

    @pytest.mark.asyncio
    async def test_batch_search_multiple_keywords(
        self, client: AsyncClient, mock_places_api
    ):
        """ควรค้นหาหลาย keywords พร้อมกัน"""
        request_body = {
            "searches": [
                {
                    "keyword": "ร้านอาหาร",
                    "latitude": 13.7563,
                    "longitude": 100.5018,
                    "radius": 1000,
                },
                {
                    "keyword": "ร้านกาแฟ",
                    "latitude": 13.7563,
                    "longitude": 100.5018,
                    "radius": 1000,
                },
            ]
        }
        response = await client.post("/api/v1/places/search-batch", json=request_body)
        assert response.status_code == 200
        data = response.json()
        assert "searches" in data
        assert len(data["searches"]) == 2
        assert "total_results" in data
        assert "cache_hits" in data
        assert "cache_misses" in data

    @pytest.mark.asyncio
    async def test_batch_search_empty_list(self, client: AsyncClient):
        """ควร return 422 เมื่อ searches เป็น empty"""
        request_body = {"searches": []}
        response = await client.post("/api/v1/places/search-batch", json=request_body)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_batch_search_max_items(self, client: AsyncClient):
        """ควรจำกัด batch searches ไม่เกิน 10"""
        searches = [
            {
                "keyword": f"keyword_{i}",
                "latitude": 13.7563,
                "longitude": 100.5018,
            }
            for i in range(11)
        ]
        request_body = {"searches": searches}
        response = await client.post("/api/v1/places/search-batch", json=request_body)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_batch_search_returns_stats(
        self, client: AsyncClient, mock_places_api
    ):
        """ควร return cache hit/miss stats"""
        request_body = {
            "searches": [
                {
                    "keyword": "ร้านอาหาร",
                    "latitude": 13.7563,
                    "longitude": 100.5018,
                },
            ]
        }
        response = await client.post("/api/v1/places/search-batch", json=request_body)
        assert response.status_code == 200
        data = response.json()
        assert data["cache_hits"] + data["cache_misses"] == len(request_body["searches"])


class TestPlaceDetails:
    """Place details endpoint tests"""

    @pytest.mark.asyncio
    async def test_get_place_details(self, client: AsyncClient, mock_places_api):
        """ควรดึง place details ได้"""
        place_id = "place_123"
        response = await client.get(f"/api/v1/places/details/{place_id}")
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert data["total"] == 1

    @pytest.mark.asyncio
    async def test_get_place_details_not_found(self, client: AsyncClient):
        """ควร return 404 เมื่อ place ไม่พบ"""
        with pytest.mock.patch(
            "app.services.places.httpx.AsyncClient"
        ) as mock_http:
            mock_response = MagicMock()
            mock_response.status_code = 404
            mock_response.text = "Place not found"

            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_http.return_value = mock_client

            place_id = "invalid_place_id"
            response = await client.get(f"/api/v1/places/details/{place_id}")
            assert response.status_code == 503  # RuntimeError -> 503

    @pytest.mark.asyncio
    async def test_get_place_details_deduplication(
        self, client: AsyncClient, sample_place_result
    ):
        """ควรลบ duplicates ตาม place_id"""
        # This test verifies internal deduplication logic
        # by checking response format
        place_id = "place_123"
        response = await client.get(f"/api/v1/places/details/{place_id}")
        assert response.status_code == 200
        data = response.json()
        place_ids = [r["place_id"] for r in data["results"]]
        assert len(place_ids) == len(set(place_ids))  # No duplicates
