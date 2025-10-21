import { useEffect, useState } from "react";
import Plot from "react-plotly.js";

import { Label, Slider, Switch, useTheme } from "~/ui";

import type { ClusterInfo, PaperSummary } from "../types";
import type { LayoutType } from "../utils/layoutTransforms";
import {
  applyLayoutTransform,
  getCameraForLayout,
} from "../utils/layoutTransforms";

interface ClusterVisualizationProps {
  papers: PaperSummary[];
  clusters: ClusterInfo[];
  onPaperClick: (paperId: number) => void;
  selectedClusterIds: Set<number>;
  layoutType?: LayoutType;
}

export function ClusterVisualization({
  papers,
  clusters,
  onPaperClick,
  selectedClusterIds,
  layoutType = "original",
}: ClusterVisualizationProps) {
  const { isDarkTheme } = useTheme();
  const [plotData, setPlotData] = useState<unknown[]>([]);
  const [sceneAnnotations, setSceneAnnotations] = useState<unknown[]>([]);
  const [revision, setRevision] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [cameraRevision, setCameraRevision] = useState(0);
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [densityPercent, setDensityPercent] = useState(() => {
    // Set lower density on mobile for better performance
    return typeof window !== "undefined" && window.innerWidth < 1024 ? 20 : 100;
  });
  const [zoomLevel, setZoomLevel] = useState(1.0);
  // Use a stable string to maintain camera position across data changes
  const uirevision = `camera-${cameraRevision}`;

  useEffect(() => {
    // Group papers by cluster
    const clusterMap = new Map<number, PaperSummary[]>();
    const clusterColorMap = new Map<number, string>();

    // Build cluster color map
    clusters.forEach((cluster) => {
      clusterColorMap.set(cluster.cluster_id, cluster.color);
    });

    // Group papers by cluster
    papers.forEach((paper) => {
      if (
        paper.x === null ||
        paper.y === null ||
        paper.z === null ||
        paper.cluster_id === null
      )
        return;

      // Skip if cluster is not selected
      if (
        selectedClusterIds.size > 0 &&
        !selectedClusterIds.has(paper.cluster_id)
      ) {
        return;
      }

      if (!clusterMap.has(paper.cluster_id)) {
        clusterMap.set(paper.cluster_id, []);
      }
      clusterMap.get(paper.cluster_id)?.push(paper);
    });

    // Sample papers based on density percentage
    if (densityPercent < 100) {
      clusterMap.forEach((clusterPapers, clusterId) => {
        const targetCount = Math.ceil(
          (clusterPapers.length * densityPercent) / 100
        );
        if (targetCount < clusterPapers.length) {
          // Use deterministic sampling based on paper ID to keep it stable
          const sampledPapers = clusterPapers
            .sort((a, b) => a.id - b.id) // Sort by ID for consistency
            .filter((_, index, arr) => {
              // Sample evenly across the sorted array
              const step = arr.length / targetCount;
              return index % Math.ceil(step) === 0;
            })
            .slice(0, targetCount);
          clusterMap.set(clusterId, sampledPapers);
        }
      });
    }

    // Create 3D traces for each cluster
    const traces = Array.from(clusterMap.entries()).map(
      ([clusterId, clusterPapers], clusterIndex) => {
        const color = clusterColorMap.get(clusterId) ?? "#cccccc";
        const clusterLabel =
          clusterPapers[0]?.cluster_label ?? `Cluster ${clusterId}`;

        // Extract original coordinates
        const originalPoints = clusterPapers.map((p) => ({
          x: p.x ?? 0,
          y: p.y ?? 0,
          z: p.z ?? 0,
        }));

        // Apply layout transformation
        const transformedPoints = applyLayoutTransform(
          originalPoints,
          layoutType,
          {
            clusterId,
            clusterIndex,
            totalClusters: clusterMap.size,
          }
        );

        return {
          x: transformedPoints.map((p) => p.x),
          y: transformedPoints.map((p) => p.y),
          z: transformedPoints.map((p) => p.z),
          mode: "markers",
          type: "scatter3d",
          name: clusterLabel,
          hovertemplate: clusterPapers.map((p) => {
            const title = p.title ?? "Untitled";
            const wrappedTitle =
              title.length > 60 ? title.substring(0, 60) + "..." : title;
            return (
              `Cluster: <b>${clusterLabel}</b><br>` +
              `<br>` +
              `Title: <b>${wrappedTitle}</b><br>` +
              `Field: ${p.field_subfield ?? "Unknown"}<br>` +
              `Year: ${p.publication_year ?? "N/A"}<extra></extra>`
            );
          }),
          hoverlabel: {
            bgcolor: isDarkTheme ? "#1f2937" : "white",
            // bordercolor: color,
            font: {
              size: 12,
              color: isDarkTheme ? "#f9fafb" : "#333",
            },
            align: "left",
            namelength: -1,
          },
          marker: {
            color: color,
            size: 3,
            opacity: 0.7,
            line: {
              color: isDarkTheme ? "#374151" : "white",
              width: 0.2,
            },
          },
          customdata: clusterPapers.map((p) => [p.id, clusterId]), // Store both paper ID and cluster ID
        };
      }
    );

    setPlotData(traces);
    setRevision((prev) => prev + 1);
  }, [
    papers,
    clusters,
    selectedClusterIds,
    isDarkTheme,
    layoutType,
    densityPercent,
  ]);

  // Update scene annotations based on showAllLabels toggle
  useEffect(() => {
    if (!showAllLabels) {
      setSceneAnnotations([]);
      return;
    }

    // Show all cluster labels when toggle is on
    const clusterMap = new Map<number, PaperSummary[]>();
    const clusterColorMap = new Map<number, string>();

    clusters.forEach((cluster) => {
      clusterColorMap.set(cluster.cluster_id, cluster.color);
    });

    papers.forEach((paper) => {
      if (
        paper.x === null ||
        paper.y === null ||
        paper.z === null ||
        paper.cluster_id === null
      )
        return;

      if (
        selectedClusterIds.size > 0 &&
        !selectedClusterIds.has(paper.cluster_id)
      ) {
        return;
      }

      if (!clusterMap.has(paper.cluster_id)) {
        clusterMap.set(paper.cluster_id, []);
      }
      clusterMap.get(paper.cluster_id)?.push(paper);
    });

    const annotations: unknown[] = [];

    Array.from(clusterMap.entries()).forEach(
      ([clusterId, clusterPapers], clusterIndex) => {
        const originalPoints = clusterPapers.map((p) => ({
          x: p.x ?? 0,
          y: p.y ?? 0,
          z: p.z ?? 0,
        }));

        const transformedPoints = applyLayoutTransform(
          originalPoints,
          layoutType,
          {
            clusterId,
            clusterIndex,
            totalClusters: clusterMap.size,
          }
        );

        const sumX = transformedPoints.reduce((sum, p) => sum + p.x, 0);
        const sumY = transformedPoints.reduce((sum, p) => sum + p.y, 0);
        const sumZ = transformedPoints.reduce((sum, p) => sum + p.z, 0);
        const centroidX = sumX / transformedPoints.length;
        const centroidY = sumY / transformedPoints.length;
        const centroidZ = sumZ / transformedPoints.length;

        const clusterLabel =
          clusterPapers[0]?.cluster_label ?? `Cluster ${clusterId}`;
        const color = clusterColorMap.get(clusterId) ?? "#cccccc";

        annotations.push({
          x: centroidX,
          y: centroidY,
          z: centroidZ,
          text: clusterLabel,
          showarrow: false,
          font: {
            size: 11,
            color: isDarkTheme ? "#f9fafb" : "#333",
            family: "Arial, sans-serif",
          },
          bgcolor: isDarkTheme
            ? "rgba(18, 25, 38, 0.9)"
            : "rgba(255, 255, 255, 0.8)",
          bordercolor: color,
          borderwidth: 1,
          borderpad: 4,
          xanchor: "center",
          yanchor: "middle",
        });
      }
    );

    setSceneAnnotations(annotations);
  }, [
    showAllLabels,
    papers,
    clusters,
    selectedClusterIds,
    layoutType,
    isDarkTheme,
  ]);

  // Separate effect to trigger animation only once
  useEffect(() => {
    if (!isLoaded && plotData.length > 0) {
      const timer = setTimeout(() => setIsLoaded(true), 100);
      return () => clearTimeout(timer);
    }
  }, [plotData.length, isLoaded]);

  // Handle reset camera on 'R' key press
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only reset if R is pressed alone (no modifier keys)
      if (
        (event.key === "r" || event.key === "R") &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        // Change camera revision to reset the camera view
        setCameraRevision((prev) => prev + 1);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        backgroundColor: isDarkTheme ? "#0d121c" : "white",
        touchAction: "auto",
      }}
    >
      <style>{`
        @keyframes plotFadeInZoom {
          0% {
            opacity: 0;
            transform: scale(0.95);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .plot-container-animated {
          animation: plotFadeInZoom 1.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .plot-container-static {
          opacity: 1;
          transform: scale(1);
        }
      `}</style>
      <div
        className={`
          hidden absolute top-2.5 right-2.5 z-10

          lg:block
        `}
      >
        <div className="flex flex-col gap-2">
          <div
            style={{
              backgroundColor: isDarkTheme
                ? "rgba(18, 25, 38, 0.9)"
                : "rgba(255, 255, 255, 0.9)",
              padding: "8px 12px",
              borderRadius: "4px",
              fontSize: "12px",
              color: isDarkTheme ? "#d1d5db" : "#666",
              border: isDarkTheme ? "1px solid #374151" : "1px solid #ddd",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              minWidth: "200px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Label
                htmlFor="density-slider"
                style={{
                  fontSize: "12px",
                  margin: 0,
                  color: isDarkTheme ? "#d1d5db" : "#666",
                }}
              >
                Density by Cluster (%)
              </Label>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: isDarkTheme ? "#f9fafb" : "#333",
                }}
              >
                {densityPercent}%
              </span>
            </div>
            <Slider
              id="density-slider"
              value={[densityPercent]}
              min={1}
              max={100}
              step={1}
              onValueChange={([value]) => value && setDensityPercent(value)}
              aria-label="Node density percentage"
              className="my-1"
            />
          </div>
          <div
            style={{
              backgroundColor: isDarkTheme
                ? "rgba(18, 25, 38, 0.9)"
                : "rgba(255, 255, 255, 0.9)",
              padding: "8px 12px",
              borderRadius: "4px",
              fontSize: "12px",
              color: isDarkTheme ? "#d1d5db" : "#666",
              border: isDarkTheme ? "1px solid #374151" : "1px solid #ddd",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Label
              htmlFor="show-labels-toggle"
              style={{
                fontSize: "12px",
                margin: 0,
                cursor: "pointer",
                color: isDarkTheme ? "#d1d5db" : "#666",
              }}
            >
              Show Labels
            </Label>
            <Switch
              id="show-labels-toggle"
              checked={showAllLabels}
              onCheckedChange={setShowAllLabels}
            />
          </div>
          <div
            style={{
              backgroundColor: isDarkTheme
                ? "rgba(18, 25, 38, 0.9)"
                : "rgba(255, 255, 255, 0.9)",
              padding: "8px 12px",
              borderRadius: "4px",
              fontSize: "12px",
              color: isDarkTheme ? "#d1d5db" : "#666",
              border: isDarkTheme ? "1px solid #374151" : "1px solid #ddd",
            }}
          >
            Right click + drag to pan | Press 'R' to reset viewpoint
          </div>
        </div>
      </div>
      {/* Mobile zoom slider */}
      <div
        className="lg:hidden"
        style={{
          position: "absolute",
          top: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          backgroundColor: isDarkTheme
            ? "rgba(18, 25, 38, 0.95)"
            : "rgba(255, 255, 255, 0.95)",
          padding: "12px 16px",
          borderRadius: "8px",
          border: isDarkTheme ? "1px solid #374151" : "1px solid #ddd",
          minWidth: "280px",
          maxWidth: "90%",
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span
            style={{
              fontSize: "14px",
              color: isDarkTheme ? "#d1d5db" : "#666",
              fontWeight: "500",
            }}
          >
            Zoom
          </span>
          <div style={{ flex: 1 }}>
            <Slider
              value={[zoomLevel]}
              min={0.3}
              max={2.5}
              step={0.1}
              onValueChange={([value]) => value && setZoomLevel(value)}
              aria-label="Zoom level"
            />
          </div>
          <span
            style={{
              fontSize: "12px",
              color: isDarkTheme ? "#9ca3af" : "#888",
              minWidth: "32px",
              textAlign: "right",
            }}
          >
            {zoomLevel.toFixed(1)}x
          </span>
        </div>
      </div>
      <div
        className={
          isLoaded ? "plot-container-animated" : `plot-container-static`
        }
        style={{
          width: "100%",
          height: "100%",
          opacity: isLoaded ? undefined : 0,
        }}
      >
        <Plot
          data={plotData}
          layout={{
            showlegend: false,
            legend: {
              orientation: "v",
              yanchor: "top",
              y: 1,
              xanchor: "left",
              x: 1.02,
              bgcolor: isDarkTheme
                ? "rgba(18, 25, 38, 0.9)"
                : "rgba(255, 255, 255, 0.8)",
              bordercolor: isDarkTheme ? "#374151" : "#ddd",
              borderwidth: 1,
            },
            hovermode: "closest",
            hoverlabel: {
              bgcolor: isDarkTheme ? "#1f2937" : "white",
              bordercolor: isDarkTheme ? "#374151" : "#ddd",
              font: { size: 12, color: isDarkTheme ? "#f9fafb" : "#333" },
              align: "left",
              namelength: -1,
            },
            scene: {
              bgcolor: isDarkTheme ? "#0d121c" : "white",
              xaxis: {
                title: "",
                zeroline: false,
                showgrid: true,
                gridcolor: isDarkTheme ? "#374151" : "#e0e0e0",
                backgroundcolor: isDarkTheme ? "#0d121c" : "#fafafa",
                showticklabels: false,
              },
              yaxis: {
                title: "",
                zeroline: false,
                showgrid: true,
                gridcolor: isDarkTheme ? "#374151" : "#e0e0e0",
                backgroundcolor: isDarkTheme ? "#0d121c" : "#fafafa",
                showticklabels: false,
              },
              zaxis: {
                title: "",
                zeroline: false,
                showgrid: true,
                gridcolor: isDarkTheme ? "#374151" : "#e0e0e0",
                backgroundcolor: isDarkTheme ? "#0d121c" : "#fafafa",
                showticklabels: false,
              },
              camera: (() => {
                const baseCamera = getCameraForLayout(layoutType);
                return {
                  ...baseCamera,
                  eye: {
                    x: baseCamera.eye.x * zoomLevel,
                    y: baseCamera.eye.y * zoomLevel,
                    z: baseCamera.eye.z * zoomLevel,
                  },
                };
              })(),
              annotations: sceneAnnotations,
            },
            paper_bgcolor: isDarkTheme ? "#0d121c" : "white",
            plot_bgcolor: isDarkTheme ? "#0d121c" : "white",
            margin: { t: 10, r: 10, b: 10, l: 10 },
            autosize: true,
            datarevision: revision,
            uirevision: uirevision,
          }}
          config={{
            displayModeBar: false,
            displaylogo: false,
            responsive: true,
            scrollZoom: true,
            dragmode: "orbit",
            doubleClick: "reset",
          }}
          useResizeHandler={true}
          style={{ width: "100%", height: "100%" }}
          onClick={(e: unknown) => {
            const event = e as { points?: { customdata: [number, number] }[] };
            if (event.points?.[0]?.customdata) {
              const [paperId] = event.points[0].customdata;
              if (paperId) {
                onPaperClick(paperId);
              }
            }
          }}
        />
      </div>
    </div>
  );
}
