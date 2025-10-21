import { useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import Plot from "react-plotly.js";

import { Button, Input, Select, useTheme } from "@kuzco/ui-library";

import type { ClusterTemporalData, TemporalDataResponse } from "../types";
import {
  createYearRangeKey,
  temporalDataAtomFamily,
} from "../state/chartDataCache";
import { getApiUrl } from "../utils/api";

interface TemporalHeatmapProps {
  onPaperClick?: (clusterId: number, year: number) => void;
  minYear?: number;
  maxYear?: number;
  topN?: number;
  sortBy?: HeatmapSortOption;
  colorScale?: string;
  normalizeByYear?: boolean;
  onMinYearChange?: (value: number) => void;
  onMaxYearChange?: (value: number) => void;
  onTopNChange?: (value: number) => void;
  onSortByChange?: (value: HeatmapSortOption) => void;
  onColorScaleChange?: (value: string) => void;
  onNormalizeByYearChange?: (value: boolean) => void;
}

export type HeatmapSortOption = "total" | "peak_year" | "alphabetical";

export function TemporalHeatmap({
  onPaperClick,
  minYear: propMinYear,
  maxYear: propMaxYear,
  topN: propTopN,
  sortBy: propSortBy,
  colorScale: propColorScale,
  normalizeByYear: propNormalizeByYear,
  onMinYearChange,
  onMaxYearChange,
  onTopNChange,
  onSortByChange,
  onColorScaleChange,
  onNormalizeByYearChange,
}: TemporalHeatmapProps) {
  const { isDarkTheme } = useTheme();
  const [temporalData, setTemporalData] = useState<ClusterTemporalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Controls - use props if provided, otherwise use local state
  const [localMinYear, setLocalMinYear] = useState(1990);
  const [localMaxYear, setLocalMaxYear] = useState(2025);
  const [localTopN, setLocalTopN] = useState(30);
  const [localSortBy, setLocalSortBy] = useState<HeatmapSortOption>("total");
  const [localColorScale, setLocalColorScale] = useState("Viridis");
  const [localNormalizeByYear, setLocalNormalizeByYear] = useState(false);

  // Separate state for committed year values (used for API fetch)
  const [committedMinYear, setCommittedMinYear] = useState(1990);
  const [committedMaxYear, setCommittedMaxYear] = useState(2025);

  const minYear = propMinYear ?? localMinYear;
  const maxYear = propMaxYear ?? localMaxYear;
  const topN = propTopN ?? localTopN;
  const sortBy = propSortBy ?? localSortBy;
  const colorScale = propColorScale ?? localColorScale;
  const normalizeByYear = propNormalizeByYear ?? localNormalizeByYear;

  const setMinYear = onMinYearChange ?? setLocalMinYear;
  const setMaxYear = onMaxYearChange ?? setLocalMaxYear;
  const setTopN = onTopNChange ?? setLocalTopN;
  const setSortBy = onSortByChange ?? setLocalSortBy;
  const setColorScale = onColorScaleChange ?? setLocalColorScale;
  const setNormalizeByYear = onNormalizeByYearChange ?? setLocalNormalizeByYear;

  // Statistics
  const [stats, setStats] = useState({
    totalPapers: 0,
    mostActiveYear: 0,
    mostActiveCluster: "",
    fastestGrowing: "",
  });

  // Fetch temporal data - use committed values with caching
  const fetchMinYear = propMinYear ?? committedMinYear;
  const fetchMaxYear = propMaxYear ?? committedMaxYear;
  const yearRangeKey = createYearRangeKey(fetchMinYear, fetchMaxYear);
  const [cachedTemporalData, setCachedTemporalData] = useAtom(
    temporalDataAtomFamily(yearRangeKey),
  );

  useEffect(() => {
    // If we have cached data for this year range, use it immediately
    if (cachedTemporalData) {
      setTemporalData(cachedTemporalData);
      setLoading(false);
      return;
    }

    // Otherwise, fetch the data
    setLoading(true);
    fetch(
      getApiUrl(
        `/api/temporal-data?min_year=${fetchMinYear}&max_year=${fetchMaxYear}`,
      ),
    )
      .then((res) => res.json())
      .then((data: TemporalDataResponse) => {
        setTemporalData(data.clusters);
        setCachedTemporalData(data.clusters); // Cache the data
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [
    fetchMinYear,
    fetchMaxYear,
    yearRangeKey,
    cachedTemporalData,
    setCachedTemporalData,
  ]);

  // Process data for heatmap
  const processedData = useMemo(() => {
    if (!temporalData.length) return null;

    // Calculate total papers per cluster
    const clusterTotals = temporalData.map((cluster) => ({
      cluster_id: cluster.cluster_id,
      cluster_label: cluster.cluster_label,
      color: cluster.color,
      total: cluster.temporal_data.reduce((sum, d) => sum + d.count, 0),
      peak_year: cluster.temporal_data.reduce(
        (max, d) => (d.count > max.count ? d : max),
        cluster.temporal_data[0] ?? { year: 0, count: 0 },
      ).year,
      temporal_data: cluster.temporal_data,
    }));

    // Sort clusters
    let sortedClusters = [...clusterTotals];
    if (sortBy === "total") {
      sortedClusters.sort((a, b) => b.total - a.total);
    } else if (sortBy === "peak_year") {
      sortedClusters.sort((a, b) => b.peak_year - a.peak_year);
    } else {
      sortedClusters.sort((a, b) =>
        a.cluster_label.localeCompare(b.cluster_label),
      );
    }

    // Take top N clusters
    sortedClusters = sortedClusters.slice(0, topN);

    // Get all years in range
    const years = Array.from(
      { length: maxYear - minYear + 1 },
      (_, i) => minYear + i,
    );

    // Build matrix: rows = clusters, columns = years
    const matrix: number[][] = [];
    const clusterLabels: string[] = [];
    const clusterIds: number[] = [];

    // Calculate year totals for normalization
    const yearTotals = new Map<number, number>();
    if (normalizeByYear) {
      temporalData.forEach((cluster) => {
        cluster.temporal_data.forEach((d) => {
          yearTotals.set(d.year, (yearTotals.get(d.year) ?? 0) + d.count);
        });
      });
    }

    sortedClusters.forEach((cluster) => {
      clusterLabels.push(cluster.cluster_label);
      clusterIds.push(cluster.cluster_id);

      // Create a map of year -> count for this cluster
      const yearCountMap = new Map(
        cluster.temporal_data.map((d) => [d.year, d.count]),
      );

      // Build row for this cluster
      const row = years.map((year) => {
        const count = yearCountMap.get(year) ?? 0;
        if (normalizeByYear && count > 0) {
          const yearTotal = yearTotals.get(year) ?? 1;
          return (count / yearTotal) * 100; // Percentage
        }
        return count;
      });
      matrix.push(row);
    });

    // Calculate statistics
    const totalPapers = clusterTotals.reduce((sum, c) => sum + c.total, 0);
    const yearCounts = new Map<number, number>();
    temporalData.forEach((cluster) => {
      cluster.temporal_data.forEach((d) => {
        yearCounts.set(d.year, (yearCounts.get(d.year) ?? 0) + d.count);
      });
    });
    const mostActiveYear = Array.from(yearCounts.entries()).reduce((max, e) =>
      e[1] > max[1] ? e : max,
    )[0];
    const mostActiveCluster = clusterTotals[0]?.cluster_label ?? "N/A";

    // Calculate fastest growing cluster (% increase from first to last year with data)
    const growthRates = clusterTotals
      .map((cluster) => {
        const data = cluster.temporal_data;
        if (data.length < 2) return { label: cluster.cluster_label, rate: 0 };

        const firstYear = data[0];
        const lastYear = data[data.length - 1];
        if (!firstYear || !lastYear || firstYear.count === 0)
          return { label: cluster.cluster_label, rate: 0 };

        const rate =
          ((lastYear.count - firstYear.count) / firstYear.count) * 100;
        return { label: cluster.cluster_label, rate };
      })
      .filter((r) => r.rate > 0);

    const fastestGrowing =
      growthRates.length > 0
        ? growthRates.reduce((max, r) => (r.rate > max.rate ? r : max)).label
        : "N/A";

    return {
      matrix,
      years,
      clusterLabels,
      clusterIds,
      stats: {
        totalPapers,
        mostActiveYear,
        mostActiveCluster,
        fastestGrowing,
      },
    };
  }, [temporalData, sortBy, topN, minYear, maxYear, normalizeByYear]);

  // Update stats when processedData changes
  useEffect(() => {
    if (processedData?.stats) {
      setStats(processedData.stats);
    }
  }, [processedData]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading heatmap data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-destructive">Error: {error}</p>
      </div>
    );
  }

  if (!processedData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  const { matrix, years, clusterLabels, clusterIds } = processedData;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Controls Panel */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-foreground">Year Range:</label>
            <Input
              type="number"
              value={minYear}
              onChange={(e) => setMinYear(parseInt(e.target.value))}
              onBlur={(e) => {
                const value = parseInt(e.target.value);
                if (!propMinYear) {
                  setCommittedMinYear(value);
                }
              }}
              className="w-20 text-sm"
              min={1990}
              max={2025}
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="number"
              value={maxYear}
              onChange={(e) => setMaxYear(parseInt(e.target.value))}
              onBlur={(e) => {
                const value = parseInt(e.target.value);
                if (!propMaxYear) {
                  setCommittedMaxYear(value);
                }
              }}
              className="w-20 text-sm"
              min={1990}
              max={2025}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-foreground">Top Clusters:</label>
            <Select
              value={topN.toString()}
              onValueChange={(value) => setTopN(parseInt(value))}
              options={[
                { value: "20", label: "20" },
                { value: "30", label: "30" },
                { value: "50", label: "50" },
                { value: "100", label: "100" },
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-foreground">Sort By:</label>
            <Select
              value={sortBy}
              onValueChange={(value) => setSortBy(value as HeatmapSortOption)}
              options={[
                { value: "total", label: "Total Papers" },
                { value: "peak_year", label: "Peak Year" },
                { value: "alphabetical", label: "Alphabetical" },
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-foreground">Color Scale:</label>
            <Select
              value={colorScale}
              onValueChange={(value) => setColorScale(value)}
              options={[
                { value: "Viridis", label: "Viridis" },
                { value: "Blues", label: "Blues" },
                { value: "Reds", label: "Reds" },
                { value: "Greens", label: "Greens" },
                { value: "YlOrRd", label: "Yellow-Orange-Red" },
                { value: "Plasma", label: "Plasma" },
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant={normalizeByYear ? "default" : "outline"}
              onClick={() => setNormalizeByYear(!normalizeByYear)}
            >
              {normalizeByYear ? "Normalized" : "Absolute Count"}
            </Button>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="flex-1 overflow-hidden p-4">
        <Plot
          data={[
            {
              z: matrix,
              x: years,
              y: clusterLabels,
              type: "heatmap",
              colorscale: colorScale,
              hovertemplate:
                "<b>%{y}</b><br>" +
                "Year: %{x}<br>" +
                (normalizeByYear ? "Percentage: %{z:.1f}%" : "Papers: %{z}") +
                "<extra></extra>",
              colorbar: {
                title: normalizeByYear ? "% of Year" : "Papers",
                titleside: "right",
                tickfont: {
                  color: isDarkTheme ? "#d1d5db" : "#333",
                },
                titlefont: {
                  color: isDarkTheme ? "#d1d5db" : "#333",
                },
              },
            },
          ]}
          layout={{
            xaxis: {
              title: "Publication Year",
              tickfont: { color: isDarkTheme ? "#d1d5db" : "#333" },
              titlefont: { color: isDarkTheme ? "#f9fafb" : "#111" },
              gridcolor: isDarkTheme ? "#374151" : "#e0e0e0",
            },
            yaxis: {
              tickfont: {
                size: 10,
                color: isDarkTheme ? "#d1d5db" : "#333",
              },
              automargin: true,
            },
            paper_bgcolor: isDarkTheme ? "#0d121c" : "white",
            plot_bgcolor: isDarkTheme ? "#0d121c" : "white",
            margin: { t: 20, r: 120, b: 60, l: 250 },
            autosize: true,
            hovermode: "closest",
          }}
          config={{
            displayModeBar: false,
            displaylogo: false,
            responsive: true,
          }}
          useResizeHandler={true}
          style={{ width: "100%", height: "100%" }}
          onClick={(e: unknown) => {
            const event = e as { points?: { x: number; y: number }[] };
            if (event.points?.[0] && onPaperClick) {
              const point = event.points[0];
              const year = point.x;
              const clusterIndex = point.y;
              const clusterId = clusterIds[clusterIndex];
              if (clusterId !== undefined) {
                onPaperClick(clusterId, year);
              }
            }
          }}
        />
      </div>
      <div className="border-t border-border bg-background px-6 py-3">
        <div className="flex items-center justify-around text-sm">
          <div>
            <span className="text-muted-foreground">Total Papers: </span>
            <span className="font-semibold text-foreground">
              {stats.totalPapers.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Most Active Year: </span>
            <span className="font-semibold text-foreground">
              {stats.mostActiveYear}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Largest Cluster: </span>
            <span className="font-semibold text-foreground">
              {stats.mostActiveCluster}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Fastest Growing: </span>
            <span className="font-semibold text-foreground">
              {stats.fastestGrowing}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
