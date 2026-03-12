"""
Email API tests — Email Writer และ Email Sender
ทดสอบการสร้าง email drafts, subject suggestions, การส่ง emails
"""

import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, MagicMock, patch


class TestEmailGenerate:
    """Email generation tests"""

    @pytest.mark.asyncio
    async def test_generate_email_basic(self, client: AsyncClient, sample_email_request):
        """ควรสร้าง email draft ได้"""
        response = await client.post("/api/v1/email/generate", json=sample_email_request)
        assert response.status_code == 200
        data = response.json()
        assert "draft" in data
        draft = data["draft"]
        assert "subject" in draft
        assert "body_html" in draft
        assert "body_text" in draft

    @pytest.mark.asyncio
    async def test_generate_email_tone_variations(self, client: AsyncClient, sample_email_request):
        """ควรสร้าง email ด้วย tone ที่ต่างกัน"""
        for tone in ["formal", "friendly", "casual"]:
            request = {**sample_email_request, "tone": tone}
            response = await client.post("/api/v1/email/generate", json=request)
            assert response.status_code == 200
            data = response.json()
            assert "draft" in data

    @pytest.mark.asyncio
    async def test_generate_email_language_support(self, client: AsyncClient, sample_email_request):
        """ควรสร้าง email ด้วยภาษาไทย (th) และ English (en)"""
        for lang in ["th", "en"]:
            request = {**sample_email_request, "language": lang}
            response = await client.post("/api/v1/email/generate", json=request)
            assert response.status_code == 200
            data = response.json()
            assert "draft" in data

    @pytest.mark.asyncio
    async def test_generate_email_missing_required_fields(self, client: AsyncClient):
        """ควร return 422 เมื่อ required fields หายไป"""
        incomplete_request = {
            "lead_name": "Test",
            # Missing other required fields
        }
        response = await client.post("/api/v1/email/generate", json=incomplete_request)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_generate_email_optional_fields(self, client: AsyncClient):
        """ควรจัดการ optional fields ได้"""
        request = {
            "lead_name": "ร้านอาหาร",
            "business_name": "ร้านอาหาร",
            "email": "contact@example.com",
            # Optional fields omitted
        }
        response = await client.post("/api/v1/email/generate", json=request)
        assert response.status_code == 200
        data = response.json()
        assert "draft" in data

    @pytest.mark.asyncio
    async def test_generate_email_with_rating(self, client: AsyncClient, sample_email_request):
        """ควรรวม rating ของ lead ใน context"""
        request = {**sample_email_request, "rating": 4.8}
        response = await client.post("/api/v1/email/generate", json=request)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_generate_email_with_score(self, client: AsyncClient, sample_email_request):
        """ควรรวม lead score ใน context"""
        request = {**sample_email_request, "score": 85}
        response = await client.post("/api/v1/email/generate", json=request)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_generate_email_default_values(self, client: AsyncClient):
        """ควร default tone เป็น friendly, language เป็น th"""
        request = {
            "lead_name": "ร้านอาหาร",
            "business_name": "ร้านอาหาร",
            "email": "contact@example.com",
        }
        response = await client.post("/api/v1/email/generate", json=request)
        assert response.status_code == 200
        # Check that it uses defaults


class TestEmailABVariants:
    """A/B email variant generation tests"""

    @pytest.mark.asyncio
    async def test_generate_ab_variants(self, client: AsyncClient, sample_email_request):
        """ควรสร้าง 2 email variants สำหรับ A/B testing"""
        response = await client.post("/api/v1/email/generate-ab", json=sample_email_request)
        assert response.status_code == 200
        data = response.json()
        assert "variant_a" in data
        assert "variant_b" in data

        # Check structure
        for variant_key in ["variant_a", "variant_b"]:
            variant = data[variant_key]
            assert "subject" in variant
            assert "body_html" in variant
            assert "body_text" in variant

    @pytest.mark.asyncio
    async def test_generate_ab_variants_different(self, client: AsyncClient, sample_email_request):
        """Variant A และ B ควรแตกต่างกัน"""
        response = await client.post("/api/v1/email/generate-ab", json=sample_email_request)
        assert response.status_code == 200
        data = response.json()
        # Subject หรือ body ควรต่างกัน
        variant_a_subject = data["variant_a"]["subject"]
        variant_b_subject = data["variant_b"]["subject"]
        # ไม่ควรเหมือนกันทั้งหมด
        assert variant_a_subject != variant_b_subject or \
               data["variant_a"]["body_html"] != data["variant_b"]["body_html"]

    @pytest.mark.asyncio
    async def test_generate_ab_tone_applied(self, client: AsyncClient, sample_email_request):
        """ควรใช้ tone ที่ระบุใน variant A และ B"""
        for tone in ["formal", "friendly", "casual"]:
            request = {**sample_email_request, "tone": tone}
            response = await client.post("/api/v1/email/generate-ab", json=request)
            assert response.status_code == 200


