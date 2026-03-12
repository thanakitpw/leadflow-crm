from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.endpoints import health, places, enrichment, scoring, orchestrator, email, tracking, report

app = FastAPI(
    title="LeadFlow Python API",
    description="AI Lead Generation & Enrichment API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
app.include_router(health.router, tags=["Health"])

# Places API — Lead Search
app.include_router(places.router, prefix="/api/v1/places", tags=["Places"])

# Enrichment — AI Email Finder
app.include_router(enrichment.router, prefix="/api/v1")

# Scoring — Claude Lead Scoring
app.include_router(scoring.router, prefix="/api/v1")

# Orchestrator — Full pipeline: search → enrich → score → save
app.include_router(orchestrator.router, prefix="/api/v1", tags=["Orchestrator"])

# Email Writer + Sender — Phase 3
app.include_router(email.router, prefix="/api/v1", tags=["Email"])

# Tracking — Open/Click tracking, Unsubscribe, Resend webhook
app.include_router(tracking.router, prefix="/api/v1", tags=["Tracking"])

# Report — HTML report generation (Phase 4)
app.include_router(report.router, prefix="/api/v1", tags=["Report"])


@app.get("/")
async def root():
    return {"message": "LeadFlow API is running"}
