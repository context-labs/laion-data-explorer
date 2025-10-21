"""
Pydantic schema for structured scientific paper summaries.
Based on the expert scientific distillation prompt.
"""

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class ArticleClassification(Enum):
    """Classification of the article content."""

    # Full content, should be summarized
    SCIENTIFIC_TEXT = "SCIENTIFIC_TEXT"

    # Partial content, can still be summarized
    PARTIAL_SCIENTIFIC_TEXT = "PARTIAL_SCIENTIFIC_TEXT"

    # Irrelevant content which should not be summarized
    NON_SCIENTIFIC_TEXT = "NON_SCIENTIFIC_TEXT"


class ArticleResponse(BaseModel):
    """Top-level response structure for article processing."""

    article_classification: ArticleClassification

    reason: Optional[str] = Field(
        default=None,
        description="Reason for classification, populated when article_classification is NON_SCIENTIFIC_TEXT",
    )

    summary: Optional["ScientificSummary"] = Field(
        default=None,
        description="Scientific summary if article is SCIENTIFIC_TEXT or PARTIAL_SCIENTIFIC_TEXT",
    )


class Claim(BaseModel):
    """Individual research claim with supporting evidence."""

    details: str = Field(
        description="Testable claim details grounded in specific reported numbers/figures/tables"
    )
    supporting_evidence: str = Field(
        description="Evidence that supports this claim from the paper"
    )
    contradicting_evidence: str = Field(
        description="Evidence that contradicts or limits this claim, or empty string if none"
    )
    implications: str = Field(
        description="Implications of this claim for the broader field"
    )


class ScientificSummary(BaseModel):
    """Complete structured summary of a scientific paper."""

    title: str = Field(
        description="Exact paper title as it appears in the original paper"
    )

    authors: str = Field(
        description="Full list of authors in publication order, including affiliations if provided"
    )

    publication_year: Optional[int] = Field(
        default=None,
        description="Publication year of the paper if available, must be a valid integer",
    )

    field_subfield: str = Field(
        description="Academic field and subfield, e.g. 'Computer Science — Vision'"
    )

    type_of_paper: str = Field(
        description="Type of paper: theoretical, empirical, methodological, implementation, review, etc."
    )

    executive_summary: str = Field(
        description="Concise narrative covering problem/motivation, what was done, primary findings with key numbers, novelty, why it matters, main limitations"
    )

    research_context: str = Field(
        description="Background gap/controversy, closest prior approaches, what they lack, what this work addresses"
    )

    research_question_and_hypothesis: str = Field(
        description="Central research questions, explicit hypotheses/predictions and alternatives"
    )

    methodological_details: str = Field(
        description="Study design, participants/sample, materials/data, procedure, analysis - enough detail to reproduce"
    )

    procedures_and_architectures: str = Field(
        description="Concrete description of models/systems/apparatus, architectures, hyperparameters, what is new"
    )

    key_results: str = Field(
        description="Quantitative and qualitative findings with actual numbers, baseline/SOTA comparisons, effect sizes, robustness insights"
    )

    interpretation_and_theoretical_implications: str = Field(
        description="What findings mean for RQs and broader theory, proposed mechanisms, scope conditions"
    )

    contradictions_and_limitations: str = Field(
        description="Internal inconsistencies, methodological constraints, external validity, conflicts with prior literature"
    )

    claims: List[Claim] = Field(
        description="List of testable claims grounded in specific reported numbers/figures/tables"
    )

    data_and_code_availability: str = Field(
        description="Links, licenses, preregistration, supplements, or empty string if not available"
    )

    robustness_and_ablation_notes: str = Field(
        description="Summary of ablations/sensitivity/stability analysis, or empty string if none"
    )

    ethical_considerations: str = Field(
        description="Risks, mitigations, approvals, privacy/consent, dual use, or empty string if none"
    )

    key_figures_tables: str = Field(
        description="Which figures/tables are critical, what they show, how they substantiate core claims"
    )

    three_takeaways: str = Field(
        description="Three short paragraphs: (1) core novel contribution, (2) strongest evidence with numbers, (3) primary limitation"
    )


# Forward reference resolution
ArticleResponse.model_rebuild()


def get_json_schema():
    """Get the JSON schema for structured outputs.

    Returns:
        Dictionary containing the JSON schema for the ArticleResponse model
        with modifications required by OpenAI API:
        - additionalProperties: false for all objects
        - all properties listed in required arrays
    """
    # Generate base schema from Pydantic
    schema = ArticleResponse.model_json_schema()

    return {
        "name": "article_response",
        "schema": schema,
    }
