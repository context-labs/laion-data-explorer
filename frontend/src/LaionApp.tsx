import { useEffect, useState } from "react";
import {
  AtomIcon,
  BarChart3Icon,
  BarChartIcon,
  ChartNetworkIcon,
  ChevronRightIcon,
  LayoutGridIcon,
  Menu,
  MicroscopeIcon,
  PlusIcon,
  SunMoonIcon,
} from "lucide-react";

import {
  Button,
  Card,
  Centered,
  cn,
  DialogDescription,
  DialogTitle,
  Row,
  Sheet,
  SheetContent,
  SheetTrigger,
  Slider,
  ThemeToggle,
  InferenceIcon,
} from "~/ui";
import { useSwipeRightDetector } from "~/lib/ui-shared";

import type { HeatmapSortOption } from "./components/TemporalHeatmap";
import type {
  StackedSortOption,
  StackMode,
} from "./components/TemporalStackedChart";
import type {
  ClusterInfo,
  ClustersResponse,
  PapersResponse,
  PaperSummary,
} from "./types";
import type { LayoutType } from "./utils/layoutTransforms";
import LaionDarkLogo from "./assets/logos/Laion-dark.svg";
import LaionLightLogo from "./assets/logos/Laion-light.svg";
import { ClusterLegend } from "./components/ClusterLegend";
import { ClusterVisualization } from "./components/ClusterVisualization";
import { DistributionChart } from "./components/DistributionChart";
import { PaperDetail } from "./components/PaperDetail";
import { TemporalHeatmap } from "./components/TemporalHeatmap";
import { TemporalStackedChart } from "./components/TemporalStackedChart";
import { fetchCompressed, getApiUrl } from "./utils/api";

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
          <InferenceIcon height={20} width={120} />
          <PlusIcon className="ml-4 h-4 w-4 text-muted-foreground" />
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
  viewMode: "3d" | "heatmap" | "stacked" | "distribution";
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
};

function MobileNavigation({
  clusters,
  onClearAll,
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
                variant="outline"
                size="xs"
                className="mt-2 flex w-full items-center gap-2 font-semibold"
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>

        {/* Controls for 3D View */}
        <div className="space-y-3 border-t pt-4">
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

        {/* Theme Toggle */}
        <div className="border-t pt-4">
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
      </div>
    </div>
  );
}

