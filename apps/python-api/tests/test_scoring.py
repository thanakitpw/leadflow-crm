"""
Lead Scoring API tests
ทดสอบ Claude AI lead scoring — single score, batch score
"""

import pytest
import json
from httpx import AsyncClient
from unittest.mock import AsyncMock, MagicMock, patch


class TestSingleScore:
    """Single lead scoring tests"""

    @pytest.mark.asyncio
    async def test_score_single_lead(self, client: AsyncClient, sample_lead_for_scoring):
        """ควรให้คะแนน lead เดียว"""
        request_body = {
            "lead": {
                "id": sample_lead_for_scoring["id"],
                "name": sample_lead_for_scoring["name"],
                "rating": sample_lead_for_scoring["rating"],
                "review_count": sample_lead_for_scoring["review_count"],
                "website": sample_lead_for_scoring["website"],
                "email": sample_lead_for_scoring["email"],
                "phone": sample_lead_for_scoring["phone"],
                "category": sample_lead_for_scoring["category"],
                "address": sample_lead_for_scoring["address"],
            }
        }
        response = await client.post("/api/v1/scoring/score", json=request_body)
        assert response.status_code == 200
        data = response.json()
        assert "result" in data
        result = data["result"]
        assert "lead_id" in result
        assert "score" in result
        assert "reasoning" in result
        assert 0 <= result["score"] <= 100

    @pytest.mark.asyncio
    async def test_score_returns_integer(self, client: AsyncClient, sample_lead_for_scoring):
        """ควร return score เป็น integer 0-100"""
        request_body = {
            "lead": {
                "id": sample_lead_for_scoring["id"],
                "name": sample_lead_for_scoring["name"],
                "rating": sample_lead_for_scoring["rating"],
                "review_count": sample_lead_for_scoring["review_count"],
                "website": sample_lead_for_scoring["website"],
                "email": sample_lead_for_scoring["email"],
                "phone": sample_lead_for_scoring["phone"],
                "category": sample_lead_for_scoring["category"],
            }
        }
        response = await client.post("/api/v1/scoring/score", json=request_body)
        assert response.status_code == 200
        data = response.json()
        result = data["result"]
        assert isinstance(result["score"], int)
        assert 0 <= result["score"] <= 100

    @pytest.mark.asyncio
    async def test_score_returns_thai_reasoning(self, client: AsyncClient, sample_lead_for_scoring):
        """ควร return reasoning เป็นภาษาไทย"""
        request_body = {
            "lead": {
                "id": sample_lead_for_scoring["id"],
                "name": sample_lead_for_scoring["name"],
                "rating": sample_lead_for_scoring["rating"],
                "review_count": sample_lead_for_scoring["review_count"],
                "website": sample_lead_for_scoring["website"],
                "email": sample_lead_for_scoring["email"],
            }
        }
        response = await client.post("/api/v1/scoring/score", json=request_body)
        assert response.status_code == 200
        data = response.json()
        result = data["result"]
        assert isinstance(result["reasoning"], str)
        assert len(result["reasoning"]) > 0

    @pytest.mark.asyncio
    async def test_score_minimal_data(self, client: AsyncClient):
        """ควรให้คะแนนได้แม้มีข้อมูล minimal"""
        request_body = {
            "lead": {
                "id": "lead_minimal",
                "name": "ร้านน้อย",
            }
        }
        response = await client.post("/api/v1/scoring/score", json=request_body)
        assert response.status_code == 200
        data = response.json()
        assert "result" in data
        assert 0 <= data["result"]["score"] <= 100

    @pytest.mark.asyncio
    async def test_score_full_data(self, client: AsyncClient, sample_lead_for_scoring):
        """ควรให้คะแนนได้เมื่อมีข้อมูลครบถ้วน"""
        request_body = {"lead": sample_lead_for_scoring}
        response = await client.post("/api/v1/scoring/score", json=request_body)
        assert response.status_code == 200
        data = response.json()
        assert "result" in data
        assert 0 <= data["result"]["score"] <= 100

    @pytest.mark.asyncio
    async def test_score_rating_validation(self, client: AsyncClient):
        """ควรค้นหาข้อมูล rating ที่ valid (0-5)"""
        # Rating น้อยเกินไป
        request_body = {
            "lead": {
                "id": "lead_invalid",
                "name": "Test",
                "rating": -1,
            }
        }
        response = await client.post("/api/v1/scoring/score", json=request_body)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_score_review_count_validation(self, client: AsyncClient):
        """ควรค้นหา review_count ที่ >= 0"""
        request_body = {
            "lead": {
                "id": "lead_invalid",
                "name": "Test",
                "review_count": -5,
            }
        }
        response = await client.post("/api/v1/scoring/score", json=request_body)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_score_without_api_key(self, client: AsyncClient):
        """ควร return score=50 เมื่อไม่มี ANTHROPIC_API_KEY"""
        with patch("app.services.scorer.settings.anthropic_api_key", ""):
            request_body = {
                "lead": {
                    "id": "lead_no_key",
                    "name": "Test Business",
                }
            }
            response = await client.post("/api/v1/scoring/score", json=request_body)
            # Without API key, service should return default score
            assert response.status_code == 200
            data = response.json()
            # Default score = 50 when no API key
            assert data["result"]["score"] == 50

    @pytest.mark.asyncio
    async def test_score_missing_lead_field(self, client: AsyncClient):
        """ควร return 422 เมื่อ lead field หายไป"""
        request_body = {}
        response = await client.post("/api/v1/scoring/score", json=request_body)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_score_missing_lead_id(self, client: AsyncClient):
        """ควร return 422 เมื่อ lead.id หายไป"""
        request_body = {
            "lead": {
                "name": "Test",
            }
        }
        response = await client.post("/api/v1/scoring/score", json=request_body)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_score_missing_lead_name(self, client: AsyncClient):
        """ควร return 422 เมื่อ lead.name หายไป"""
        request_body = {
            "lead": {
                "id": "lead_test",
            }
        }
        response = await client.post("/api/v1/scoring/score", json=request_body)
        assert response.status_code == 422


