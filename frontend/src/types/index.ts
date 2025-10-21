export interface PaperSummary {
  id: number;
  title: string | null;
  x: number | null;
  y: number | null;
  z: number | null;
  cluster_id: number | null;
  cluster_label: string | null;
  field_subfield: string | null;
  publication_year: number | null;
  classification: string | null;
}

export interface PaperDetail extends PaperSummary {
  sample: string | null;
  summarization: string | null;
}

export interface ClusterInfo {
  cluster_id: number;
  cluster_label: string;
  count: number;
  color: string;
}

export interface PapersResponse {
  papers: PaperSummary[];
}

export interface ClustersResponse {
  clusters: ClusterInfo[];
}

export interface ScientificSummary {
  title: string;
  authors: string;
  publication_year: number | null;
  field_subfield: string;
  type_of_paper: string;
  executive_summary: string;
  research_context: string;
  key_results: string;
  three_takeaways: string;
  claims?: {
    details: string;
    supporting_evidence: string;
    contradicting_evidence: string;
    implications: string;
  }[];
}

export interface SummarizationData {
  article_classification: string;
  summary: ScientificSummary | null;
}

export interface TemporalDataPoint {
  year: number;
  count: number;
}

export interface ClusterTemporalData {
  cluster_id: number;
  cluster_label: string;
  color: string;
  temporal_data: TemporalDataPoint[];
}

export interface TemporalDataResponse {
  clusters: ClusterTemporalData[];
}
