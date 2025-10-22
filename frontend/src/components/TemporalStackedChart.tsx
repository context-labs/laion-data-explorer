import { useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import Plot from "react-plotly.js";

import { Input, Select, Switch, useTheme } from "~/ui";

import type { ClusterTemporalData, TemporalDataResponse } from "../types";
import {
  createYearRangeKey,
  temporalDataAtomFamily,
} from "../state/chartDataCache";
import { getApiUrl } from "../utils/api";

interface TemporalStackedChartProps {
  onPaperClick?: (clusterId: number, year: number) => void;
  minYear?: number;
  maxYear?: number;
  topN?: number;
  stackMode?: StackMode;
  sortBy?: StackedSortOption;
  showOther?: boolean;
  onMinYearChange?: (value: number) => void;
  onMaxYearChange?: (value: number) => void;
  onTopNChange?: (value: number) => void;
  onStackModeChange?: (value: StackMode) => void;
  onSortByChange?: (value: StackedSortOption) => void;
  onShowOtherChange?: (value: boolean) => void;
}

export type StackMode = "absolute" | "percentage";
export type StackedSortOption = "total" | "average_year" | "alphabetical";

export function TemporalStackedChart({
  onPaperClick,
  minYear: propMinYear,
  maxYear: propMaxYear,
  topN: propTopN,
  stackMode: propStackMode,
  sortBy: propSortBy,
  showOther: propShowOther,
  onMinYearChange,
  onMaxYearChange,
  onTopNChange,
  onStackModeChange,
  onSortByChange,
  onShowOtherChange,
}: TemporalStackedChartProps) {
  const { isDarkTheme } = useTheme();
  const [temporalData, setTemporalData] = useState<ClusterTemporalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Controls - use props if provided, otherwise use local state
  const [localMinYear, setLocalMinYear] = useState(1990);
  const [localMaxYear, setLocalMaxYear] = useState(2025);
  const [localTopN, setLocalTopN] = useState(20);
  const [localStackMode, setLocalStackMode] = useState<StackMode>("percentage");
  const [localSortBy, setLocalSortBy] = useState<StackedSortOption>("total");
  const [localShowOther, setLocalShowOther] = useState(false);

  const minYear = propMinYear ?? localMinYear;
  const maxYear = propMaxYear ?? localMaxYear;
  const topN = propTopN ?? localTopN;
  const stackMode = propStackMode ?? localStackMode;
  const sortBy = propSortBy ?? localSortBy;
  const showOther = propShowOther ?? localShowOther;

  const setMinYear = onMinYearChange ?? setLocalMinYear;
  const setMaxYear = onMaxYearChange ?? setLocalMaxYear;
  const setTopN = onTopNChange ?? setLocalTopN;
  const setStackMode = onStackModeChange ?? setLocalStackMode;
  const setSortBy = onSortByChange ?? setLocalSortBy;
  const setShowOther = onShowOtherChange ?? setLocalShowOther;

  // Statistics
  const [stats, setStats] = useState({
    totalPapers: 0,
    peakYear: 0,
    avgPerYear: 0,
    fastestGrowing: "",
  });

  // Fetch temporal data with caching
  const yearRangeKey = createYearRangeKey(minYear, maxYear);
  const [cachedTemporalData, setCachedTemporalData] = useAtom(
    temporalDataAtomFamily(yearRangeKey)
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
      getApiUrl(`/api/temporal-data?min_year=${minYear}&max_year=${maxYear}`)
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
    minYear,
    maxYear,
    yearRangeKey,
    cachedTemporalData,
    setCachedTemporalData,
  ]);

  // Process data for stacked bar chart
  const processedData = useMemo(() => {
    if (!temporalData.length) return null;

    // Calculate total papers per cluster
    const clusterTotals = temporalData.map((cluster) => ({
      cluster_id: cluster.cluster_id,
      cluster_label: cluster.cluster_label,
      color: cluster.color,
      total: cluster.temporal_data.reduce((sum, d) => sum + d.count, 0),
      avg_year:
        cluster.temporal_data.reduce((sum, d) => sum + d.year * d.count, 0) /
        cluster.temporal_data.reduce((sum, d) => sum + d.count, 0),
      temporal_data: cluster.temporal_data,
    }));

    // Sort clusters
    const sortedClusters = [...clusterTotals];
    if (sortBy === "total") {
      sortedClusters.sort((a, b) => b.total - a.total);
    } else if (sortBy === "average_year") {
      sortedClusters.sort((a, b) => a.avg_year - b.avg_year);
    } else {
      sortedClusters.sort((a, b) =>
        a.cluster_label.localeCompare(b.cluster_label)
      );
    }

    // Take top N clusters
    const topClusters = sortedClusters.slice(0, topN);
    const otherClusters = sortedClusters.slice(topN);

    // Get all years in range
    const years = Array.from(
      { length: maxYear - minYear + 1 },
      (_, i) => minYear + i
    );

    // Build year totals for percentage mode
    const yearTotals = new Map<number, number>();
    temporalData.forEach((cluster) => {
      cluster.temporal_data.forEach((d) => {
        yearTotals.set(d.year, (yearTotals.get(d.year) ?? 0) + d.count);
      });
    });

    // Create traces for each cluster
    const traces = topClusters.map((cluster) => {
      const yearCountMap = new Map(
        cluster.temporal_data.map((d) => [d.year, d.count])
      );

      const counts = years.map((year) => {
        const count = yearCountMap.get(year) ?? 0;
        if (stackMode === "percentage" && count > 0) {
          const yearTotal = yearTotals.get(year) ?? 1;
          return (count / yearTotal) * 100;
        }
        return count;
      });

      return {
        cluster_id: cluster.cluster_id,
        cluster_label: cluster.cluster_label,
        color: cluster.color,
        counts,
      };
    });

    // Add "Other" category if there are more clusters and showOther is true
    if (showOther && otherClusters.length > 0) {
      const otherCounts = years.map((year) => {
        let total = 0;
        otherClusters.forEach((cluster) => {
          const yearData = cluster.temporal_data.find((d) => d.year === year);
          if (yearData) {
            total += yearData.count;
          }
        });

        if (stackMode === "percentage" && total > 0) {
          const yearTotal = yearTotals.get(year) ?? 1;
          return (total / yearTotal) * 100;
        }
        return total;
      });

      traces.push({
        cluster_id: -1,
        cluster_label: `Other (${otherClusters.length} clusters)`,
        color: "#E8E8E8",
        counts: otherCounts,
      });
    }

    // Calculate statistics
    const totalPapers = clusterTotals.reduce((sum, c) => sum + c.total, 0);
    const peakYear = Array.from(yearTotals.entries()).reduce((max, e) =>
      e[1] > max[1] ? e : max
    )[0];
    const avgPerYear = totalPapers / years.length;

    // Calculate growth rates (papers in last 3 years vs first 3 years)
    const growthRates = clusterTotals
      .map((cluster) => {
        const data = cluster.temporal_data.sort((a, b) => a.year - b.year);
        if (data.length < 6) return { label: cluster.cluster_label, rate: 0 };

        const firstThree = data
          .slice(0, 3)
          .reduce((sum, d) => sum + d.count, 0);
        const lastThree = data.slice(-3).reduce((sum, d) => sum + d.count, 0);

        if (firstThree === 0) return { label: cluster.cluster_label, rate: 0 };

        const rate = ((lastThree - firstThree) / firstThree) * 100;
        return { label: cluster.cluster_label, rate };
      })
      .filter((r) => r.rate > 0);

    const fastestGrowing =
      growthRates.length > 0
        ? growthRates.reduce((max, r) => (r.rate > max.rate ? r : max)).label
        : "N/A";

    return {
      traces,
      years,
      stats: {
        totalPapers,
        peakYear,
        avgPerYear: Math.round(avgPerYear),
        fastestGrowing,
      },
    };
  }, [temporalData, topN, stackMode, sortBy, minYear, maxYear, showOther]);

  // Update stats when processedData changes
  useEffect(() => {
    if (processedData?.stats) {
      setStats(processedData.stats);
    }
  }, [processedData]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading stacked chart data...</p>
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

  const { traces, years } = processedData;

  // Create Plotly data
  const plotData = traces.map((trace) => ({
    x: years,
    y: trace.counts,
    name: trace.cluster_label,
    type: "bar" as const,
    marker: {
      color: trace.color,
      line: {
        color: isDarkTheme ? "#374151" : "#ffffff",
        width: 0.5,
      },
    },
    hovertemplate:
      "<b>%{fullData.name}</b><br>" +
      "Year: %{x}<br>" +
      (stackMode === "percentage" ? "Percentage: %{y:.1f}%" : "Papers: %{y}") +
      "<extra></extra>",
    customdata: Array(years.length).fill(trace.cluster_id),
  }));

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Controls Panel */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap text-sm text-foreground">
              Year Range:
            </label>
            <Input
              type="number"
              value={minYear}
              onChange={(e) => setMinYear(parseInt(e.target.value))}
              className="w-20 text-sm"
              min={1990}
              max={2025}
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="number"
              value={maxYear}
              onChange={(e) => setMaxYear(parseInt(e.target.value))}
              className="w-20 text-sm"
              min={1990}
              max={2025}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap text-sm text-foreground">
              Top Clusters:
            </label>
            <Select
              value={topN.toString()}
              onValueChange={(value) => setTopN(parseInt(value))}
              options={[
                { value: "10", label: "10" },
                { value: "20", label: "20" },
                { value: "30", label: "30" },
                { value: "50", label: "50" },
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap text-sm text-foreground">
              Stack Mode:
            </label>
            <Select
              value={stackMode}
              onValueChange={(value) => setStackMode(value as StackMode)}
              options={[
                { value: "absolute", label: "Absolute Count" },
                { value: "percentage", label: "Percentage (100%)" },
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap text-sm text-foreground">
              Sort By:
            </label>
            <Select
              value={sortBy}
              onValueChange={(value) => setSortBy(value as StackedSortOption)}
              options={[
                { value: "total", label: "Total Papers" },
                { value: "average_year", label: "Average Year" },
                { value: "alphabetical", label: "Alphabetical" },
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={showOther}
              onCheckedChange={setShowOther}
              label="Show Other Papers"
              labelClassName="text-sm text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Stacked Bar Chart */}
      <div className="flex-1 overflow-hidden p-4">
        <Plot
          data={plotData}
          layout={{
            barmode: "stack",
            xaxis: {
              title: "Publication Year",
              tickfont: { color: isDarkTheme ? "#d1d5db" : "#333" },
              titlefont: { color: isDarkTheme ? "#f9fafb" : "#111" },
              gridcolor: isDarkTheme ? "#374151" : "#e0e0e0",
            },
            yaxis: {
              title:
                stackMode === "percentage"
                  ? "Percentage of Papers (%)"
                  : "Number of Papers",
              tickfont: { color: isDarkTheme ? "#d1d5db" : "#333" },
              titlefont: { color: isDarkTheme ? "#f9fafb" : "#111" },
              gridcolor: isDarkTheme ? "#374151" : "#e0e0e0",
            },
            legend: {
              orientation: "v",
              yanchor: "top",
              y: 1,
              xanchor: "left",
              x: 1.02,
              bgcolor: isDarkTheme
                ? "rgba(18, 25, 38, 0.9)"
                : "rgba(255, 255, 255, 0.9)",
              bordercolor: isDarkTheme ? "#374151" : "#ddd",
              borderwidth: 1,
              font: {
                size: 10,
                color: isDarkTheme ? "#d1d5db" : "#333",
              },
            },
            paper_bgcolor: isDarkTheme ? "#0d121c" : "white",
            plot_bgcolor: isDarkTheme ? "#0d121c" : "white",
            margin: { t: 20, r: 200, b: 60, l: 100 },
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
            const event = e as {
              points?: { x: number; customdata: number }[];
            };
            if (event.points?.[0] && onPaperClick) {
              const point = event.points[0];
              const year = point.x;
              const clusterId = point.customdata;
              if (clusterId !== -1) {
                // Don't handle "Other" clicks
                onPaperClick(clusterId, year);
              }
            }
          }}
        />
      </div>

      {/* Statistics Panel */}
      <div className="border-t border-border bg-background px-6 py-3">
        <div className="flex items-center justify-around text-sm">
          <div>
            <span className="text-muted-foreground">Total Papers: </span>
            <span className="font-semibold text-foreground">
              {stats.totalPapers.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Peak Year: </span>
            <span className="font-semibold text-foreground">
              {stats.peakYear}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Avg/Year: </span>
            <span className="font-semibold text-foreground">
              {stats.avgPerYear.toLocaleString()}
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
