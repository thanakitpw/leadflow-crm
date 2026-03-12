"""
Enrichment API tests — Email Finder
ทดสอบการหา email จากเว็บไซต์
"""

import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, MagicMock, patch


class TestEmailFinder:
    """Email finder endpoint tests"""

    @pytest.mark.asyncio
    async def test_find_email_basic(self, client: AsyncClient, mock_email_finder, mock_mx_validator):
        """ควรหา email จากเว็บไซต์ได้"""
        request_body = {
            "website": "https://example.com",
            "business_name": "Example Co.",
        }
        response = await client.post("/api/v1/enrichment/find-email", json=request_body)
        assert response.status_code == 200
        data = response.json()
        assert "emails" in data
        assert "website" in data
        assert "pages_scraped" in data

    @pytest.mark.asyncio
    async def test_find_email_without_protocol(self, client: AsyncClient, mock_email_finder, mock_mx_validator):
        """ควรเพิ่ม https:// เมื่อ URL ไม่มี protocol"""
        request_body = {
            "website": "example.com",
            "business_name": "Example Co.",
        }
        response = await client.post("/api/v1/enrichment/find-email", json=request_body)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_find_email_empty_website(self, client: AsyncClient):
        """ควร return 422 เมื่อ website เป็น empty"""
        request_body = {
            "website": "",
            "business_name": "Example Co.",
        }
        response = await client.post("/api/v1/enrichment/find-email", json=request_body)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_find_email_returns_confidence_scores(
        self, client: AsyncClient, mock_email_finder, mock_mx_validator
    ):
        """ควร return emails พร้อม confidence scores"""
        request_body = {
            "website": "https://example.com",
            "business_name": "Example Co.",
        }
        response = await client.post("/api/v1/enrichment/find-email", json=request_body)
        assert response.status_code == 200
        data = response.json()
        if data["emails"]:
            email = data["emails"][0]
            assert "email" in email
            assert "confidence" in email
            assert 0 <= email["confidence"] <= 1
            assert "source" in email
            assert "verified" in email

    @pytest.mark.asyncio
    async def test_find_email_mx_validation(self, client: AsyncClient, mock_email_finder, mock_mx_validator):
        """ควร validate MX record ของ domain"""
        request_body = {
            "website": "https://example.com",
            "business_name": "Example Co.",
        }
        response = await client.post("/api/v1/enrichment/find-email", json=request_body)
        assert response.status_code == 200
        # Check that mock_mx_validator was called
        mock_mx_validator.assert_called()

    @pytest.mark.asyncio
    async def test_find_email_no_emails_found(self, client: AsyncClient):
        """ควรค้นหาเว็บไซต์สำเร็จแม้ไม่พบ email"""
        with patch("app.services.email_finder.find_emails") as mock_find:
            mock_find.return_value = []
            with patch("app.services.mx_validator.validate_mx") as mock_mx:
                mock_mx.return_value = True

                request_body = {
                    "website": "https://example.com",
                    "business_name": "Example Co.",
                }
                response = await client.post("/api/v1/enrichment/find-email", json=request_body)
                assert response.status_code == 200
                data = response.json()
                assert data["emails"] == []

    @pytest.mark.asyncio
    async def test_find_email_sorted_by_confidence(
        self, client: AsyncClient
    ):
        """ควร return emails เรียงตาม confidence (สูงสุดก่อน)"""
        with patch("app.services.email_finder.find_emails") as mock_find:
            from app.services.email_finder import EmailResult
            # Create multiple emails with different confidence scores
            mock_find.return_value = [
                EmailResult(email="info@example.com", confidence=0.95, source="mailto"),
                EmailResult(email="contact@example.com", confidence=0.75, source="claude"),
                EmailResult(email="hello@example.com", confidence=0.80, source="regex"),
            ]
            with patch("app.services.mx_validator.validate_mx") as mock_mx:
                mock_mx.return_value = True

                request_body = {
                    "website": "https://example.com",
                    "business_name": "Example Co.",
                }
                response = await client.post("/api/v1/enrichment/find-email", json=request_body)
                assert response.status_code == 200
                data = response.json()
                emails = data["emails"]
                # Verify sorted by confidence (descending)
                for i in range(len(emails) - 1):
                    assert emails[i]["confidence"] >= emails[i + 1]["confidence"]

    @pytest.mark.asyncio
    async def test_find_email_confidence_source_mapping(
        self, client: AsyncClient
    ):
        """ควร map source ไปยัง confidence score ที่ถูกต้อง"""
        # mailto = 0.95, scraped = 0.90, regex = 0.80, claude = 0.75, pattern = 0.50
        with patch("app.services.email_finder.find_emails") as mock_find:
            from app.services.email_finder import EmailResult
            mock_find.return_value = [
                EmailResult(email="mailto@example.com", confidence=0.95, source="mailto"),
                EmailResult(email="scraped@example.com", confidence=0.90, source="scraped"),
                EmailResult(email="regex@example.com", confidence=0.80, source="regex"),
                EmailResult(email="claude@example.com", confidence=0.75, source="claude"),
                EmailResult(email="pattern@example.com", confidence=0.50, source="pattern"),
            ]
            with patch("app.services.mx_validator.validate_mx") as mock_mx:
                mock_mx.return_value = True

                request_body = {
                    "website": "https://example.com",
                    "business_name": "Example Co.",
                }
                response = await client.post("/api/v1/enrichment/find-email", json=request_body)
                assert response.status_code == 200
                data = response.json()
                # Verify confidence values
                source_confidence = {e["source"]: e["confidence"] for e in data["emails"]}
                assert source_confidence["mailto"] == 0.95
                assert source_confidence["scraped"] == 0.90
                assert source_confidence["regex"] == 0.80
                assert source_confidence["claude"] == 0.75
                assert source_confidence["pattern"] == 0.50

    @pytest.mark.asyncio
    async def test_find_email_business_name_optional(self, client: AsyncClient, mock_email_finder, mock_mx_validator):
        """ควร handle business_name เป็น optional"""
        request_body = {
            "website": "https://example.com",
        }
        response = await client.post("/api/v1/enrichment/find-email", json=request_body)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_find_email_domain_extraction(self, client: AsyncClient, mock_email_finder, mock_mx_validator):
        """ควรแยก domain จาก URL ได้ถูกต้อง"""
        with patch("app.services.mx_validator.validate_mx") as mock_mx:
            mock_mx.return_value = True
            with patch("app.services.email_finder.find_emails") as mock_find:
                mock_find.return_value = []

                request_body = {
                    "website": "https://www.example.co.th",
                    "business_name": "Example Co.",
                }
                response = await client.post("/api/v1/enrichment/find-email", json=request_body)
                assert response.status_code == 200
                # Verify domain extraction (www. removed)
                mock_mx.assert_called_with("example.co.th")

    @pytest.mark.asyncio
    async def test_find_email_500_error_handling(self, client: AsyncClient):
        """ควรจัดการ 500 error อย่างสวยงาม"""
        with patch("app.services.email_finder.find_emails") as mock_find:
            mock_find.side_effect = Exception("Scraper error")

            request_body = {
                "website": "https://example.com",
                "business_name": "Example Co.",
            }
            response = await client.post("/api/v1/enrichment/find-email", json=request_body)
            assert response.status_code == 500
            data = response.json()
            assert "detail" in data