class TestBatchScore:
    """Batch lead scoring tests"""

    @pytest.mark.asyncio
    async def test_batch_score_multiple_leads(
        self, client: AsyncClient, sample_lead_for_scoring
    ):
        """ควรให้คะแนนหลาย leads พร้อมกัน"""
        leads = [
            {
                "id": f"lead_{i}",
                "name": f"ธุรกิจ {i}",
                "rating": 4.0 + (i * 0.1),
                "review_count": 50 * (i + 1),
            }
            for i in range(3)
        ]
        request_body = {"leads": leads}
        response = await client.post("/api/v1/scoring/score-batch", json=request_body)
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) == 3

    @pytest.mark.asyncio
    async def test_batch_score_max_10_leads(self, client: AsyncClient):
        """ควรจำกัด batch ไม่เกิน 10 leads"""
        leads = [
            {
                "id": f"lead_{i}",
                "name": f"ธุรกิจ {i}",
            }
            for i in range(11)
        ]
        request_body = {"leads": leads}
        response = await client.post("/api/v1/scoring/score-batch", json=request_body)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_batch_score_empty_leads(self, client: AsyncClient):
        """ควร return 422 เมื่อ leads เป็น empty"""
        request_body = {"leads": []}
        response = await client.post("/api/v1/scoring/score-batch", json=request_body)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_batch_score_single_lead(self, client: AsyncClient, sample_lead_for_scoring):
        """ควรจัดการ batch ที่มี 1 lead ได้"""
        request_body = {"leads": [sample_lead_for_scoring]}
        response = await client.post("/api/v1/scoring/score-batch", json=request_body)
        assert response.status_code == 200
        data = response.json()
        assert len(data["results"]) == 1

    @pytest.mark.asyncio
    async def test_batch_score_returns_results_count(self, client: AsyncClient):
        """ควร return results เท่ากับจำนวน leads ที่ส่งเข้ามา"""
        leads = [
            {"id": f"lead_{i}", "name": f"ธุรกิจ {i}"}
            for i in range(5)
        ]
        request_body = {"leads": leads}
        response = await client.post("/api/v1/scoring/score-batch", json=request_body)
        assert response.status_code == 200
        data = response.json()
        assert len(data["results"]) == 5

    @pytest.mark.asyncio
    async def test_batch_score_result_format(self, client: AsyncClient):
        """ควร return results ในรูปแบบที่ถูกต้อง"""
        leads = [
            {"id": "lead_1", "name": "ธุรกิจ 1"},
            {"id": "lead_2", "name": "ธุรกิจ 2"},
        ]
        request_body = {"leads": leads}
        response = await client.post("/api/v1/scoring/score-batch", json=request_body)
        assert response.status_code == 200
        data = response.json()
        for result in data["results"]:
            assert "lead_id" in result
            assert "score" in result
            assert "reasoning" in result
            assert 0 <= result["score"] <= 100

    @pytest.mark.asyncio
    async def test_batch_score_preserves_lead_order(self, client: AsyncClient):
        """ควร preserve ลำดับของ leads ที่ส่งเข้ามา"""
        leads = [
            {"id": "lead_A", "name": "ธุรกิจ A"},
            {"id": "lead_B", "name": "ธุรกิจ B"},
            {"id": "lead_C", "name": "ธุรกิจ C"},
        ]
        request_body = {"leads": leads}
        response = await client.post("/api/v1/scoring/score-batch", json=request_body)
        assert response.status_code == 200
        data = response.json()
        result_ids = [r["lead_id"] for r in data["results"]]
        assert result_ids == ["lead_A", "lead_B", "lead_C"]

    @pytest.mark.asyncio
    async def test_batch_score_invalid_lead_in_batch(self, client: AsyncClient):
        """ควร return 422 เมื่อ lead ในชุดไม่ valid"""
        leads = [
            {"id": "lead_1", "name": "ธุรกิจ 1"},
            {"id": "lead_2"},  # Missing name
        ]
        request_body = {"leads": leads}
        response = await client.post("/api/v1/scoring/score-batch", json=request_body)
        assert response.status_code == 422
