import { Button, Input } from "~/ui";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import type { ClusterInfo } from "../types";

interface ClusterLegendProps {
  clusters: ClusterInfo[];
  selectedClusterIds: Set<number>;
  onToggleCluster: (clusterId: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onSelectRandom: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  viewMode: "3d" | "heatmap" | "stacked" | "distribution" | "samples" | "force";
  paperSearchQuery: string;
  onPaperSearchChange: (query: string) => void;
  onPaperSearchSubmit: (e: React.FormEvent) => void;
  totalPapers: number;
}

export function ClusterLegend({
  clusters,
  selectedClusterIds,
  onToggleCluster,
  onSelectAll,
  onClearAll,
  onSelectRandom,
  isCollapsed,
  onToggleCollapse,
  viewMode,
  paperSearchQuery,
  onPaperSearchChange,
  onPaperSearchSubmit,
  totalPapers,
}: ClusterLegendProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const sortedClusters = [...clusters].sort(
    // alphabetically by cluster_label
    (a, b) => {
      if (a.cluster_label < b.cluster_label) return -1;
      if (a.cluster_label > b.cluster_label) return 1;
      return 0;
    },
  );

  const filteredClusters = sortedClusters.filter((cluster) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return cluster.cluster_label.toLowerCase().includes(query);
  });

  if (isCollapsed) {
    return (
      <div className="flex h-full items-center justify-center p-0">
        <div
          className={`cursor-pointer p-4 text-muted-foreground`}
          onClick={onToggleCollapse}
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {viewMode === "3d" && (
        <div className="mb-4">
          <h3
            onClick={onToggleCollapse}
            className={`
              mb-3 flex cursor-pointer items-center justify-between
              font-semibold text-foreground
            `}
          >
            Search Papers
            <ChevronLeftIcon
              className={`
                ml-2 hidden h-4 w-4

                lg:block
              `}
            />
          </h3>
          <form
            onSubmit={onPaperSearchSubmit}
            className={`flex items-center gap-2`}
          >
            <Input
              type="text"
              placeholder={`Search ${totalPapers.toLocaleString()} papers...`}
              value={paperSearchQuery}
              onChange={(e) => onPaperSearchChange(e.target.value)}
              className="h-8 flex-1 text-sm"
            />
            <Button type="submit" size="xs" variant="secondary">
              <SearchIcon className="mr-2 h-4 w-4" />
              Search
            </Button>
          </form>
        </div>
      )}
      <div className="mb-4">
        <h3 className="mb-3 font-semibold text-foreground">Dataset Clusters</h3>
        <Input
          type="text"
          placeholder={`Search ${clusters.length.toLocaleString()} clusters...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mb-3 h-8 text-sm"
        />
        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={onSelectAll}
            variant="secondary"
            size="xs"
            className="w-full"
          >
            Select All
          </Button>
          <Button
            onClick={onClearAll}
            variant="secondary"
            size="xs"
            className="w-full"
          >
            Clear All
          </Button>
          <Button
            onClick={onSelectRandom}
            variant="secondary"
            size="xs"
            className="w-full"
          >
            Random
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {filteredClusters.length === 0 && searchQuery.trim() && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No clusters match "{searchQuery}"
          </p>
        )}
        {filteredClusters.map((cluster) => {
          const isSelected =
            selectedClusterIds.size === 0 ||
            selectedClusterIds.has(cluster.cluster_id);

          return (
            <div
              key={cluster.cluster_id}
              className={`
                flex cursor-pointer items-center gap-0.5 rounded-md border
                border-border px-3 py-2 transition-all

                hover:translate-x-0.5 hover:bg-muted/50

                ${isSelected ? "bg-muted/30" : "opacity-50"}
              `}
              onClick={() => onToggleCluster(cluster.cluster_id)}
            >
              <div
                className={`
                  mr-1.5 h-3.5 w-3.5 flex-shrink-0 rounded-sm border
                  border-border/50
                `}
                style={{
                  backgroundColor: cluster.color,
                  opacity: isSelected ? 1 : 0.3,
                }}
              />
              <div className="min-w-0 flex-1">
                <div
                  className={`
                    overflow-hidden text-ellipsis whitespace-nowrap text-sm
                    font-medium text-foreground
                  `}
                >
                  {cluster.cluster_label}
                </div>
                <div className="text-xs text-muted-foreground">
                  {cluster.count.toLocaleString()} papers
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
