import { Button, Label, Slider, useTheme } from "~/ui";
import * as d3Force from "d3-force";
import * as d3Selection from "d3-selection";
import * as d3Zoom from "d3-zoom";
import { useEffect, useRef, useState } from "react";
import type { ClusterInfo, PaperSummary } from "../types";

interface ForceDirectedClusterProps {
  papers: PaperSummary[];
  clusters: ClusterInfo[];
  onPaperClick: (paperId: number) => void;
  selectedClusterIds: Set<number>;
}

type NodeType = "cluster" | "paper";

interface ForceNode extends d3Force.SimulationNodeDatum {
  id: string; // Changed to string to support both "cluster-X" and "paper-X" formats
  type: NodeType;
  clusterId: number;
  clusterLabel: string;
  color: string;
  // For cluster nodes
  paperCount?: number;
  // For paper nodes
  paperId?: number;
  title?: string;
  field?: string;
  year?: number;
}

interface ForceLink extends d3Force.SimulationLinkDatum<ForceNode> {
  source: string | ForceNode;
  target: string | ForceNode;
}

export function ForceDirectedCluster({
  papers,
  clusters,
  onPaperClick,
  selectedClusterIds,
}: ForceDirectedClusterProps) {
  const { isDarkTheme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const simulationRef = useRef<d3Force.Simulation<ForceNode, ForceLink> | null>(
    null,
  );
  const transformRef = useRef<d3Zoom.ZoomTransform>(d3Zoom.zoomIdentity);
  const hoveredNodeRef = useRef<ForceNode | null>(null);
  const [expandedClusters, setExpandedClusters] = useState<Set<number>>(
    new Set(),
  );
  const [densityPercent, setDensityPercent] = useState(20);
  const [resetTrigger, setResetTrigger] = useState(0);
  const nodesRef = useRef<ForceNode[]>([]);
  const linksRef = useRef<ForceLink[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const [hoveredNodeDisplay, setHoveredNodeDisplay] =
    useState<ForceNode | null>(null);
  const draggedNodeRef = useRef<ForceNode | null>(null);
  const isDraggingRef = useRef(false);
  const [cursorStyle, setCursorStyle] = useState<"grab" | "move" | "grabbing">(
    "grab",
  );
  const zoomBehaviorRef = useRef<d3Zoom.ZoomBehavior<
    HTMLCanvasElement,
    unknown
  > | null>(null);

  // Update dimensions on mount and resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Create and run the force simulation
  useEffect(() => {
    if (!canvasRef.current || !papers.length || !clusters.length) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    // Build cluster info maps
    const clusterColorMap = new Map<number, string>();
    const clusterLabelMap = new Map<number, string>();
    const clusterCountMap = new Map<number, number>();

    clusters.forEach((cluster) => {
      clusterColorMap.set(cluster.cluster_id, cluster.color);
      clusterLabelMap.set(cluster.cluster_id, cluster.cluster_label);
      clusterCountMap.set(cluster.cluster_id, 0);
    });

    // Count papers per cluster
    papers.forEach((paper) => {
      if (paper.cluster_id !== null) {
        clusterCountMap.set(
          paper.cluster_id,
          (clusterCountMap.get(paper.cluster_id) ?? 0) + 1,
        );
      }
    });

    // Filter papers based on selected clusters
    const filteredPapers = papers.filter((paper) => {
      if (paper.cluster_id === null) return false;
      if (
        selectedClusterIds.size > 0 &&
        !selectedClusterIds.has(paper.cluster_id)
      ) {
        return false;
      }
      return true;
    });

    // Group papers by cluster
    const papersByCluster = new Map<number, PaperSummary[]>();
    filteredPapers.forEach((paper) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (!papersByCluster.has(paper.cluster_id!)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        papersByCluster.set(paper.cluster_id!, []);
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      papersByCluster.get(paper.cluster_id!)?.push(paper);
    });

    // Sample papers based on density
    if (densityPercent < 100) {
      papersByCluster.forEach((clusterPapers, clusterId) => {
        const targetCount = Math.ceil(
          (clusterPapers.length * densityPercent) / 100,
        );
        if (targetCount < clusterPapers.length) {
          const sampledPapers = clusterPapers
            .sort((a, b) => a.id - b.id)
            .filter((_, index, arr) => {
              const step = arr.length / targetCount;
              return index % Math.ceil(step) === 0;
            })
            .slice(0, targetCount);
          papersByCluster.set(clusterId, sampledPapers);
        }
      });
    }

    // Build nodes and links
    const nodes: ForceNode[] = [];
    const links: ForceLink[] = [];
    const nodeMap = new Map<string, ForceNode>();

    // Get visible cluster IDs
    const visibleClusterIds = Array.from(papersByCluster.keys());

    // Store existing node positions to maintain them across updates
    const previousNodes = nodesRef.current;
    const previousPositions = new Map<
      string,
      {
        x: number;
        y: number;
        fx?: number | null | undefined;
        fy?: number | null | undefined;
      }
    >();
    previousNodes.forEach((node) => {
      if (node.x !== undefined && node.y !== undefined) {
        previousPositions.set(node.id, {
          x: node.x,
          y: node.y,
          fx: node.fx,
          fy: node.fy,
        });
      }
    });

    visibleClusterIds.forEach((clusterId) => {
      const clusterPapers = papersByCluster.get(clusterId) ?? [];
      const color = clusterColorMap.get(clusterId) ?? "#cccccc";
      const label = clusterLabelMap.get(clusterId) ?? `Cluster ${clusterId}`;

      if (expandedClusters.has(clusterId)) {
        // Get the cluster node's previous position if it existed
        const clusterNodeId = `cluster-${clusterId}`;
        const clusterPos = previousPositions.get(clusterNodeId);
        const baseX = clusterPos?.x ?? dimensions.width / 2;
        const baseY = clusterPos?.y ?? dimensions.height / 2;

        // Create paper nodes for expanded cluster
        const paperNodesInCluster: ForceNode[] = [];
        clusterPapers.forEach((paper, index) => {
          const paperId = `paper-${paper.id}`;
          const previousPos = previousPositions.get(paperId);

          // Small spiral pattern for initial positions
          const angle = (index / clusterPapers.length) * Math.PI * 2;
          const radius = 30;
          const offsetX = Math.cos(angle) * radius;
          const offsetY = Math.sin(angle) * radius;

          const node: ForceNode = {
            id: paperId,
            type: "paper",
            paperId: paper.id,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            clusterId: paper.cluster_id!,
            clusterLabel: label,
            title: paper.title ?? "Untitled",
            color: color,
            field: paper.field_subfield ?? undefined,
            year: paper.publication_year ?? undefined,
            // Initialize near cluster position if new, otherwise use previous position
            x: previousPos?.x ?? baseX + offsetX,
            y: previousPos?.y ?? baseY + offsetY,
            // Preserve fixed positions
            fx: previousPos?.fx,
            fy: previousPos?.fy,
          };
          nodes.push(node);
          nodeMap.set(node.id, node);
          paperNodesInCluster.push(node);
        });

        // Create links to k-nearest neighbors (k=5) based on original embedding space
        const k = 5;
        paperNodesInCluster.forEach((node, nodeIndex) => {
          const sourcePaper = clusterPapers[nodeIndex];

          // Calculate distances to all other papers in the cluster using original coordinates
          const distances: { index: number; distance: number }[] = [];
          clusterPapers.forEach((targetPaper, targetIndex) => {
            if (targetIndex === nodeIndex) return; // Skip self

            // Use original x, y, z coordinates for distance calculation
            const dx = (sourcePaper.x ?? 0) - (targetPaper.x ?? 0);
            const dy = (sourcePaper.y ?? 0) - (targetPaper.y ?? 0);
            const dz = (sourcePaper.z ?? 0) - (targetPaper.z ?? 0);
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            distances.push({ index: targetIndex, distance });
          });

          // Sort by distance and take k nearest neighbors
          distances.sort((a, b) => a.distance - b.distance);
          const nearestNeighbors = distances.slice(0, k);

          // Create links to nearest neighbors
          nearestNeighbors.forEach(({ index: neighborIndex }) => {
            const targetNode = paperNodesInCluster[neighborIndex];
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (targetNode) {
              // Only add link if it doesn't exist (avoid duplicates)
              const linkExists = links.some(
                (link) =>
                  (link.source === node.id && link.target === targetNode.id) ||
                  (link.source === targetNode.id && link.target === node.id),
              );
              if (!linkExists) {
                links.push({
                  source: node.id,
                  target: targetNode.id,
                });
              }
            }
          });
        });
      } else {
        // Create cluster node for unexpanded cluster
        const nodeId = `cluster-${clusterId}`;
        const previousPos = previousPositions.get(nodeId);

        const node: ForceNode = {
          id: nodeId,
          type: "cluster",
          clusterId: clusterId,
          clusterLabel: label,
          color: color,
          paperCount: clusterPapers.length,
          // Preserve position if it existed
          x: previousPos?.x,
          y: previousPos?.y,
          fx: previousPos?.fx,
          fy: previousPos?.fy,
        };
        nodes.push(node);
        nodeMap.set(node.id, node);
      }
    });

    nodesRef.current = nodes;
    linksRef.current = links;

    // Create simulation
    const simulation = d3Force
      .forceSimulation<ForceNode, ForceLink>(nodes)
      .force(
        "link",
        d3Force
          .forceLink<ForceNode, ForceLink>(links)
          .id((d) => d.id)
          .strength(0)
          .distance(30),
      )
      .force("charge", d3Force.forceManyBody<ForceNode>().strength(0))
      .force(
        "center",
        d3Force.forceCenter<ForceNode>(
          dimensions.width / 2,
          dimensions.height / 2,
        ),
      )
      .force(
        "collision",
        d3Force
          .forceCollide<ForceNode>()
          .radius((d) => (d.type === "cluster" ? 20 : 8)),
      )
      .force(
        "x",
        d3Force.forceX<ForceNode>(dimensions.width / 2).strength(0.02),
      )
      .force(
        "y",
        d3Force.forceY<ForceNode>(dimensions.height / 2).strength(0.02),
      )
      .alphaDecay(0.05) // Faster decay for smoother settling
      .velocityDecay(0.4) // Higher friction for less chaos
      .alpha(0.3); // Start with lower energy for gentler animation

    simulationRef.current = simulation;

    // Drawing function that reads from refs
    function draw() {
      if (!context) return;

      const transform = transformRef.current;
      const hoveredNode = hoveredNodeRef.current;

      // Clear canvas
      context.save();
      context.clearRect(0, 0, dimensions.width, dimensions.height);

      // Apply zoom transform
      context.translate(transform.x, transform.y);
      context.scale(transform.k, transform.k);

      // Draw links
      context.strokeStyle = isDarkTheme
        ? "rgba(100, 116, 139, 0.2)"
        : "rgba(203, 213, 225, 0.3)";
      context.lineWidth = 1;

      linksRef.current.forEach((link) => {
        const source =
          typeof link.source === "string"
            ? nodesRef.current.find((n) => n.id === link.source)
            : link.source;
        const target =
          typeof link.target === "string"
            ? nodesRef.current.find((n) => n.id === link.target)
            : link.target;

        if (
          !source ||
          !target ||
          source.x === undefined ||
          source.y === undefined ||
          target.x === undefined ||
          target.y === undefined
        )
          return;

        context.beginPath();
        context.moveTo(source.x, source.y);
        context.lineTo(target.x, target.y);
        context.stroke();
      });

      // Draw nodes
      nodes.forEach((node) => {
        if (node.x === undefined || node.y === undefined) return;

        const radius = node.type === "cluster" ? 15 : 5;

        context.beginPath();
        context.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        context.fillStyle = node.color;
        context.globalAlpha = node.type === "cluster" ? 0.9 : 0.7;
        context.fill();
        context.globalAlpha = 1;
        context.strokeStyle = isDarkTheme ? "#374151" : "white";
        context.lineWidth = node.type === "cluster" ? 2 : 1;
        context.stroke();

        // Draw paper count on cluster nodes
        if (node.type === "cluster" && node.paperCount) {
          context.fillStyle = isDarkTheme ? "#f9fafb" : "#1f2937";
          context.font = "bold 10px sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(node.paperCount.toString(), node.x, node.y);
        }
      });

      // Draw hovered node highlight
      if (hoveredNode?.x !== undefined && hoveredNode.y !== undefined) {
        const radius = hoveredNode.type === "cluster" ? 18 : 8;
        context.beginPath();
        context.arc(hoveredNode.x, hoveredNode.y, radius, 0, 2 * Math.PI);
        context.strokeStyle = isDarkTheme ? "#f9fafb" : "#333";
        context.lineWidth = 2;
        context.stroke();
      }

      context.restore();
    }

    // Continuous render loop
    function render() {
      draw();
      animationFrameRef.current = requestAnimationFrame(render);
    }

    // Start render loop
    render();

    // Update on simulation ticks (just to trigger re-render during physics simulation)
    simulation.on("tick", () => {
      // Drawing is handled by render loop, no need to call draw here
    });

    return () => {
      simulation.stop();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    papers,
    clusters,
    selectedClusterIds,
    dimensions,
    isDarkTheme,
    densityPercent,
    expandedClusters,
    resetTrigger,
  ]);

  // Reset layout function
  const handleResetLayout = () => {
    // Collapse all expanded clusters
    setExpandedClusters(new Set());

    // Clear all fixed positions and nodes (will force recreation)
    nodesRef.current = [];
    linksRef.current = [];

    // Reset zoom/pan
    if (canvasRef.current && zoomBehaviorRef.current) {
      const canvas = d3Selection.select(canvasRef.current);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      canvas.call(zoomBehaviorRef.current.transform, d3Zoom.zoomIdentity);
    }

    // Trigger re-simulation with fresh state
    setResetTrigger((prev) => prev + 1);
  };

  // Helper function to find any node at mouse position
  const findNodeAtPosition = (
    clientX: number,
    clientY: number,
  ): ForceNode | null => {
    if (!canvasRef.current) return null;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const transform = transformRef.current;
    const transformedX = (x - transform.x) / transform.k;
    const transformedY = (y - transform.y) / transform.k;

    const nodes = nodesRef.current;
    for (const node of nodes) {
      if (node.x === undefined || node.y === undefined) continue;
      const radius = node.type === "cluster" ? 15 : 5;
      const dx = node.x - transformedX;
      const dy = node.y - transformedY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius + 5) {
        return node;
      }
    }
    return null;
  };

  // Setup zoom and pan
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = d3Selection.select(canvasRef.current);
    const zoom = d3Zoom
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 10])
      .on("zoom", (event: d3Zoom.D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        transformRef.current = event.transform;
        // Redraw with new transform - no need to restart simulation
      })
      // Disable zoom in certain cases
      .filter((event) => {
        // Disable on double-click (used for cluster expansion)
        if (event.type === "dblclick") {
          return false;
        }

        // Disable when already dragging
        if (isDraggingRef.current) {
          return false;
        }

        // Disable zoom pan on mousedown/touchstart if clicking on any node
        if (event.type === "mousedown" || event.type === "touchstart") {
          const mouseEvent = event as MouseEvent;
          const node = findNodeAtPosition(
            mouseEvent.clientX,
            mouseEvent.clientY,
          );
          if (node) {
            return false; // Let drag handler take over
          }
        }

        return true;
      });

    zoomBehaviorRef.current = zoom;
    canvas.call(zoom);

    return () => {
      canvas.on(".zoom", null);
    };
  }, []);

  // Handle mouse move for hover
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    let rafId: number | null = null;

    function handleMouseMove(event: MouseEvent) {
      if (rafId) return; // Throttle to animation frame

      rafId = requestAnimationFrame(() => {
        rafId = null;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Transform mouse coordinates based on zoom/pan
        const transform = transformRef.current;
        const transformedX = (x - transform.x) / transform.k;
        const transformedY = (y - transform.y) / transform.k;

        // Find closest node
        const nodes = nodesRef.current;
        let closestNode: ForceNode | null = null;
        let closestDist = Infinity;

        for (const node of nodes) {
          if (node.x === undefined || node.y === undefined) continue;
          const radius = node.type === "cluster" ? 15 : 5;
          const dx = node.x - transformedX;
          const dy = node.y - transformedY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < radius + 5 && dist < closestDist) {
            closestDist = dist;
            closestNode = node;
          }
        }

        hoveredNodeRef.current = closestNode;
        setHoveredNodeDisplay(closestNode);

        // Update cursor style - all nodes can be dragged
        if (!isDraggingRef.current) {
          if (closestNode !== null) {
            setCursorStyle("move"); // All nodes can be dragged
          } else {
            setCursorStyle("grab"); // Empty space - default grab for panning
          }
        }
      });
    }

    canvas.addEventListener("mousemove", handleMouseMove);
    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Handle single click with modifier key (for paper nodes to view details)
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    function handleClick(event: MouseEvent) {
      // Don't handle clicks if we just finished dragging
      if (isDraggingRef.current) return;

      // Only handle if Cmd (Mac) or Ctrl (Windows/Linux) is pressed
      if (!event.metaKey && !event.ctrlKey) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Transform mouse coordinates
      const transform = transformRef.current;
      const transformedX = (x - transform.x) / transform.k;
      const transformedY = (y - transform.y) / transform.k;

      // Find clicked node
      const nodes = nodesRef.current;
      for (const node of nodes) {
        if (node.x === undefined || node.y === undefined) continue;
        const radius = node.type === "cluster" ? 15 : 5;
        const dx = node.x - transformedX;
        const dy = node.y - transformedY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius + 5) {
          // Open paper details when Cmd/Ctrl+click on paper nodes
          if (node.type === "paper" && node.paperId) {
            onPaperClick(node.paperId);
          }
          break;
        }
      }
    }

    canvas.addEventListener("click", handleClick);
    return () => canvas.removeEventListener("click", handleClick);
  }, [onPaperClick]);

  // Handle double click (for cluster nodes to expand/collapse)
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    function handleDoubleClick(event: MouseEvent) {
      event.preventDefault(); // Prevent default behavior
      event.stopPropagation(); // Stop event from bubbling

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Transform mouse coordinates
      const transform = transformRef.current;
      const transformedX = (x - transform.x) / transform.k;
      const transformedY = (y - transform.y) / transform.k;

      // Find clicked node
      const nodes = nodesRef.current;
      for (const node of nodes) {
        if (node.x === undefined || node.y === undefined) continue;
        const radius = node.type === "cluster" ? 15 : 5;
        const dx = node.x - transformedX;
        const dy = node.y - transformedY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius + 5) {
          if (node.type === "cluster") {
            // Toggle cluster expansion
            console.log(
              "Expanding cluster:",
              node.clusterId,
              node.clusterLabel,
            );
            setExpandedClusters((prev) => {
              const newSet = new Set(prev);
              if (newSet.has(node.clusterId)) {
                newSet.delete(node.clusterId);
              } else {
                newSet.add(node.clusterId);
              }
              return newSet;
            });
          } else {
            // Collapse the cluster if double-clicking a paper node
            console.log("Collapsing cluster:", node.clusterId);
            setExpandedClusters((prev) => {
              const newSet = new Set(prev);
              newSet.delete(node.clusterId);
              return newSet;
            });
          }
          break;
        }
      }
    }

    canvas.addEventListener("dblclick", handleDoubleClick, { capture: true });
    return () =>
      canvas.removeEventListener("dblclick", handleDoubleClick, {
        capture: true,
      });
  }, []);

  // Handle node dragging (all nodes)
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    function handleMouseDown(event: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Transform mouse coordinates
      const transform = transformRef.current;
      const transformedX = (x - transform.x) / transform.k;
      const transformedY = (y - transform.y) / transform.k;

      // Find any node at mouse position (all nodes can be dragged)
      const nodes = nodesRef.current;
      for (const node of nodes) {
        if (node.x === undefined || node.y === undefined) continue;
        const radius = node.type === "cluster" ? 15 : 5;
        const dx = node.x - transformedX;
        const dy = node.y - transformedY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius + 5) {
          // Start dragging this node
          isDraggingRef.current = true;
          draggedNodeRef.current = node;
          setCursorStyle("grabbing");
          // Fix node position during drag
          node.fx = node.x;
          node.fy = node.y;
          event.preventDefault();
          event.stopPropagation();
          break;
        }
      }
    }

    function handleMouseMove(event: MouseEvent) {
      if (!isDraggingRef.current || !draggedNodeRef.current) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Transform mouse coordinates
      const transform = transformRef.current;
      const transformedX = (x - transform.x) / transform.k;
      const transformedY = (y - transform.y) / transform.k;

      // Update node position
      const node = draggedNodeRef.current;
      node.fx = transformedX;
      node.fy = transformedY;

      // Reheat simulation slightly to adjust connected nodes
      if (simulationRef.current) {
        simulationRef.current.alpha(0.1).restart();
      }

      event.preventDefault();
    }

    function handleMouseUp() {
      if (isDraggingRef.current && draggedNodeRef.current) {
        // Keep node fixed at its current position (user can drag again to move)
        // Alternatively, unfix to let physics take over:
        // draggedNodeRef.current.fx = null;
        // draggedNodeRef.current.fy = null;

        isDraggingRef.current = false;
        draggedNodeRef.current = null;

        // Reset cursor based on current hover state
        setCursorStyle(hoveredNodeRef.current ? "move" : "grab");
      }
    }

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseUp); // Handle case where mouse leaves canvas

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        backgroundColor: isDarkTheme ? "#0d121c" : "white",
      }}
    >
      {/* Controls */}
      <div
        className={`
          absolute right-2.5 top-2.5 z-10 hidden

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
                htmlFor="force-density-slider"
                style={{
                  fontSize: "12px",
                  margin: 0,
                  color: isDarkTheme ? "#d1d5db" : "#666",
                }}
              >
                Node Density (%)
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
              id="force-density-slider"
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
              lineHeight: "1.5",
            }}
          >
            <div>Scroll: zoom | Drag space: pan | Drag node: reposition</div>
            <div className="mt-0.5">
              Cmd/Ctrl+click paper: details | Double-click: expand/collapse
            </div>
          </div>
          <Button
            type="button"
            onClick={handleResetLayout}
            variant="outline"
            size="xs"
            className="flex w-full items-center justify-center gap-2"
          >
            Reset Layout
          </Button>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredNodeDisplay && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: "20px",
            transform: "translateX(-50%)",
            backgroundColor: isDarkTheme
              ? "rgba(18, 25, 38, 0.95)"
              : "rgba(255, 255, 255, 0.95)",
            padding: "12px 16px",
            borderRadius: "6px",
            fontSize: "13px",
            color: isDarkTheme ? "#f9fafb" : "#333",
            border: isDarkTheme ? "1px solid #374151" : "1px solid #ddd",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            maxWidth: "400px",
            pointerEvents: "none",
            zIndex: 20,
          }}
        >
          {hoveredNodeDisplay.type === "cluster" ? (
            <>
              <div style={{ fontWeight: "600", marginBottom: "4px" }}>
                {hoveredNodeDisplay.clusterLabel}
              </div>
              <div style={{ marginBottom: "4px" }}>
                <strong>Papers:</strong> {hoveredNodeDisplay.paperCount}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: isDarkTheme ? "#9ca3af" : "#6b7280",
                }}
              >
                Double-click to expand
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: "600", marginBottom: "4px" }}>
                Cluster: {hoveredNodeDisplay.clusterLabel}
              </div>
              <div style={{ marginBottom: "4px" }}>
                <strong>Title:</strong>{" "}
                {hoveredNodeDisplay.title &&
                hoveredNodeDisplay.title.length > 80
                  ? hoveredNodeDisplay.title.substring(0, 80) + "..."
                  : hoveredNodeDisplay.title}
              </div>
              {hoveredNodeDisplay.field && (
                <div style={{ marginBottom: "4px" }}>
                  <strong>Field:</strong> {hoveredNodeDisplay.field}
                </div>
              )}
              {hoveredNodeDisplay.year && (
                <div>
                  <strong>Year:</strong> {hoveredNodeDisplay.year}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{
          width: "100%",
          height: "100%",
          cursor: cursorStyle,
        }}
      />
    </div>
  );
}
