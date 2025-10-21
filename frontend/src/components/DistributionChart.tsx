import type { Data, Layout, PlotMouseEvent } from "plotly.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAtom } from "jotai";
import Plot from "react-plotly.js";

import { useTheme } from "@kuzco/ui-library";

import type { ClusterInfo, ClustersResponse } from "../types";
import { clustersDataAtom } from "../state/chartDataCache";
import { getApiUrl } from "../utils/api";

export function DistributionChart({
  onClusterClick,
  topN = 100,
  onTotalClustersLoaded,
}: {
  onClusterClick?: (clusterId: number) => void;
  topN?: number;
  onTotalClustersLoaded?: (total: number) => void;
}) {
  const { isDarkTheme } = useTheme();
  const [cachedData, setCachedData] = useAtom(clustersDataAtom);
  const [data, setData] = useState<ClusterInfo[]>([]);
  const [loading, setLoading] = useState(!cachedData);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If we have cached data, use it immediately
    if (cachedData) {
      setData(cachedData);
      setLoading(false);
      if (onTotalClustersLoaded) {
        onTotalClustersLoaded(cachedData.length);
      }
      return;
    }

    // Otherwise, fetch the data
    fetch(getApiUrl("/api/clusters"))
      .then((res) => res.json())
      .then((clustersData: ClustersResponse) => {
        const clusters: ClusterInfo[] = clustersData.clusters;
        // Sort by count in descending order
        const sorted = [...clusters].sort((a, b) => b.count - a.count);
        setData(sorted);
        setCachedData(sorted); // Cache the data
        setLoading(false);
        // Notify parent of total clusters count
        if (onTotalClustersLoaded) {
          onTotalClustersLoaded(sorted.length);
        }
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [cachedData, setCachedData, onTotalClustersLoaded]);

  const plotData: Data[] = useMemo(() => {
    if (!data.length) return [];

    // Limit to top N clusters
    const displayData = data.slice(0, topN);

    return [
      {
        type: "bar",
        x: displayData.map((d) => d.cluster_label),
        y: displayData.map((d) => d.count),
        marker: {
          color: displayData.map((d) => d.color),
          line: {
            color: "rgba(0,0,0,0.2)",
            width: 1,
          },
        },
        hovertemplate:
          "<b>%{x}</b><br>" + "Papers: %{y:,}<br>" + "<extra></extra>",
        customdata: displayData.map((d) => d.cluster_id),
      },
    ];
  }, [data, topN]);

  const layout: Partial<Layout> = useMemo(
    () => ({
      autosize: true,
      margin: { l: 100, r: 40, t: 60, b: 120 },
      xaxis: {
        title: "Research Cluster",
        tickangle: -45,
        automargin: true,
        tickfont: { color: isDarkTheme ? "#d1d5db" : "#333" },
        titlefont: { color: isDarkTheme ? "#f9fafb" : "#111" },
        gridcolor: isDarkTheme ? "#374151" : "#e0e0e0",
      },
      yaxis: {
        title: {
          text: "Number of Papers",
          standoff: 20,
        },
        tickfont: { color: isDarkTheme ? "#d1d5db" : "#333" },
        titlefont: { color: isDarkTheme ? "#f9fafb" : "#111" },
        gridcolor: isDarkTheme ? "#374151" : "#e0e0e0",
      },
      title: {
        text: "Paper Distribution by Research Cluster",
        font: {
          size: 18,
          color: isDarkTheme ? "#f9fafb" : "#111",
        },
      },
      hovermode: "closest",
      plot_bgcolor: isDarkTheme ? "#0d121c" : "white",
      paper_bgcolor: isDarkTheme ? "#0d121c" : "white",
    }),
    [isDarkTheme],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading distribution data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-destructive">Error loading data: {error}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full p-4">
      <Plot
        data={plotData}
        layout={layout}
        config={{
          responsive: true,
          displayModeBar: false,
          displaylogo: false,
        }}
        className="h-full w-full"
        useResizeHandler
        style={{ width: "100%", height: "100%" }}
        onClick={(event) => {
          const eventData = event as PlotMouseEvent;
          if (onClusterClick && eventData.points[0]) {
            const clusterId = eventData.points[0].customdata as number;
            onClusterClick(clusterId);
          }
        }}
      />
    </div>
  );
}
