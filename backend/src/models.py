"""Pydantic models for API responses."""

from typing import List, Optional
from pydantic import BaseModel


class PaperSummary(BaseModel):
    """Summary view of a paper for list/visualization."""
    id: int
    title: Optional[str]
    x: Optional[float]
    y: Optional[float]
    z: Optional[float]
    cluster_id: Optional[int]
    cluster_label: Optional[str]
    field_subfield: Optional[str]
    publication_year: Optional[int]
    classification: Optional[str]


class PaperDetail(BaseModel):
    """Detailed view of a paper."""
    id: int
    title: Optional[str]
    sample: Optional[str]
    summarization: Optional[str]
    x: Optional[float]
    y: Optional[float]
    z: Optional[float]
    cluster_id: Optional[int]
    cluster_label: Optional[str]
    field_subfield: Optional[str]
    publication_year: Optional[int]
    classification: Optional[str]


class ClusterInfo(BaseModel):
    """Information about a cluster."""
    cluster_id: int
    cluster_label: str
    count: int
    color: str


class PapersResponse(BaseModel):
    """Response containing list of papers."""
    papers: List[PaperSummary]


class ClustersResponse(BaseModel):
    """Response containing cluster information."""
    clusters: List[ClusterInfo]


class TemporalDataPoint(BaseModel):
    """Data point for a specific year in temporal analysis."""
    year: int
    count: int


class ClusterTemporalData(BaseModel):
    """Temporal evolution data for a single cluster."""
    cluster_id: int
    cluster_label: str
    color: str
    temporal_data: List[TemporalDataPoint]


class TemporalDataResponse(BaseModel):
    """Response containing temporal evolution data for all clusters."""
    clusters: List[ClusterTemporalData]
