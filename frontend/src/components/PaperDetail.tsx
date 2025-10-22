import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/ui";
import { useEffect, useState } from "react";
import type {
  ClusterInfo,
  PaperDetail as PaperDetailType,
  SummarizationData,
} from "../types";
import { getApiUrl } from "../utils/api";

interface PaperDetailProps {
  paperId: number | null;
  onClose: () => void;
  onPaperClick?: (paperId: number) => void;
  clusters?: ClusterInfo[];
}

export function PaperDetail({
  paperId,
  onClose,
  onPaperClick,
  clusters = [],
}: PaperDetailProps) {
  const [paper, setPaper] = useState<PaperDetailType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accordionValue, setAccordionValue] = useState<string>("");

  useEffect(() => {
    if (!paperId) {
      setPaper(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(getApiUrl(`/api/papers/${paperId}`))
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch paper");
        return res.json();
      })
      .then((data: PaperDetailType) => {
        setPaper(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [paperId]);

  const handleNearestPaperClick = (nearPaperId: number) => {
    // Close the accordion when navigating to a nearest paper
    setAccordionValue("");
    if (onPaperClick) {
      onPaperClick(nearPaperId);
    }
  };

  let summaryData: SummarizationData | null = null;
  if (paper?.summarization) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      summaryData = JSON.parse(paper.summarization);
    } catch (e) {
      console.error("Failed to parse summarization:", e);
    }
  }

  // Get cluster color from clusters data
  const clusterColor = paper?.cluster_id
    ? (clusters.find((c) => c.cluster_id === paper.cluster_id)?.color ??
      "#888888")
    : "#888888";

  // Convert hex color to rgba with opacity for border
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const clusterBorderColor = hexToRgba(clusterColor, 0.8);

  return (
    <Sheet
      open={paperId !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setAccordionValue("");
        }
      }}
    >
      <SheetContent
        autoFocus={false}
        className={`
          w-full overflow-y-auto border-none

          lg:w-[1000px] lg:max-w-[1000px]

          sm:w-[600px] sm:max-w-[600px]
        `}
      >
        <SheetHeader
          className={`-mx-6 -mt-6 mb-6 border-b border-border bg-background p-6`}
        >
          <SheetTitle
            className={`text-left text-2xl leading-tight text-foreground`}
          >
            Paper Details
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-6">
          {loading && (
            <p className="text-muted-foreground">Loading paper details...</p>
          )}
          {error && <p className="text-destructive">Error: {error}</p>}
          {paper && (
            <>
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <div>
                  <h3
                    className={`mb-3 text-base font-semibold text-card-foreground`}
                  >
                    Paper Title
                  </h3>
                  <h2 className="leading-tight text-foreground w-[95%]">
                    {paper.title === ""
                      ? "[No title extracted]"
                      : (paper.title ?? "Untitled")}
                  </h2>
                </div>
                <div
                  className={`
                  flex flex-col sm:flex-row gap-8 mt-4
                `}
                >
                  <div>
                    <div
                      className={`
                      mb-1 text-xs font-medium uppercase tracking-wide
                      text-muted-foreground
                    `}
                    >
                      Cluster
                    </div>
                    <div
                      className={`
                       inline-flex items-center rounded-sm px-3 py-1 text-sm
                       font-medium text-foreground
                     `}
                      style={{
                        border: `1px solid ${clusterBorderColor}`,
                      }}
                    >
                      {paper.cluster_label ?? "N/A"}
                    </div>
                  </div>
                  <div>
                    <div
                      className={`
                      mb-1 text-xs font-medium uppercase tracking-wide
                      text-muted-foreground
                    `}
                    >
                      Field
                    </div>
                    <div className="text-sm font-medium text-foreground py-1">
                      {paper.field_subfield ?? "Unknown"}
                    </div>
                  </div>
                  <div>
                    <div
                      className={`
                      mb-1 text-xs font-medium uppercase tracking-wide
                      text-muted-foreground
                    `}
                    >
                      Year
                    </div>
                    <div className="text-sm font-medium text-foreground py-1">
                      {paper.publication_year ?? "Unknown"}
                    </div>
                  </div>
                </div>
              </div>
              {paper.nearest_papers && paper.nearest_papers.length > 0 && (
                <Accordion
                  type="single"
                  collapsible
                  className="w-full"
                  value={accordionValue}
                  onValueChange={setAccordionValue}
                >
                  <AccordionItem value="nearest" className="border-border">
                    <AccordionTrigger>
                      <p className="text-base font-semibold text-foreground hover:underline ml-1">
                        View Nearest Papers
                      </p>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="mb-1 text-base text-muted-foreground">
                        Showing {paper.nearest_papers.length} papers closest to
                        this one in embedding space, calculated using Euclidean
                        distance.
                      </p>
                      <p className="mb-4 text-base text-muted-foreground">
                        These papers are semantically similar based on their
                        content and methodology.
                      </p>
                      <div className="space-y-2">
                        {paper.nearest_papers.map((nearPaper) => (
                          <button
                            key={nearPaper.id}
                            onClick={() =>
                              handleNearestPaperClick(nearPaper.id)
                            }
                            className={`
                              w-full rounded-md border border-border bg-card p-3
                              text-left text-sm transition-colors

                              hover:bg-accent hover:text-accent-foreground
                            `}
                          >
                            <div className="font-medium text-card-foreground">
                              {nearPaper.title ?? "Untitled"}
                            </div>
                            <div
                              className={`
                                mt-1 flex items-center gap-2 text-xs
                                text-muted-foreground
                              `}
                            >
                              {nearPaper.publication_year && (
                                <span>{nearPaper.publication_year}</span>
                              )}
                              {nearPaper.field_subfield && (
                                <>
                                  <span>•</span>
                                  <span>{nearPaper.field_subfield}</span>
                                </>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
              {summaryData?.summary && (
                <div className="space-y-6">
                  {summaryData.summary.authors && (
                    <section
                      className={`rounded-lg border border-border bg-card p-4`}
                    >
                      <h3
                        className={`
                          mb-3 text-base font-semibold text-card-foreground
                        `}
                      >
                        Authors
                      </h3>
                      <p
                        className={`
                          text-sm leading-relaxed text-muted-foreground
                        `}
                      >
                        {summaryData.summary.authors}
                      </p>
                    </section>
                  )}
                  <section
                    className={`rounded-lg border border-border bg-card p-4`}
                  >
                    <h3
                      className={`
                        mb-3 text-base font-semibold text-card-foreground
                      `}
                    >
                      Executive Summary
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {summaryData.summary.executive_summary}
                    </p>
                  </section>
                  <section
                    className={`rounded-lg border border-border bg-card p-4`}
                  >
                    <h3
                      className={`
                        mb-3 text-base font-semibold text-card-foreground
                      `}
                    >
                      Research Context
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {summaryData.summary.research_context}
                    </p>
                  </section>
                  <section
                    className={`rounded-lg border border-border bg-card p-4`}
                  >
                    <h3
                      className={`
                        mb-3 text-base font-semibold text-card-foreground
                      `}
                    >
                      Key Results
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {summaryData.summary.key_results}
                    </p>
                  </section>
                  <section
                    className={`rounded-lg border border-border bg-card p-4`}
                  >
                    <h3
                      className={`
                        mb-3 text-base font-semibold text-card-foreground
                      `}
                    >
                      Three Takeaways
                    </h3>
                    <p
                      className={`
                        whitespace-pre-wrap text-sm leading-relaxed
                        text-muted-foreground
                      `}
                    >
                      {summaryData.summary.three_takeaways}
                    </p>
                  </section>
                  {summaryData.summary.claims &&
                    summaryData.summary.claims.length > 0 && (
                      <section>
                        <h3
                          className={`
                            mb-4 text-base font-semibold text-foreground
                          `}
                        >
                          Key Claims
                        </h3>
                        <div className="space-y-3">
                          {summaryData.summary.claims.map((claim, idx) => (
                            <div
                              key={idx}
                              className={`
                                rounded-lg border border-border bg-card p-4
                              `}
                            >
                              <h4
                                className={`
                                  mb-3 font-semibold text-card-foreground
                                `}
                              >
                                Claim {idx + 1}
                              </h4>
                              <div className="space-y-2">
                                <div>
                                  <span
                                    className={`
                                      text-sm font-semibold text-foreground
                                    `}
                                  >
                                    Details:
                                  </span>{" "}
                                  <span
                                    className={`text-sm text-muted-foreground`}
                                  >
                                    {claim.details}
                                  </span>
                                </div>
                                <div>
                                  <span
                                    className={`
                                      text-sm font-semibold text-foreground
                                    `}
                                  >
                                    Supporting Evidence:
                                  </span>{" "}
                                  <span
                                    className={`text-sm text-muted-foreground`}
                                  >
                                    {claim.supporting_evidence}
                                  </span>
                                </div>
                                {claim.contradicting_evidence && (
                                  <div>
                                    <span
                                      className={`
                                        text-sm font-semibold
                                        text-foreground
                                      `}
                                    >
                                      Contradicting Evidence:
                                    </span>{" "}
                                    <span
                                      className={`text-sm text-muted-foreground`}
                                    >
                                      {claim.contradicting_evidence}
                                    </span>
                                  </div>
                                )}
                                <div>
                                  <span
                                    className={`
                                      text-sm font-semibold text-foreground
                                    `}
                                  >
                                    Implications:
                                  </span>{" "}
                                  <span
                                    className={`text-sm text-muted-foreground`}
                                  >
                                    {claim.implications}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
