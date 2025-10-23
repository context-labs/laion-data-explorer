import { useSwipeRightDetector } from "~/lib/ui-shared";
import {
  Button,
  Card,
  Centered,
  Checkbox,
  cn,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  InferenceIcon,
  Input,
  Label,
  Row,
  Select,
  Sheet,
  SheetContent,
  SheetTrigger,
  Skeleton,
  Slider,
  ThemeToggle,
} from "~/ui";
import {
  AtomIcon,
  BarChart3Icon,
  BarChartIcon,
  ChartNetworkIcon,
  ChevronRightIcon,
  GithubIcon,
  LayoutGridIcon,
  Menu,
  MicroscopeIcon,
  NetworkIcon,
  NotebookTextIcon,
  PlusIcon,
  SunMoonIcon,
} from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";
import LaionDarkLogo from "./assets/logos/Laion-dark.svg";
import LaionLightLogo from "./assets/logos/Laion-light.svg";
import { ClusterLegend } from "./components/ClusterLegend";
import { ClusterVisualization } from "./components/ClusterVisualization";
import { DistributionChart } from "./components/DistributionChart";
import { ForceDirectedCluster } from "./components/ForceDirectedCluster";
import { LearnMoreContent } from "./components/LearnMoreContent";
import { LearnMoreSheet } from "./components/LearnMoreSheet";
import { PaperDetail } from "./components/PaperDetail";
import { PaperSampleViewer } from "./components/PaperSampleViewer";
import type { HeatmapSortOption } from "./components/TemporalHeatmap";
import { TemporalHeatmap } from "./components/TemporalHeatmap";
import type {
  StackedSortOption,
  StackMode,
} from "./components/TemporalStackedChart";
import { TemporalStackedChart } from "./components/TemporalStackedChart";
import type {
  ClusterInfo,
  ClustersResponse,
  PapersResponse,
  PaperSummary,
} from "./types";
import { fetchCompressed, getApiUrl } from "./utils/api";
import type { LayoutType } from "./utils/layoutTransforms";

type SwipeableSheetContentProps = {
  children: React.ReactNode;
  className?: string;
  setMobileMenuOpen: (open: boolean) => void;
};

function SwipeableSheetContent({
  children,
  className = "",
  setMobileMenuOpen,
}: SwipeableSheetContentProps) {
  const { onTouchEnd, onTouchMove, onTouchStart } =
    useSwipeRightDetector(setMobileMenuOpen);

  return (
    <SheetContent
      className={cn(
        `
          fixed right-0 top-0 flex h-full w-full flex-col px-0 pt-6

          sm:w-[350px]
        `,
        className,
      )}
      closeButtonAriaLabel="Close Mobile Navigation Menu"
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      onTouchStart={onTouchStart}
      side="right"
    >
      <DialogTitle className="border-b pb-6 pl-5">
        <div className="flex items-center">
          <a
            href="https://inference.net"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex"
          >
            <InferenceIcon height={20} width={120} />
          </a>
          <PlusIcon className="ml-4 h-4 w-4 text-muted-foreground" />
          <a
            href="https://laion.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex"
          >
            <img
              src={LaionLightLogo}
              alt="LAION"
              className={`
                h-12

                dark:hidden
              `}
            />
            <img
              src={LaionDarkLogo}
              alt="LAION"
              className={`
                hidden h-12

                dark:block
              `}
            />
          </a>
        </div>
      </DialogTitle>
      <DialogDescription className="hidden">
        Navigation menu for dataset controls and cluster legend.
      </DialogDescription>
      <div className="flex-1 overflow-hidden">{children}</div>
    </SheetContent>
  );
}

