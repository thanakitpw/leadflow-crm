from app.schemas.enrichment import (
    EmailFinderRequest,
    EmailResult,
    EmailFinderResponse,
)
from app.schemas.scoring import (
    LeadForScoring,
    ScoreResult,
    ScoreLeadRequest,
    ScoreLeadResponse,
    ScoreBatchRequest,
    ScoreBatchResponse,
)
from app.schemas.report import (
    CampaignStat,
    SummaryStats,
    TopLead,
    ReportGenerateRequest,
    ReportGenerateResponse,
)

__all__ = [
    # Enrichment
    "EmailFinderRequest",
    "EmailResult",
    "EmailFinderResponse",
    # Scoring
    "LeadForScoring",
    "ScoreResult",
    "ScoreLeadRequest",
    "ScoreLeadResponse",
    "ScoreBatchRequest",
    "ScoreBatchResponse",
    # Report
    "CampaignStat",
    "SummaryStats",
    "TopLead",
    "ReportGenerateRequest",
    "ReportGenerateResponse",
]
