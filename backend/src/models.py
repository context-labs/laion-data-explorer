"""Pydantic models for API responses."""

from pydantic import BaseModel


class PaperSummary(BaseModel):
    """Summary view of a paper for list/visualization."""

    id: int
    title: str | None
    x: float | None
    y: float | None
    z: float | None
    cluster_id: int | None
    cluster_label: str | None
    field_subfield: str | None
    publication_year: int | None
    classification: str | None


class PaperDetail(BaseModel):
    """Detailed view of a paper."""

    id: int
    title: str | None
    sample: str | None
    summarization: str | None
    x: float | None
    y: float | None
    z: float | None
    cluster_id: int | None
    cluster_label: str | None
    field_subfield: str | None
    publication_year: int | None
    classification: str | None
    nearest_papers: list["PaperSummary"]


class PaperSample(BaseModel):
    """Paper sample with extracted data and cluster info."""

    paper_id: int
    sample: str
    title: str | None
    summarization: str | None
    cluster_id: int | None
    cluster_label: str | None
    field_subfield: str | None
    publication_year: int | None
    classification: str | None


class PaperSampleList(BaseModel):
    """List of paper IDs that have samples."""

    paper_ids: list[int]


class ClusterInfo(BaseModel):
    """Information about a cluster."""

    cluster_id: int
    cluster_label: str
    count: int
    color: str


class PapersResponse(BaseModel):
    """Response containing list of papers."""

    papers: list[PaperSummary]


class ClustersResponse(BaseModel):
    """Response containing cluster information."""

    clusters: list[ClusterInfo]


class TemporalDataPoint(BaseModel):
    """Data point for a specific year in temporal analysis."""

    year: int
    count: int


class ClusterTemporalData(BaseModel):
    """Temporal evolution data for a single cluster."""

    cluster_id: int
    cluster_label: str
    color: str
    temporal_data: list[TemporalDataPoint]


class TemporalDataResponse(BaseModel):
    """Response containing temporal evolution data for all clusters."""

    clusters: list[ClusterTemporalData]
