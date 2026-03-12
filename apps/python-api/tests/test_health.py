"""
Health check endpoint tests
"""

import pytest
from httpx import AsyncClient


class TestHealth:
    """Health check endpoint tests"""

    @pytest.mark.asyncio
    async def test_health_endpoint_returns_ok(self, client: AsyncClient):
        """ควร return status = ok เมื่อเรียก /health"""
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "leadflow-api"

    @pytest.mark.asyncio
    async def test_root_endpoint(self, client: AsyncClient):
        """Root endpoint ควร return message"""
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "LeadFlow API" in data["message"]
