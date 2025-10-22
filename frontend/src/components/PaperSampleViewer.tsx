import { Button, CodeBlock, Row, Skeleton } from "~/ui";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { ClusterInfo, PaperSample, PaperSampleList } from "../types";
import { getApiUrl } from "../utils/api";

interface PaperSampleViewerProps {
  clusters: ClusterInfo[];
}

export function PaperSampleViewer({ clusters }: PaperSampleViewerProps) {
  const [sampleIds, setSampleIds] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingSampleIds, setLoadingSampleIds] = useState(true);
  const [loadingSample, setLoadingSample] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sampleCache, setSampleCache] = useState<Map<number, PaperSample>>(
    new Map(),
  );
  const [jumpToIndex, setJumpToIndex] = useState("");

  // Fetch list of sample IDs on mount
  useEffect(() => {
    fetch(getApiUrl("/api/samples"))
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch sample IDs");
        return res.json();
      })
      .then((data: PaperSampleList) => {
        setSampleIds(data.paper_ids);
        setLoadingSampleIds(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoadingSampleIds(false);
      });
  }, []);

  // Fetch current sample
  useEffect(() => {
    if (sampleIds.length === 0) return;

    const paperId = sampleIds[currentIndex];
    if (!paperId) return;

    // Check cache first
    if (sampleCache.has(paperId)) {
      return;
    }

    setLoadingSample(true);
    fetch(getApiUrl(`/api/samples/${paperId}`))
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch paper sample");
        return res.json();
      })
      .then((data: PaperSample) => {
        setSampleCache(new Map(sampleCache.set(paperId, data)));
        setLoadingSample(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoadingSample(false);
      });
  }, [currentIndex, sampleIds, sampleCache]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < sampleIds.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleJumpToIndex = (e: React.FormEvent) => {
    e.preventDefault();
    const index = parseInt(jumpToIndex, 10);
    if (isNaN(index) || index < 1 || index > sampleIds.length) {
      return;
    }
    setCurrentIndex(index - 1); // Convert 1-based to 0-based
    setJumpToIndex("");
  };

  if (loadingSampleIds) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Skeleton className="h-96 w-full max-w-6xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <p className="text-lg font-semibold text-destructive">Error</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (sampleIds.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <p className="text-lg font-semibold">No Samples Available</p>
          <p className="text-sm text-muted-foreground">
            No paper samples found in the database.
          </p>
        </div>
      </div>
    );
  }

  const currentPaperId = sampleIds[currentIndex];
  const currentSample = currentPaperId
    ? sampleCache.get(currentPaperId)
    : undefined;

  // Get cluster color from clusters data
  const clusterColor =
    currentSample?.cluster_id !== null &&
    currentSample?.cluster_id !== undefined
      ? (clusters.find((c) => c.cluster_id === currentSample.cluster_id)
          ?.color ?? "#888888")
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
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div
        className={`
          flex items-center justify-between border-b border-border p-4
        `}
      >
        <div>
          <Row className="items-center gap-2">
            <h2 className="text-lg font-semibold">Paper Sample Viewer</h2>
            <p className="text-sm text-muted-foreground">
              — These summaries are extracted using a custom fine-tuned small
              model.
            </p>
          </Row>
          <p className="text-sm text-muted-foreground">
            Viewing {currentIndex + 1} of {sampleIds.length} Sample Papers
          </p>
        </div>
        <Row className="gap-2">
          <Button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            variant="outline"
            size="sm"
          >
            <ChevronLeftIcon className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <Button
            onClick={handleNext}
            disabled={currentIndex === sampleIds.length - 1}
            variant="outline"
            size="sm"
          >
            Next
            <ChevronRightIcon className="ml-1 h-4 w-4" />
          </Button>
          <form
            onSubmit={handleJumpToIndex}
            className="flex items-center gap-1"
          >
            <input
              type="number"
              min="1"
              max={sampleIds.length}
              value={jumpToIndex}
              onChange={(e) => setJumpToIndex(e.target.value)}
              placeholder={`1-${sampleIds.length}`}
              className={`
                h-8 w-20 rounded-md border border-input bg-background px-2
                text-sm
              `}
            />
            <Button type="submit" variant="outline" size="sm">
              Go
            </Button>
          </form>
        </Row>
      </div>

      {/* Content */}
      {loadingSample || !currentSample ? (
        <div className="flex h-full items-center justify-center p-8">
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <div
          className={`
            grid h-full grid-cols-1 overflow-hidden

            lg:grid-cols-2
          `}
        >
          {/* Left: Paper Sample */}
          <div className="flex flex-col overflow-hidden border-r border-border">
            <div
              className={`
                flex h-32 flex-shrink-0 flex-col border-b border-border
                bg-muted/50 p-4
              `}
            >
              <h3 className="mb-3 text-sm font-semibold">
                Original Paper Sample
              </h3>
              <div>
                <div
                  className={`
                    mb-1 text-xs font-medium uppercase tracking-wide
                    text-muted-foreground
                  `}
                >
                  Extracted Title
                </div>
                <div
                  className={`line-clamp-2 text-xs font-medium text-foreground`}
                >
                  {currentSample.title ?? "[No title extracted]"}
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre
                className={`
                  whitespace-pre-wrap text-xs leading-relaxed
                  text-muted-foreground
                `}
              >
                {currentSample.sample}
              </pre>
            </div>
          </div>

          {/* Right: Extracted JSON */}
          <div className="flex flex-col overflow-hidden">
            <div
              className={`
                flex h-32 flex-shrink-0 flex-col border-b border-border
                bg-muted/50 p-4
              `}
            >
              <h3 className="mb-3 text-sm font-semibold">
                Extracted Data (JSON)
              </h3>
              <div className="flex flex-wrap gap-3">
                {currentSample.cluster_label && (
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
                        inline-flex items-center rounded-sm px-3 py-1 text-xs
                        font-medium text-foreground
                      `}
                      style={{
                        border: `1px solid ${clusterBorderColor}`,
                      }}
                    >
                      {currentSample.cluster_label}
                    </div>
                  </div>
                )}
                {currentSample.field_subfield && (
                  <div>
                    <div
                      className={`
                        mb-1 text-xs font-medium uppercase tracking-wide
                        text-muted-foreground
                      `}
                    >
                      Field
                    </div>
                    <div className="py-1 text-xs font-medium text-foreground">
                      {currentSample.field_subfield}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <CodeBlock
                language="json"
                code={
                  currentSample.summarization
                    ? JSON.stringify(
                        JSON.parse(currentSample.summarization),
                        null,
                        2,
                      )
                    : "{}"
                }
                obfuscatedCode={
                  currentSample.summarization
                    ? JSON.stringify(
                        JSON.parse(currentSample.summarization),
                        null,
                        2,
                      )
                    : "{}"
                }
                copyButton={<></>}
                customStyle={{ fontSize: "0.7rem" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