type MobileNavigationProps = {
  viewMode: "3d" | "heatmap" | "stacked" | "distribution" | "samples" | "force";
  onRandomPaper: () => void;
  clusters: ClusterInfo[];
  selectedClusterIds: Set<number>;
  onToggleCluster: (clusterId: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onSelectRandom: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  totalPapers: number;
  setMobileMenuOpen: (open: boolean) => void;
  loading: boolean;
  onEmailCTAClick: () => void;
};

function MobileNavigation({
  clusters,
  loading,
  onClearAll,
  onEmailCTAClick,
  onRandomPaper,
  onSearchChange,
  onSearchSubmit,
  onSelectAll,
  onSelectRandom,
  onToggleCluster,
  searchQuery,
  selectedClusterIds,
  setMobileMenuOpen,
  totalPapers,
  viewMode,
}: MobileNavigationProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="space-y-4 p-4">
        <div
          className={`space-y-3 rounded-lg border border-border bg-muted/50 p-4`}
        >
          <div className="flex items-start gap-3">
            <AtomIcon
              className={`mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground`}
            />
            <div>
              <h3 className="text-sm font-semibold">
                Science Dataset Explorer
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                This is a dataset of structured summaries from 100,000
                scientific papers generated using a custom fine-tuned model.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                View on desktop for additional visualizations and more controls.
              </p>
              <Button
                type="button"
                onClick={() => {
                  onEmailCTAClick();
                  setMobileMenuOpen(false);
                }}
                variant="default"
                size="xs"
                className="mt-4 flex w-full items-center justify-center gap-2"
              >
                Interested in the full dataset?
              </Button>
            </div>
          </div>
        </div>

        {/* Controls for 3D View */}
        {!loading && (
          <div className="space-y-3 pt-4">
            <Button
              type="button"
              onClick={() => {
                onRandomPaper();
                setMobileMenuOpen(false);
              }}
              variant="outline"
              size="xs"
              className="flex w-full items-center gap-2"
            >
              <MicroscopeIcon className="h-4 w-4" />
              Select a Random Paper
            </Button>
          </div>
        )}

        {/* Theme Toggle */}
        <div>
          <ThemeToggle
            trigger={
              <Button
                variant="outline"
                size="xs"
                className="flex w-full items-center gap-2"
              >
                <SunMoonIcon className="h-4 w-4" />
                Toggle Theme
              </Button>
            }
          />
        </div>

        {/* Cluster Legend */}
        {loading ? (
          <div className="space-y-3 border-t pt-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <div className="border-t pt-4">
            <ClusterLegend
              clusters={clusters}
              selectedClusterIds={selectedClusterIds}
              onToggleCluster={onToggleCluster}
              onSelectAll={onSelectAll}
              onClearAll={onClearAll}
              onSelectRandom={onSelectRandom}
              isCollapsed={false}
              onToggleCollapse={() => null}
              viewMode={viewMode}
              paperSearchQuery={searchQuery}
              onPaperSearchChange={onSearchChange}
              onPaperSearchSubmit={onSearchSubmit}
              totalPapers={totalPapers}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function LaionApp() {
  const posthog = usePostHog();
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [clusters, setClusters] = useState<ClusterInfo[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<number | null>(null);
  const [selectedClusterIds, setSelectedClusterIds] = useState<Set<number>>(
    new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [allPapers, setAllPapers] = useState<PaperSummary[]>([]);
  const [viewMode, setViewMode] = useState<
    "3d" | "heatmap" | "stacked" | "distribution" | "samples" | "force"
  >("3d");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [layoutType, setLayoutType] = useState<LayoutType>("original");
  const [welcomeDialogOpen, setWelcomeDialogOpen] = useState(() => {
    const hasSeenWelcome = localStorage.getItem("hasSeenWelcomeDialog");
    return hasSeenWelcome !== "true";
  });
  const [learnMoreSheetOpen, setLearnMoreSheetOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailSubmitSuccess, setEmailSubmitSuccess] = useState(false);
  const [interestedInFullDataset, setInterestedInFullDataset] = useState(true);
  const [interestedInModelTraining, setInterestedInModelTraining] =
    useState(false);
  const [hasOpenedPaperDetail, setHasOpenedPaperDetail] = useState(false);

  // Heatmap controls
  const [heatmapMinYear, setHeatmapMinYear] = useState(1990);
  const [heatmapMaxYear, setHeatmapMaxYear] = useState(2025);
  const [heatmapTopN, setHeatmapTopN] = useState(30);
  const [heatmapSortBy, setHeatmapSortBy] =
    useState<HeatmapSortOption>("total");
  const [heatmapColorScale, setHeatmapColorScale] = useState("Viridis");
  const [heatmapNormalizeByYear, setHeatmapNormalizeByYear] = useState(false);

  // Stacked chart controls
  const [stackedMinYear, setStackedMinYear] = useState(1990);
  const [stackedMaxYear, setStackedMaxYear] = useState(2025);
  const [stackedTopN, setStackedTopN] = useState(20);
  const [stackedStackMode, setStackedStackMode] =
    useState<StackMode>("absolute");
  const [stackedSortBy, setStackedSortBy] =
    useState<StackedSortOption>("total");
  const [stackedShowOther, setStackedShowOther] = useState(false);

  // Distribution chart controls
  const [distributionTopN, setDistributionTopN] = useState(100);
  const [totalClusters, setTotalClusters] = useState(100);

  // Store in local storage when welcome dialog is closed
  useEffect(() => {
    if (!welcomeDialogOpen) {
      localStorage.setItem("hasSeenWelcomeDialog", "true");
    }
  }, [welcomeDialogOpen]);

  // Track when user opens their first paper detail
  useEffect(() => {
    if (selectedPaperId !== null && !hasOpenedPaperDetail) {
      setHasOpenedPaperDetail(true);
    }
  }, [selectedPaperId, hasOpenedPaperDetail]);

  // Trigger window resize when sidebar is collapsed/expanded to force plot to resize
  useEffect(() => {
    // Small delay to let CSS transition complete
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 350);
    return () => clearTimeout(timer);
  }, [sidebarCollapsed]);

  // Fetch papers and clusters on mount
  useEffect(() => {
    Promise.all([
      fetchCompressed<PapersResponse>(getApiUrl("/api/papers")),
      fetch(getApiUrl("/api/clusters")).then((res) => res.json()),
    ])
      .then(
        ([papersData, clustersData]: [PapersResponse, ClustersResponse]) => {
          setAllPapers(papersData.papers);
          setClusters(clustersData.clusters);
          setLoading(false);
        },
      )
      .catch((err: Error) => {
        console.error("Error fetching papers and clusters", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Force 3D view on mobile (or allow force view)
  useEffect(() => {
    const checkMobile = () => {
      if (
        window.innerWidth < 1024 &&
        viewMode !== "3d" &&
        viewMode !== "force"
      ) {
        setViewMode("3d");
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [viewMode]);

  // Always filter for full text papers only
  useEffect(() => {
    setPapers(allPapers.filter((p) => p.classification === "FULL_TEXT"));
  }, [allPapers]);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      // If search is empty, reset to all papers
      fetchCompressed<PapersResponse>(getApiUrl("/api/papers"))
        .then((data) => setAllPapers(data.papers))
        .catch((err: Error) => setError(err.message));
      return;
    }

    fetchCompressed<PapersResponse>(
      getApiUrl(`/api/search?q=${encodeURIComponent(searchQuery)}`),
    )
      .then((data) => setAllPapers(data.papers))
      .catch((err: Error) => setError(err.message));
  };

  const handleToggleCluster = (clusterId: number) => {
    const newSelected = new Set(selectedClusterIds);
    if (newSelected.has(clusterId)) {
      newSelected.delete(clusterId);
    } else {
      newSelected.add(clusterId);
    }
    setSelectedClusterIds(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedClusterIds(new Set());
  };

  const handleClearAll = () => {
    setSelectedClusterIds(new Set(clusters.map(() => -1))); // Select none by using invalid IDs
  };

  const handleSelectRandom = () => {
    if (clusters.length === 0) return;
    const randomIndex = Math.floor(Math.random() * clusters.length);
    const randomCluster = clusters[randomIndex];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (randomCluster) {
      setSelectedClusterIds(new Set([randomCluster.cluster_id]));
    }
  };

  const handleRandomPaper = () => {
    if (papers.length === 0) return;
    const randomIndex = Math.floor(Math.random() * papers.length);
    const randomPaper = papers[randomIndex];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (randomPaper) {
      setSelectedPaperId(randomPaper.id);
    }
  };

  const handleHeatmapClick = (clusterId: number, year: number) => {
    // Filter papers by cluster and year, then show the first one
    const filteredPapers = papers.filter(
      (p) => p.cluster_id === clusterId && p.publication_year === year,
    );
    if (filteredPapers.length > 0 && filteredPapers[0]) {
      setSelectedPaperId(filteredPapers[0].id);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    // Clear any previous errors and start submitting
    setEmailError("");
    setEmailSubmitting(true);

    try {
      // Track email submission in PostHog
      posthog.capture("email_submitted", {
        email,
        interested_in_full_dataset: interestedInFullDataset,
        interested_in_model_training: interestedInModelTraining,
      });

      // Show success state
      setEmailSubmitSuccess(true);

      // Close dialog after a delay to show success message
      setTimeout(() => {
        setEmailDialogOpen(false);
        // Reset form state after dialog closes
        setTimeout(() => {
          setEmail("");
          setEmailError("");
          setEmailSubmitting(false);
          setEmailSubmitSuccess(false);
          setInterestedInFullDataset(true);
          setInterestedInModelTraining(false);
        }, 300); // Wait for dialog close animation
      }, 1500); // Show success for 1.5 seconds
    } catch (err: unknown) {
      console.error("Error submitting email", err);
      setEmailError("Failed to submit. Please try again.");
      setEmailSubmitting(false);
    }
  };

  if (error) {
    return (
      <Centered className="flex h-screen flex-col bg-background">
        <Card
          className={`
            flex flex-col items-center justify-center gap-6 p-6 py-8 text-xl
          `}
        >
          <h3 className="font-semibold">Failed to load...</h3>
          <p className="text-muted-foreground">Please try again later.</p>
        </Card>
      </Centered>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <style>{`
        @keyframes shimmer {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            opacity: 1;
          }
        }
        .shimmer-text {
          animation: shimmer 2s ease-in-out infinite;
        }
      `}</style>
      <header
        className={cn(`
          border-b border-border bg-background text-foreground shadow-md

          lg:hidden
        `)}
      >
        {/* First row: logos and menu */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <a
              href="https://inference.net"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <InferenceIcon height={20} width={120} />
            </a>
            <PlusIcon className="ml-3 h-3 w-3 text-muted-foreground" />
            <a
              href="https://laion.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <img
                src={LaionLightLogo}
                alt="LAION"
                className={`
                  h-10

                  dark:hidden
                `}
              />
              <img
                src={LaionDarkLogo}
                alt="LAION"
                className={`
                  hidden h-10

                  dark:block
                `}
              />
            </a>
          </div>
          <Sheet onOpenChange={setMobileMenuOpen} open={mobileMenuOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button
                aria-label="Open Mobile Navigation Menu"
                size="icon"
                variant="ghost"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SwipeableSheetContent setMobileMenuOpen={setMobileMenuOpen}>
              <MobileNavigation
                viewMode={viewMode}
                onRandomPaper={handleRandomPaper}
                clusters={clusters}
                selectedClusterIds={selectedClusterIds}
                onToggleCluster={handleToggleCluster}
                onSelectAll={handleSelectAll}
                onClearAll={handleClearAll}
                onSelectRandom={handleSelectRandom}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSearchSubmit={handleSearch}
                totalPapers={papers.length}
                setMobileMenuOpen={setMobileMenuOpen}
                loading={loading}
                onEmailCTAClick={() => setEmailDialogOpen(true)}
              />
            </SwipeableSheetContent>
          </Sheet>
        </div>
        {/* Second row: cluster plot select and what is this button */}
        <div
          className={`
            flex items-center justify-between border-t border-border px-4 py-2
          `}
        >
          {loading ? (
            <span className="text-sm text-muted-foreground">Loading...</span>
          ) : viewMode === "3d" ? (
            <Select
              value={layoutType}
              onValueChange={(value) => setLayoutType(value as LayoutType)}
              options={[
                { value: "original", label: "Embeddings" },
                { value: "sphere", label: "Sphere" },
                { value: "galaxy", label: "Galaxy" },
                { value: "wave", label: "Wave" },
                { value: "helix", label: "Helix" },
                { value: "torus", label: "Torus" },
              ]}
              placeholder="Select layout"
              className="w-[160px]"
            />
          ) : (
            <div />
          )}
          <Button
            size="xs"
            onClick={() => setLearnMoreSheetOpen(true)}
            variant="outline"
          >
            <AtomIcon className="mr-1.5 h-3.5 w-3.5" />
            What is this?
          </Button>
        </div>
      </header>
      <header
        className={`
          hidden border-b border-border bg-background text-foreground shadow-md

          lg:block
        `}
      >
        <div className="space-y-1 px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <a
                href="https://inference.net"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex"
              >
                <InferenceIcon height={24} width={164} />
              </a>
              <PlusIcon className="ml-4 h-4 w-4 text-muted-foreground" />
              <a
                href="https://laion.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex"
              >
                <img
                  src={LaionLightLogo}
                  alt="LAION"
                  className={`
                    h-14

                    dark:hidden
                  `}
                />
                <img
                  src={LaionDarkLogo}
                  alt="LAION"
                  className={`
                    hidden h-14

                    dark:block
                  `}
                />
              </a>
              <ChevronRightIcon className="mr-3 h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">Science Dataset Explorer</h2>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle
                trigger={
                  <Button
                    variant="ghost"
                    size="xs"
                    className={`flex items-center gap-2`}
                  >
                    <SunMoonIcon className="h-4 w-4" />
                    Theme
                  </Button>
                }
              />
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  window.open(
                    "https://github.com/context-labs/laion-data-explorer",
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                <GithubIcon className="mr-2 h-4 w-4" />
                GitHub
              </Button>
              <Button
                size="xs"
                disabled={viewMode === "samples"}
                variant="outline"
                onClick={() =>
                  setViewMode(viewMode === "samples" ? "3d" : "samples")
                }
              >
                <NotebookTextIcon className="mr-2 h-4 w-4" />
                Paper Explorer
              </Button>
              <Button
                size="xs"
                variant="default"
                onClick={() => setEmailDialogOpen(true)}
              >
                Interested in the full dataset?
              </Button>
              <Button size="xs" onClick={() => setLearnMoreSheetOpen(true)}>
                <AtomIcon className="mr-2 h-4 w-4" />
                What is this?
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => setViewMode("3d")}
                variant={viewMode === "3d" ? "default" : "outline"}
                size="xs"
                className="flex w-fit items-center justify-start gap-1.5"
              >
                <ChartNetworkIcon className="h-3.5 w-3.5" />
                Embeddings
              </Button>
              <Button
                type="button"
                onClick={() => setViewMode("force")}
                variant={viewMode === "force" ? "default" : "outline"}
                size="xs"
                className="flex w-fit items-center justify-start gap-1.5"
              >
                <NetworkIcon className="h-3.5 w-3.5" />
                Force Graph
              </Button>
              <Button
                type="button"
                onClick={() => setViewMode("distribution")}
                variant={viewMode === "distribution" ? "default" : "outline"}
                size="xs"
                className="flex w-32 items-center gap-1.5"
              >
                <BarChart3Icon className="h-3.5 w-3.5" />
                Distribution
              </Button>
              <Button
                type="button"
                onClick={() => setViewMode("stacked")}
                variant={viewMode === "stacked" ? "default" : "outline"}
                size="xs"
                className="flex w-fit items-center justify-start gap-1.5"
              >
                <BarChartIcon className="h-3.5 w-3.5" />
                Stacked
              </Button>
              <Button
                type="button"
                onClick={() => setViewMode("heatmap")}
                variant={viewMode === "heatmap" ? "default" : "outline"}
                size="xs"
                className="flex w-fit items-center justify-start gap-1.5"
              >
                <LayoutGridIcon className="h-3.5 w-3.5" />
                Heatmap
              </Button>
              {viewMode === "3d" && (
                <span
                  className={`
                    ml-2 text-xs text-muted-foreground

                    ${!hasOpenedPaperDetail ? "shimmer-text" : ""}
                  `}
                >
                  Click + Cmd/Ctrl Key on a cluster node to open paper details
                </span>
              )}
            </div>
            <Row className="items-center gap-4">
              {!loading && viewMode === "3d" && (
                <>
                  <Select
                    value={layoutType}
                    onValueChange={(value) =>
                      setLayoutType(value as LayoutType)
                    }
                    options={[
                      { value: "original", label: "Embeddings" },
                      { value: "sphere", label: "Sphere" },
                      { value: "galaxy", label: "Galaxy" },
                      { value: "wave", label: "Wave" },
                      { value: "helix", label: "Helix" },
                      { value: "torus", label: "Torus" },
                    ]}
                    placeholder="Select layout"
                    className="w-[180px]"
                  />
                  <Button
                    type="button"
                    onClick={handleRandomPaper}
                    variant="outline"
                    size="xs"
                    className="flex items-center gap-2"
                  >
                    <MicroscopeIcon className="h-4 w-4" />
                    Select a Random Paper
                  </Button>
                </>
              )}
              {!loading && viewMode === "distribution" && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-foreground">
                    Clusters:{" "}
                    <span className="font-semibold">{distributionTopN}</span>
                  </label>
                  <Slider
                    aria-label="Number of clusters to display"
                    className="w-48"
                    value={[distributionTopN]}
                    min={10}
                    max={totalClusters}
                    step={1}
                    onValueChange={([value]) =>
                      value && setDistributionTopN(value)
                    }
                  />
                </div>
              )}
            </Row>
          </div>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        {viewMode === "3d" ? (
          <>
            <aside
              className={`
                hidden overflow-y-auto border-r border-border bg-background
                shadow-sm transition-all duration-300

                lg:block

                ${sidebarCollapsed ? "w-10 overflow-hidden" : "w-[360px]"}
              `}
            >
              {loading ? (
                <div className="space-y-3 p-4">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-10 w-full" />
                  <Row className="gap-4">
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-8 w-1/3" />
                  </Row>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                <ClusterLegend
                  clusters={clusters}
                  selectedClusterIds={selectedClusterIds}
                  onToggleCluster={handleToggleCluster}
                  onSelectAll={handleSelectAll}
                  onClearAll={handleClearAll}
                  onSelectRandom={handleSelectRandom}
                  isCollapsed={sidebarCollapsed}
                  onToggleCollapse={() =>
                    setSidebarCollapsed(!sidebarCollapsed)
                  }
                  viewMode={viewMode}
                  paperSearchQuery={searchQuery}
                  onPaperSearchChange={setSearchQuery}
                  onPaperSearchSubmit={handleSearch}
                  totalPapers={papers.length}
                />
              )}
            </aside>
            <main className="flex-1 overflow-hidden bg-background p-0">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="relative">
                    <Skeleton className="h-96 w-96 rounded-full" />
                    <span
                      className={`
                        absolute left-1/2 top-1/2 -translate-x-1/2
                        -translate-y-1/2 text-base text-muted-foreground

                        lg:hidden
                      `}
                    >
                      Loading Visualization...
                    </span>
                  </div>
                </div>
              ) : (
                <ClusterVisualization
                  papers={papers}
                  clusters={clusters}
                  onPaperClick={(paperId) => {
                    if (!selectedPaperId) {
                      setSelectedPaperId(paperId);
                    }
                  }}
                  selectedClusterIds={selectedClusterIds}
                  layoutType={layoutType}
                />
              )}
            </main>
          </>
        ) : viewMode === "distribution" ? (
          <main className="flex-1 overflow-hidden bg-background">
            {loading ? (
              <div className="flex h-full items-center justify-center p-8">
                <div className="w-full max-w-4xl space-y-4">
                  <Skeleton className="h-12 w-64" />
                  <Skeleton className="h-[500px] w-full" />
                </div>
              </div>
            ) : (
              <DistributionChart
                onClusterClick={(clusterId) => {
                  // When clicking a cluster in the distribution chart, switch to 3D view and select that cluster
                  setViewMode("3d");
                  setSelectedClusterIds(new Set([clusterId]));
                }}
                topN={distributionTopN}
                onTotalClustersLoaded={setTotalClusters}
              />
            )}
          </main>
        ) : viewMode === "heatmap" ? (
          <main className="flex-1 overflow-hidden bg-background">
            {loading ? (
              <div className="flex h-full items-center justify-center p-8">
                <div className="w-full max-w-6xl space-y-4">
                  <Skeleton className="h-12 w-64" />
                  <Skeleton className="h-[600px] w-full" />
                </div>
              </div>
            ) : (
              <TemporalHeatmap
                onPaperClick={handleHeatmapClick}
                minYear={heatmapMinYear}
                maxYear={heatmapMaxYear}
                topN={heatmapTopN}
                sortBy={heatmapSortBy}
                colorScale={heatmapColorScale}
                normalizeByYear={heatmapNormalizeByYear}
                onMinYearChange={setHeatmapMinYear}
                onMaxYearChange={setHeatmapMaxYear}
                onTopNChange={setHeatmapTopN}
                onSortByChange={setHeatmapSortBy}
                onColorScaleChange={setHeatmapColorScale}
                onNormalizeByYearChange={setHeatmapNormalizeByYear}
              />
            )}
          </main>
        ) : viewMode === "samples" ? (
          <main className="flex-1 overflow-hidden bg-background">
            <PaperSampleViewer clusters={clusters} />
          </main>
        ) : viewMode === "force" ? (
          <main className="flex-1 overflow-hidden bg-background">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="relative">
                  <Skeleton className="h-96 w-96 rounded-full" />
                  <span
                    className={`
                      absolute left-1/2 top-1/2 -translate-x-1/2
                      -translate-y-1/2 text-base text-muted-foreground

                      lg:hidden
                    `}
                  >
                    Loading Force Graph...
                  </span>
                </div>
              </div>
            ) : (
              <ForceDirectedCluster
                papers={papers}
                clusters={clusters}
                onPaperClick={(paperId) => setSelectedPaperId(paperId)}
                selectedClusterIds={selectedClusterIds}
              />
            )}
          </main>
        ) : (
          <main className="flex-1 overflow-hidden bg-background">
            {loading ? (
              <div className="flex h-full items-center justify-center p-8">
                <div className="w-full max-w-6xl space-y-4">
                  <Skeleton className="h-12 w-64" />
                  <Skeleton className="h-[600px] w-full" />
                </div>
              </div>
            ) : (
              <TemporalStackedChart
                onPaperClick={handleHeatmapClick}
                minYear={stackedMinYear}
                maxYear={stackedMaxYear}
                topN={stackedTopN}
                stackMode={stackedStackMode}
                sortBy={stackedSortBy}
                showOther={stackedShowOther}
                onMinYearChange={setStackedMinYear}
                onMaxYearChange={setStackedMaxYear}
                onTopNChange={setStackedTopN}
                onStackModeChange={setStackedStackMode}
                onSortByChange={setStackedSortBy}
                onShowOtherChange={setStackedShowOther}
              />
            )}
          </main>
        )}
      </div>
      <PaperDetail
        paperId={selectedPaperId}
        onClose={() => setSelectedPaperId(null)}
        onPaperClick={(paperId) => {
          setSelectedPaperId(paperId);
          if (!hasOpenedPaperDetail) {
            setHasOpenedPaperDetail(true);
          }
        }}
        clusters={clusters}
      />
      <DialogRoot open={welcomeDialogOpen} onOpenChange={setWelcomeDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Welcome to the Science Dataset Explorer</DialogTitle>
            <DialogDescription>
              Explore a comprehensive dataset of scientific research papers
            </DialogDescription>
          </DialogHeader>
          <div className="p-4">
            <LearnMoreContent />
          </div>
          <DialogFooter className="flex items-center justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setWelcomeDialogOpen(false);
                setLearnMoreSheetOpen(true);
              }}
            >
              Learn More
            </Button>
            <Button onClick={() => setWelcomeDialogOpen(false)}>
              View Dataset
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
      <LearnMoreSheet
        open={learnMoreSheetOpen}
        onClose={() => setLearnMoreSheetOpen(false)}
        onEmailCTAClick={() => setEmailDialogOpen(true)}
      />
      <DialogRoot
        open={emailDialogOpen}
        onOpenChange={(open) => {
          // Prevent closing during submission
          if (emailSubmitting || emailSubmitSuccess) return;
          setEmailDialogOpen(open);
          if (!open) {
            setEmailError("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          {emailSubmitSuccess ? (
            <>
              <DialogHeader>
                <DialogTitle>Thank You!</DialogTitle>
                <DialogDescription>
                  We've received your information and will keep you updated.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-center p-8">
                <div
                  className={`
                    flex h-16 w-16 items-center justify-center rounded-full
                    bg-green-100

                    dark:bg-green-900
                  `}
                >
                  <svg
                    className={`
                      h-8 w-8 text-green-600

                      dark:text-green-400
                    `}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Stay Updated on the Full Dataset</DialogTitle>
                <DialogDescription>
                  The full ~50m dataset is currently being processed. Enter your
                  email below if you would like to be notified with updates.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEmailSubmit}>
                <div className="space-y-4 p-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError("");
                      }}
                      required
                      disabled={emailSubmitting}
                      className={emailError ? "border-red-500" : ""}
                    />
                    {emailError && (
                      <p className="text-sm text-red-500">{emailError}</p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="full-dataset"
                        checked={interestedInFullDataset}
                        onCheckedChange={(checked) =>
                          setInterestedInFullDataset(checked === true)
                        }
                        disabled={emailSubmitting}
                      />
                      <Label htmlFor="full-dataset" className="cursor-pointer">
                        I'm interested in the full dataset
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="model-training"
                        checked={interestedInModelTraining}
                        onCheckedChange={(checked) =>
                          setInterestedInModelTraining(checked === true)
                        }
                        disabled={emailSubmitting}
                      />
                      <Label
                        htmlFor="model-training"
                        className="cursor-pointer"
                      >
                        I'm interested in custom model-training
                      </Label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEmailDialogOpen(false)}
                    disabled={emailSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={emailSubmitting}>
                    {emailSubmitting ? "Submitting..." : "Submit"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </DialogRoot>
    </div>
  );
}
