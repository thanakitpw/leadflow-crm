from fastapi import Header, HTTPException


async def verify_api_key(x_api_key: str = Header(default="")) -> str:
    """Verify API key from request header. Placeholder for Phase 1."""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing API key")
    return x_api_key
