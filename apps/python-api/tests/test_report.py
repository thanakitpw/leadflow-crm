"""
Report API tests
HTML report generation
"""

import pytest
from datetime import datetime
from httpx import AsyncClient
from unittest.mock import patch


class TestReportGenerate:
    """Report generation tests"""

    @pytest.mark.asyncio
    async def test_generate_report_basic(self, client: AsyncClient):
        """ควรสร้าง HTML report ได้"""
        request = {
            "workspace_name": "Test Workspace",
            "date_from": "2025-01-01",
            "date_to": "2025-01-31",
            "stats": {
                "total_leads": 100,
                "emails_sent": 50,
                "open_rate": 25.5,
                "click_rate": 10.2,
            },
            "campaigns": [
                {
                    "name": "Campaign 1",
                    "emails_sent": 50,
                    "opens": 15,
                    "clicks": 5,
                }
            ],
            "top_leads": [],
        }
        with patch("app.services.report_generator.generate_report_html") as mock_gen:
            mock_gen.return_value = "<html><body>Report</body></html>"
            response = await client.post("/api/v1/report/generate-html", json=request)
            assert response.status_code == 200
            data = response.json()
            assert "html" in data
            assert "generated_at" in data
            assert "<html>" in data["html"]

    @pytest.mark.asyncio
    async def test_report_invalid_date_format(self, client: AsyncClient):
        """ควร return 422 เมื่อ date format ไม่ถูก"""
        request = {
            "workspace_name": "Test",
            "date_from": "01/01/2025",  # Wrong format
            "date_to": "2025-01-31",
            "stats": {},
            "campaigns": [],
        }
        response = await client.post("/api/v1/report/generate-html", json=request)
        assert response.status_code == 422
        assert "YYYY-MM-DD" in response.text

    @pytest.mark.asyncio
    async def test_report_date_from_greater_than_to(self, client: AsyncClient):
        """ควร return 422 เมื่อ date_from > date_to"""
        request = {
            "workspace_name": "Test",
            "date_from": "2025-01-31",
            "date_to": "2025-01-01",
            "stats": {},
            "campaigns": [],
        }
        response = await client.post("/api/v1/report/generate-html", json=request)
        assert response.status_code == 422
        assert "must not be greater" in response.text or "date_from" in response.text

    @pytest.mark.asyncio
    async def test_report_same_date_range(self, client: AsyncClient):
        """ควร handle same date_from และ date_to"""
        request = {
            "workspace_name": "Test",
            "date_from": "2025-01-15",
            "date_to": "2025-01-15",
            "stats": {"total_leads": 10},
            "campaigns": [],
        }
        with patch("app.services.report_generator.generate_report_html") as mock_gen:
            mock_gen.return_value = "<html></html>"
            response = await client.post("/api/v1/report/generate-html", json=request)
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_report_with_stats(self, client: AsyncClient):
        """ควร include stats ใน report"""
        request = {
            "workspace_name": "Test Workspace",
            "date_from": "2025-01-01",
            "date_to": "2025-01-31",
            "stats": {
                "total_leads": 100,
                "emails_sent": 50,
                "open_rate": 25.5,
                "click_rate": 10.2,
                "bounce_rate": 2.0,
            },
            "campaigns": [],
            "top_leads": [],
        }
        with patch("app.services.report_generator.generate_report_html") as mock_gen:
            mock_gen.return_value = "<html></html>"
            response = await client.post("/api/v1/report/generate-html", json=request)
            assert response.status_code == 200
            mock_gen.assert_called_once()

    @pytest.mark.asyncio
    async def test_report_with_campaigns(self, client: AsyncClient):
        """ควร include campaigns ใน report"""
        request = {
            "workspace_name": "Test",
            "date_from": "2025-01-01",
            "date_to": "2025-01-31",
            "stats": {},
            "campaigns": [
                {
                    "name": "Campaign 1",
                    "emails_sent": 100,
                    "opens": 30,
                    "clicks": 10,
                },
                {
                    "name": "Campaign 2",
                    "emails_sent": 50,
                    "opens": 12,
                    "clicks": 3,
                },
            ],
            "top_leads": [],
        }
        with patch("app.services.report_generator.generate_report_html") as mock_gen:
            mock_gen.return_value = "<html></html>"
            response = await client.post("/api/v1/report/generate-html", json=request)
            assert response.status_code == 200
            # Verify campaigns were passed
            call_args = mock_gen.call_args
            assert len(call_args[1]["campaigns"]) == 2

    @pytest.mark.asyncio
    async def test_report_with_top_leads(self, client: AsyncClient):
        """ควร include top leads ใน report"""
        request = {
            "workspace_name": "Test",
            "date_from": "2025-01-01",
            "date_to": "2025-01-31",
            "stats": {},
            "campaigns": [],
            "top_leads": [
                {
                    "name": "Lead 1",
                    "score": 95,
                    "emails_sent": 5,
                },
                {
                    "name": "Lead 2",
                    "score": 88,
                    "emails_sent": 3,
                },
            ],
        }
        with patch("app.services.report_generator.generate_report_html") as mock_gen:
            mock_gen.return_value = "<html></html>"
            response = await client.post("/api/v1/report/generate-html", json=request)
            assert response.status_code == 200
            # Verify top_leads were passed
            call_args = mock_gen.call_args
            assert len(call_args[1]["top_leads"]) == 2

    @pytest.mark.asyncio
    async def test_report_empty_campaigns(self, client: AsyncClient):
        """ควรจัดการ empty campaigns list"""
        request = {
            "workspace_name": "Test",
            "date_from": "2025-01-01",
            "date_to": "2025-01-31",
            "stats": {"total_leads": 0},
            "campaigns": [],
            "top_leads": [],
        }
        with patch("app.services.report_generator.generate_report_html") as mock_gen:
            mock_gen.return_value = "<html></html>"
            response = await client.post("/api/v1/report/generate-html", json=request)
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_report_generated_at_included(self, client: AsyncClient):
        """ควร include generated_at timestamp"""
        request = {
            "workspace_name": "Test",
            "date_from": "2025-01-01",
            "date_to": "2025-01-31",
            "stats": {},
            "campaigns": [],
        }
        with patch("app.services.report_generator.generate_report_html") as mock_gen:
            mock_gen.return_value = "<html></html>"
            response = await client.post("/api/v1/report/generate-html", json=request)
            assert response.status_code == 200
            data = response.json()
            assert "generated_at" in data
            # Verify it's a valid ISO format timestamp
            assert "T" in data["generated_at"]

    @pytest.mark.asyncio
    async def test_report_500_error_handling(self, client: AsyncClient):
        """ควรจัดการ 500 error อย่างสวยงาม"""
        request = {
            "workspace_name": "Test",
            "date_from": "2025-01-01",
            "date_to": "2025-01-31",
            "stats": {},
            "campaigns": [],
        }
        with patch("app.services.report_generator.generate_report_html") as mock_gen:
            mock_gen.side_effect = Exception("Template error")
            response = await client.post("/api/v1/report/generate-html", json=request)
            assert response.status_code == 500
            data = response.json()
            assert "detail" in data

    @pytest.mark.asyncio
    async def test_report_missing_required_fields(self, client: AsyncClient):
        """ควร return 422 เมื่อ required fields หายไป"""
        request = {
            "workspace_name": "Test",
            # Missing date_from, date_to, etc
        }
        response = await client.post("/api/v1/report/generate-html", json=request)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_report_with_extra_fields(self, client: AsyncClient):
        """ควรจัดการ extra field ได้"""
        request = {
            "workspace_name": "Test",
            "date_from": "2025-01-01",
            "date_to": "2025-01-31",
            "stats": {},
            "campaigns": [],
            "top_leads": [],
            "extra": {"custom_field": "custom_value"},
        }
        with patch("app.services.report_generator.generate_report_html") as mock_gen:
            mock_gen.return_value = "<html></html>"
            response = await client.post("/api/v1/report/generate-html", json=request)
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_report_date_format_yyyy_mm_dd(self, client: AsyncClient):
        """ควรรับ date format YYYY-MM-DD เท่านั้น"""
        valid_formats = [
            ("2025-01-01", "2025-01-31"),
            ("2024-12-15", "2024-12-20"),
            ("2026-03-01", "2026-03-31"),
        ]
        for date_from, date_to in valid_formats:
            request = {
                "workspace_name": "Test",
                "date_from": date_from,
                "date_to": date_to,
                "stats": {},
                "campaigns": [],
            }
            with patch("app.services.report_generator.generate_report_html") as mock_gen:
                mock_gen.return_value = "<html></html>"
                response = await client.post("/api/v1/report/generate-html", json=request)
                assert response.status_code == 200

        invalid_formats = [
            ("1/1/2025", "31/1/2025"),
            ("2025/01/01", "2025/01/31"),
            ("01-01-2025", "01-31-2025"),
        ]
        for date_from, date_to in invalid_formats:
            request = {
                "workspace_name": "Test",
                "date_from": date_from,
                "date_to": date_to,
                "stats": {},
                "campaigns": [],
            }
            response = await client.post("/api/v1/report/generate-html", json=request)
            assert response.status_code == 422