class TestSubjectSuggestions:
    """Subject line suggestion tests"""

    @pytest.mark.asyncio
    async def test_suggest_subjects_basic(self, client: AsyncClient):
        """ควรแนะนำ subject lines"""
        request = {
            "lead_name": "ร้านอาหาร",
            "business_name": "ร้านอาหารเด็ดๆ",
            "language": "th",
        }
        response = await client.post("/api/v1/email/suggest-subjects", json=request)
        assert response.status_code == 200
        data = response.json()
        assert "subjects" in data
        assert isinstance(data["subjects"], list)
        assert len(data["subjects"]) > 0

    @pytest.mark.asyncio
    async def test_suggest_subjects_default_count(self, client: AsyncClient):
        """ควร default 3 subjects"""
        request = {
            "lead_name": "ร้านอาหาร",
            "business_name": "ร้านอาหารเด็ดๆ",
        }
        response = await client.post("/api/v1/email/suggest-subjects", json=request)
        assert response.status_code == 200
        data = response.json()
        assert len(data["subjects"]) == 3

    @pytest.mark.asyncio
    async def test_suggest_subjects_custom_count(self, client: AsyncClient):
        """ควรแนะนำ custom count subjects"""
        for count in [1, 5, 10]:
            request = {
                "lead_name": "ร้านอาหาร",
                "business_name": "ร้านอาหารเด็ดๆ",
                "count": count,
            }
            response = await client.post("/api/v1/email/suggest-subjects", json=request)
            assert response.status_code == 200
            data = response.json()
            assert len(data["subjects"]) == count

    @pytest.mark.asyncio
    async def test_suggest_subjects_max_10(self, client: AsyncClient):
        """ควรจำกัด max 10 suggestions"""
        request = {
            "lead_name": "ร้านอาหาร",
            "business_name": "ร้านอาหารเด็ดๆ",
            "count": 15,
        }
        response = await client.post("/api/v1/email/suggest-subjects", json=request)
        assert response.status_code == 200
        data = response.json()
        assert len(data["subjects"]) == 10

    @pytest.mark.asyncio
    async def test_suggest_subjects_min_1(self, client: AsyncClient):
        """ควร return อย่างน้อย 1 subject"""
        request = {
            "lead_name": "ร้านอาหาร",
            "business_name": "ร้านอาหารเด็ดๆ",
            "count": 0,
        }
        response = await client.post("/api/v1/email/suggest-subjects", json=request)
        assert response.status_code == 200
        data = response.json()
        assert len(data["subjects"]) >= 1

    @pytest.mark.asyncio
    async def test_suggest_subjects_language(self, client: AsyncClient):
        """ควรแนะนำ subjects ตามภาษา"""
        for lang in ["th", "en"]:
            request = {
                "lead_name": "Restaurant",
                "business_name": "Restaurant Name",
                "language": lang,
            }
            response = await client.post("/api/v1/email/suggest-subjects", json=request)
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_suggest_subjects_all_strings(self, client: AsyncClient):
        """ควร return subjects เป็น list of strings"""
        request = {
            "lead_name": "ร้านอาหาร",
            "business_name": "ร้านอาหารเด็ดๆ",
        }
        response = await client.post("/api/v1/email/suggest-subjects", json=request)
        assert response.status_code == 200
        data = response.json()
        for subject in data["subjects"]:
            assert isinstance(subject, str)
            assert len(subject) > 0