export default function LaionApp() {
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
    "3d" | "heatmap" | "stacked" | "distribution"
  >("3d");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [layoutType, setLayoutType] = useState<LayoutType>("original");

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

  // Force 3D view on mobile
  useEffect(() => {
    const checkMobile = () => {
      if (window.innerWidth < 1024 && viewMode !== "3d") {
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
      // If search is empty, reset to sampled papers
      fetchCompressed<PapersResponse>(getApiUrl("/api/papers?sample_size=100"))
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
    if (randomCluster) {
      setSelectedClusterIds(new Set([randomCluster.cluster_id]));
    }
  };

  const handleRandomPaper = () => {
    if (papers.length === 0) return;
    const randomIndex = Math.floor(Math.random() * papers.length);
    const randomPaper = papers[randomIndex];
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

  if (loading) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <div
          className={`flex h-screen flex-col items-center justify-center gap-6`}
        >
          <div className="flex flex-col items-center gap-4">
            <InferenceIcon height={32} width={220} />
            <img
              src={LaionLightLogo}
              alt="LAION"
              className={`
                h-20

                dark:hidden
              `}
            />
            <img
              src={LaionDarkLogo}
              alt="LAION"
              className={`
                hidden h-20

                dark:block
              `}
            />
          </div>
          <h3 className="text-foreground">
            Initializing Science Dataset Explorer
            <span className="loading-dots ml-1 inline-block">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </h3>
        </div>
      </div>
    );
  }

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
      <header
        className={cn(`
          flex items-center justify-between border-b border-border bg-background
          p-4 text-foreground shadow-md

          lg:hidden
        `)}
      >
        <div className="flex items-center">
          <InferenceIcon height={20} width={120} />
          <PlusIcon className="ml-3 h-3 w-3 text-muted-foreground" />
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
            />
          </SwipeableSheetContent>
        </Sheet>
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
              <InferenceIcon height={24} width={164} />
              <PlusIcon className="ml-4 h-4 w-4 text-muted-foreground" />
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
              <ChevronRightIcon className="mr-3 h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">Science Dataset Explorer</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => setViewMode("3d")}
                  variant={viewMode === "3d" ? "default" : "outline"}
                  size="xs"
                  className="flex w-24 items-center gap-1.5"
                >
                  <ChartNetworkIcon className="h-3.5 w-3.5" />
                  Clusters
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
                  className="flex w-24 items-center gap-1.5"
                >
                  <BarChartIcon className="h-3.5 w-3.5" />
                  Stacked
                </Button>
                <Button
                  type="button"
                  onClick={() => setViewMode("heatmap")}
                  variant={viewMode === "heatmap" ? "default" : "outline"}
                  size="xs"
                  className="flex w-24 items-center gap-1.5"
                >
                  <LayoutGridIcon className="h-3.5 w-3.5" />
                  Heatmap
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              This is a dataset of structured summaries from 100,000 scientific
              papers generated using a custom fine-tuned model. Learn more.
            </p>
            <Row className="items-center gap-4">
              {viewMode === "3d" && (
                <>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => setLayoutType("original")}
                      variant={
                        layoutType === "original" ? "default" : "outline"
                      }
                      size="xs"
                      className="flex items-center"
                    >
                      Scatter
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setLayoutType("sphere")}
                      variant={layoutType === "sphere" ? "default" : "outline"}
                      size="xs"
                      className="flex items-center"
                    >
                      Sphere
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setLayoutType("galaxy")}
                      variant={layoutType === "galaxy" ? "default" : "outline"}
                      size="xs"
                      className="flex items-center"
                    >
                      Galaxy
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setLayoutType("wave")}
                      variant={layoutType === "wave" ? "default" : "outline"}
                      size="xs"
                      className="flex items-center"
                    >
                      Wave
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setLayoutType("helix")}
                      variant={layoutType === "helix" ? "default" : "outline"}
                      size="xs"
                      className="flex items-center"
                    >
                      Helix
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setLayoutType("torus")}
                      variant={layoutType === "torus" ? "default" : "outline"}
                      size="xs"
                      className="flex items-center"
                    >
                      Torus
                    </Button>
                  </div>
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
              {viewMode === "distribution" && (
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
              <ClusterLegend
                clusters={clusters}
                selectedClusterIds={selectedClusterIds}
                onToggleCluster={handleToggleCluster}
                onSelectAll={handleSelectAll}
                onClearAll={handleClearAll}
                onSelectRandom={handleSelectRandom}
                isCollapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                viewMode={viewMode}
                paperSearchQuery={searchQuery}
                onPaperSearchChange={setSearchQuery}
                onPaperSearchSubmit={handleSearch}
                totalPapers={papers.length}
              />
            </aside>
            <main className="flex-1 overflow-hidden bg-background p-0">
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
            </main>
          </>
        ) : viewMode === "distribution" ? (
          <main className="flex-1 overflow-hidden bg-background">
            <DistributionChart
              onClusterClick={(clusterId) => {
                // When clicking a cluster in the distribution chart, switch to 3D view and select that cluster
                setViewMode("3d");
                setSelectedClusterIds(new Set([clusterId]));
              }}
              topN={distributionTopN}
              onTotalClustersLoaded={setTotalClusters}
            />
          </main>
        ) : viewMode === "heatmap" ? (
          <main className="flex-1 overflow-hidden bg-background">
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
          </main>
        ) : (
          <main className="flex-1 overflow-hidden bg-background">
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
          </main>
        )}
      </div>
      <PaperDetail
        paperId={selectedPaperId}
        onClose={() => setSelectedPaperId(null)}
        onPaperClick={(paperId) => setSelectedPaperId(paperId)}
      />
    </div>
  );
}
