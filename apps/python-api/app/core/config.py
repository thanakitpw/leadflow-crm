from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    supabase_url: str = "http://localhost:54321"
    supabase_service_role_key: str = ""

    # Claude AI
    anthropic_api_key: str = ""

    # Google Places
    google_places_api_key: str = ""

    # Resend Email API
    resend_api_key: str = ""

    # App
    python_api_url: str = "http://localhost:8000"
    next_app_url: str = "http://localhost:3000"

    # Tracking URLs
    app_url: str = "http://localhost:3000"   # Next.js app URL (unsubscribe page)
    api_url: str = "http://localhost:8000"   # Python API URL (tracking pixel/click)

    # CORS — comma-separated list of allowed origins
    cors_origins: str = "http://localhost:3000"

    model_config = {"env_file": "../../.env", "extra": "ignore"}


settings = Settings()