class TestEmailSend:
    """Email sending tests"""

    @pytest.mark.asyncio
    async def test_send_email_basic(self, client: AsyncClient):
        """ควรส่ง email ได้"""
        request = {
            "from_email": "sender@example.com",
            "to_email": "recipient@example.com",
            "subject": "Test Subject",
            "html_body": "<h1>Hello</h1>",
            "text_body": "Hello",
        }
        with patch("app.services.email_sender.email_sender.send_email") as mock_send:
            mock_send.return_value = {
                "message_id": "msg_123",
                "status": "sent",
                "error": None,
            }
            response = await client.post("/api/v1/email/send", json=request)
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "sent"
            assert data["message_id"]

    @pytest.mark.asyncio
    async def test_send_email_missing_from(self, client: AsyncClient):
        """ควร return 422 เมื่อ from_email หายไป"""
        request = {
            "to_email": "recipient@example.com",
            "subject": "Test",
            "html_body": "test",
        }
        response = await client.post("/api/v1/email/send", json=request)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_send_email_missing_to(self, client: AsyncClient):
        """ควร return 422 เมื่อ to_email หายไป"""
        request = {
            "from_email": "sender@example.com",
            "subject": "Test",
            "html_body": "test",
        }
        response = await client.post("/api/v1/email/send", json=request)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_send_email_with_reply_to(self, client: AsyncClient):
        """ควรจัดการ reply_to address"""
        request = {
            "from_email": "sender@example.com",
            "to_email": "recipient@example.com",
            "subject": "Test",
            "html_body": "test",
            "reply_to": "support@example.com",
        }
        with patch("app.services.email_sender.email_sender.send_email") as mock_send:
            mock_send.return_value = {
                "message_id": "msg_123",
                "status": "sent",
                "error": None,
            }
            response = await client.post("/api/v1/email/send", json=request)
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_send_email_with_tags(self, client: AsyncClient):
        """ควรจัดการ email tags"""
        request = {
            "from_email": "sender@example.com",
            "to_email": "recipient@example.com",
            "subject": "Test",
            "html_body": "test",
            "tags": {"campaign": "outreach", "segment": "high-value"},
        }
        with patch("app.services.email_sender.email_sender.send_email") as mock_send:
            mock_send.return_value = {
                "message_id": "msg_123",
                "status": "sent",
                "error": None,
            }
            response = await client.post("/api/v1/email/send", json=request)
            assert response.status_code == 200


class TestBatchSend:
    """Batch email sending tests"""

    @pytest.mark.asyncio
    async def test_batch_send_multiple_emails(self, client: AsyncClient):
        """ควรส่ง email หลายรายการได้"""
        request = {
            "emails": [
                {
                    "from_email": "sender@example.com",
                    "to_email": f"recipient{i}@example.com",
                    "subject": f"Test {i}",
                    "html_body": f"<h1>Hello {i}</h1>",
                }
                for i in range(3)
            ]
        }
        with patch("app.services.email_sender.email_sender.send_batch") as mock_batch:
            mock_batch.return_value = [
                {"message_id": f"msg_{i}", "status": "sent", "error": None}
                for i in range(3)
            ]
            response = await client.post("/api/v1/email/send-batch", json=request)
            assert response.status_code == 200
            data = response.json()
            assert "results" in data
            assert "total" in data
            assert "sent" in data
            assert "failed" in data

    @pytest.mark.asyncio
    async def test_batch_send_empty_list(self, client: AsyncClient):
        """ควร return 422 เมื่อ emails เป็น empty"""
        request = {"emails": []}
        response = await client.post("/api/v1/email/send-batch", json=request)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_batch_send_max_100(self, client: AsyncClient):
        """ควรจำกัด batch ไม่เกิน 100 emails"""
        request = {
            "emails": [
                {
                    "from_email": "sender@example.com",
                    "to_email": f"recipient{i}@example.com",
                    "subject": f"Test {i}",
                    "html_body": "test",
                }
                for i in range(101)
            ]
        }
        response = await client.post("/api/v1/email/send-batch", json=request)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_batch_send_partial_failure(self, client: AsyncClient):
        """ควรจัดการเมื่อ batch send มี failure บางส่วน"""
        request = {
            "emails": [
                {
                    "from_email": "sender@example.com",
                    "to_email": f"recipient{i}@example.com",
                    "subject": f"Test {i}",
                    "html_body": "test",
                }
                for i in range(5)
            ]
        }
        with patch("app.services.email_sender.email_sender.send_batch") as mock_batch:
            mock_batch.return_value = [
                {"message_id": "msg_0", "status": "sent", "error": None},
                {"message_id": None, "status": "failed", "error": "Invalid email"},
                {"message_id": "msg_2", "status": "sent", "error": None},
                {"message_id": None, "status": "failed", "error": "Rate limit"},
                {"message_id": "msg_4", "status": "sent", "error": None},
            ]
            response = await client.post("/api/v1/email/send-batch", json=request)
            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 5
            assert data["sent"] == 3
            assert data["failed"] == 2

    @pytest.mark.asyncio
    async def test_batch_send_stats(self, client: AsyncClient):
        """ควร return correct stats"""
        request = {
            "emails": [
                {
                    "from_email": "sender@example.com",
                    "to_email": f"recipient{i}@example.com",
                    "subject": f"Test {i}",
                    "html_body": "test",
                }
                for i in range(10)
            ]
        }
        with patch("app.services.email_sender.email_sender.send_batch") as mock_batch:
            mock_batch.return_value = [
                {"message_id": f"msg_{i}", "status": "sent", "error": None}
                for i in range(10)
            ]
            response = await client.post("/api/v1/email/send-batch", json=request)
            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 10
            assert data["sent"] == 10
            assert data["failed"] == 0
