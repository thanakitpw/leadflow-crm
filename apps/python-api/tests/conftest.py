import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock, patch


@pytest_asyncio.fixture
async def app():
    """fixture สำหรับ FastAPI app instance"""
    from main import app
    return app


@pytest_asyncio.fixture
async def client(app):
    """AsyncClient fixture สำหรับทำ HTTP requests ไปยัง FastAPI app"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_supabase():
    """Mock Supabase client สำหรับ cache และ database operations"""
    with patch('app.services.cache.httpx.AsyncClient') as mock_http:
        # สร้าง mock response object
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = []
        mock_response.raise_for_status = MagicMock()

        # setup async context manager
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.patch = AsyncMock(return_value=mock_response)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        mock_http.return_value = mock_client
        yield mock_client


@pytest.fixture
def mock_anthropic():
    """Mock Anthropic/Claude client สำหรับ AI scoring และ email writing"""
    with patch('anthropic.Anthropic') as mock:
        instance = MagicMock()
        # สร้าง mock response สำหรับ Claude API
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text='{"score": 75, "reasoning": "ธุรกิจมีศักยภาพดี"}')]
        instance.messages.create = MagicMock(return_value=mock_message)
        mock.return_value = instance
        yield instance


@pytest.fixture
def mock_places_api():
    """Mock Google Places API responses"""
    with patch('app.services.places.httpx.AsyncClient') as mock_http:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "places": [
                {
                    "id": "place_123",
                    "displayName": {"text": "ร้านอาหารทดสอบ"},
                    "formattedAddress": "123 ถนนสาธารณ สุขุมวิท",
                    "websiteUri": "https://example.com",
                    "rating": 4.5,
                    "userRatingCount": 100,
                    "primaryType": "restaurant",
                    "location": {"latitude": 13.7563, "longitude": 100.5018},
                }
            ]
        }

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        mock_http.return_value = mock_client
        yield mock_client


@pytest.fixture
def mock_email_finder():
    """Mock email finder service"""
    with patch('app.services.email_finder.find_emails') as mock_find:
        from app.services.email_finder import EmailResult
        mock_result = EmailResult(
            email="contact@example.com",
            confidence=0.95,
            source="mailto"
        )
        mock_find.return_value = [mock_result]
        yield mock_find


@pytest.fixture
def mock_mx_validator():
    """Mock MX record validator"""
    with patch('app.services.mx_validator.validate_mx') as mock_validate:
        mock_validate.return_value = True
        yield mock_validate


@pytest.fixture
def mock_resend_api():
    """Mock Resend email API"""
    with patch('app.services.email_sender.httpx.AsyncClient') as mock_http:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "email_123"}

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        mock_http.return_value = mock_client
        yield mock_client


@pytest.fixture
def sample_place_result():
    """Sample place result data สำหรับทดสอบ"""
    return {
        "place_id": "place_123",
        "name": "ร้านอาหารทดสอบ",
        "address": "123 ถนนสาธารณ สุขุมวิท",
        "phone": "+66812345678",
        "website": "https://example.com",
        "rating": 4.5,
        "reviews_count": 100,
        "category": "restaurant",
        "latitude": 13.7563,
        "longitude": 100.5018,
        "google_maps_uri": "https://maps.google.com/?q=place123",
    }


@pytest.fixture
def sample_lead_for_scoring():
    """Sample lead data สำหรับ scoring tests"""
    return {
        "id": "lead_123",
        "name": "ร้านอาหารทดสอบ",
        "rating": 4.5,
        "review_count": 100,
        "website": "https://example.com",
        "email": "contact@example.com",
        "phone": "+66812345678",
        "category": "restaurant",
        "address": "123 ถนนสาธารณ สุขุมวิท",
    }


@pytest.fixture
def sample_email_request():
    """Sample email generation request"""
    return {
        "lead_name": "ร้านอาหารทดสอบ",
        "business_name": "ร้านอาหารทดสอบ",
        "email": "contact@example.com",
        "category": "restaurant",
        "location": "บางแค",
        "rating": 4.5,
        "score": 75,
        "tone": "friendly",
        "language": "th",
    }
