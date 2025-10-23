export type ViewMode =
  | "3d"
  | "heatmap"
  | "stacked"
  | "distribution"
  | "samples"
  | "force";

export const VIEW_MODE_TO_ROUTE: Record<ViewMode, string> = {
  "3d": "/embeddings",
  force: "/force-layout",
  distribution: "/distribution-chart",
  samples: "/paper-explorer",
  heatmap: "/heatmap",
  stacked: "/stacked-chart",
};

export const ROUTE_TO_VIEW_MODE: Record<string, ViewMode> = {
  "/embeddings": "3d",
  "/force-layout": "force",
  "/distribution-chart": "distribution",
  "/paper-explorer": "samples",
  "/heatmap": "heatmap",
  "/stacked-chart": "stacked",
  "/": "3d", // default route
};

export function getViewModeFromPath(path: string): ViewMode {
  // Handle paper-explorer with optional index
  if (path.startsWith("/paper-explorer")) {
    return "samples";
  }
  return ROUTE_TO_VIEW_MODE[path] || "3d";
}

export function getPathFromViewMode(
  viewMode: ViewMode,
  paperIndex?: number,
): string {
  const basePath = VIEW_MODE_TO_ROUTE[viewMode];
  if (viewMode === "samples" && paperIndex !== undefined) {
    // Convert 0-based internal index to 1-based URL index for human readability
    return `${basePath}/${paperIndex + 1}`;
  }
  return basePath;
}

export function getPaperIndexFromPath(path: string): number | null {
  const match = path.match(/^\/paper-explorer\/(\d+)$/);
  if (match && match[1]) {
    const urlIndex = parseInt(match[1], 10);
    if (isNaN(urlIndex) || urlIndex < 1) {
      return null;
    }
    // Convert 1-based URL index to 0-based internal index
    return urlIndex - 1;
  }
  return null;
}
