export type LayoutType =
  | "original"
  | "sphere"
  | "galaxy"
  | "wave"
  | "helix"
  | "torus";

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface TransformConfig {
  clusterId: number;
  clusterIndex: number;
  totalClusters: number;
  pointIndex: number;
  totalPoints: number;
}

/**
 * Original layout - no transformation, uses UMAP/t-SNE coordinates as-is
 */
export function originalTransform(point: Point3D): Point3D {
  return { ...point };
}

/**
 * Sphere layout - maps clusters to a spherical surface
 * Each cluster occupies a sector of the sphere
 */
export function sphereTransform(
  point: Point3D,
  config: TransformConfig,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): Point3D {
  // Normalize coordinates to 0-1 range
  const u = (point.x - bounds.minX) / (bounds.maxX - bounds.minX || 1);
  const v = (point.y - bounds.minY) / (bounds.maxY - bounds.minY || 1);

  // Assign cluster to a sector using fibonacci sphere distribution
  const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~2.399
  const clusterTheta = config.clusterIndex * goldenAngle;
  const clusterPhi = Math.acos(
    1 - (2 * (config.clusterIndex + 0.5)) / config.totalClusters,
  );

  // Sector size based on number of clusters
  const sectorSize = Math.PI / Math.sqrt(config.totalClusters);

  // Convert normalized coordinates to angles within the sector
  const theta = clusterTheta + (u - 0.5) * sectorSize;
  const phi = clusterPhi + (v - 0.5) * sectorSize * 0.5;

  // Base radius with slight variation based on z coordinate
  const radius = 100 + (point.z || 0) * 0.5;

  // Convert spherical to cartesian coordinates
  return {
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.sin(phi) * Math.sin(theta),
    z: radius * Math.cos(phi),
  };
}

/**
 * Galaxy spiral layout - creates spiral arms like a galaxy
 * Clusters are distributed as spiral arms radiating from center
 */
export function galaxyTransform(
  point: Point3D,
  config: TransformConfig,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): Point3D {
  // Normalize coordinates to 0-1 range
  const normalizedX =
    (point.x - bounds.minX) / (bounds.maxX - bounds.minX || 1);
  const normalizedY =
    (point.y - bounds.minY) / (bounds.maxY - bounds.minY || 1);

  // Number of spiral arms (max 8 for visual clarity)
  const armCount = Math.min(8, Math.max(3, config.totalClusters));
  const armIndex = config.clusterIndex % armCount;

  // Base angle for this arm (evenly distributed around circle)
  const baseAngle = (armIndex / armCount) * 2 * Math.PI;

  // Distance from center increases with point position
  // Mix in original coordinates for organic distribution
  const distanceFromCenter = 20 + normalizedX * 80 + config.pointIndex * 0.02;

  // Spiral tightness (how much the arm curves)
  const spiralTightness = 0.15;
  const spiralAngle = baseAngle + distanceFromCenter * spiralTightness;

  // Add local variation based on original y coordinate
  const offsetAngle = (normalizedY - 0.5) * 0.3;
  const offsetRadius = (normalizedY - 0.5) * 10;

  const finalAngle = spiralAngle + offsetAngle;
  const finalRadius = distanceFromCenter + offsetRadius;

  // Height variation based on z coordinate (flattened galaxy)
  const height = (point.z || 0) * 0.2 + (normalizedY - 0.5) * 5;

  return {
    x: finalRadius * Math.cos(finalAngle),
    y: finalRadius * Math.sin(finalAngle),
    z: height,
  };
}

/**
 * Wave/Terrain layout - creates undulating wave patterns
 * Produces a topographic-like terrain with peaks and valleys
 */
export function waveTransform(
  point: Point3D,
  config: TransformConfig,
): Point3D {
  const x = point.x || 0;
  const y = point.y || 0;

  // Wave parameters
  const frequency = 0.03;
  const amplitude = 25;

  // Create interference pattern with multiple waves
  const wave1 = Math.sin(x * frequency) * amplitude;
  const wave2 = Math.cos(y * frequency) * amplitude;
  const wave3 = Math.sin((x + y) * frequency * 0.7) * amplitude * 0.5;
  const wave4 = Math.cos((x - y) * frequency * 0.5) * amplitude * 0.3;

  // Cluster-based layer offset creates distinct "elevation zones"
  const clusterOffset = (config.clusterIndex / config.totalClusters) * 40 - 20;

  // Combine all waves and add cluster offset
  const finalZ = wave1 + wave2 + wave3 + wave4 + clusterOffset;

  return {
    x: x,
    y: y,
    z: finalZ,
  };
}

/**
 * Helix/DNA Spiral layout - creates a spiral helix ascending pattern
 * Clusters wrap around a helix like DNA strands
 */
export function helixTransform(
  point: Point3D,
  config: TransformConfig,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): Point3D {
  // Normalize coordinates to 0-1 range
  const normalizedX =
    (point.x - bounds.minX) / (bounds.maxX - bounds.minX || 1);
  const normalizedY =
    (point.y - bounds.minY) / (bounds.maxY - bounds.minY || 1);

  // Each cluster gets a section of the helix
  const clusterProgress = config.clusterIndex / config.totalClusters;
  const pointProgress = config.pointIndex / config.totalPoints;
  const totalProgress = clusterProgress + pointProgress / config.totalClusters;

  // Helix parameters
  const turns = 4; // Number of complete spiral turns
  const angle = totalProgress * turns * 2 * Math.PI;
  const height = totalProgress * 300 - 150; // Vertical spread, centered

  // Base radius with variation based on original x coordinate
  const radiusBase = 40;
  const radiusVariation = normalizedX * 15;
  const radius = radiusBase + radiusVariation;

  // Add some "wobble" based on y coordinate for organic feel
  const wobble = Math.sin(angle * 3) * normalizedY * 5;

  return {
    x: (radius + wobble) * Math.cos(angle),
    y: (radius + wobble) * Math.sin(angle),
    z: height + (point.z || 0) * 0.1, // Small local variation
  };
}

/**
 * Torus (donut) layout - wraps clusters around a torus surface
 * Creates a continuous loop with interesting topology
 */
export function torusTransform(
  point: Point3D,
  config: TransformConfig,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): Point3D {
  // Normalize coordinates to 0-1 range
  const u = (point.x - bounds.minX) / (bounds.maxX - bounds.minX || 1);
  const v = (point.y - bounds.minY) / (bounds.maxY - bounds.minY || 1);

  // Torus parameters
  const majorRadius = 60; // Distance from center to tube center
  const minorRadius = 25; // Tube radius

  // Calculate angles based on cluster and point position
  // Major angle (around the torus)
  const clusterAngleOffset =
    (config.clusterIndex / config.totalClusters) * 2 * Math.PI;
  const majorSectorSize = (2 * Math.PI) / Math.max(config.totalClusters, 1);
  const theta = clusterAngleOffset + (u - 0.5) * majorSectorSize;

  // Minor angle (around the tube)
  const phi = v * 2 * Math.PI;

  // Add slight variation based on z coordinate
  const radiusVariation = (point.z || 0) * 0.1;

  // Torus parametric equations
  const x =
    (majorRadius + (minorRadius + radiusVariation) * Math.cos(phi)) *
    Math.cos(theta);
  const y =
    (majorRadius + (minorRadius + radiusVariation) * Math.cos(phi)) *
    Math.sin(theta);
  const z = (minorRadius + radiusVariation) * Math.sin(phi);

  return { x, y, z };
}

/**
 * Apply the appropriate transform based on layout type
 */
export function applyLayoutTransform(
  points: Point3D[],
  layoutType: LayoutType,
  config: Omit<TransformConfig, "pointIndex" | "totalPoints">,
): Point3D[] {
  if (layoutType === "original") {
    return points.map(originalTransform);
  }

  // Calculate bounds for normalization
  const bounds = {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  };

  return points.map((point, index) => {
    const fullConfig: TransformConfig = {
      ...config,
      pointIndex: index,
      totalPoints: points.length,
    };

    switch (layoutType) {
      case "sphere":
        return sphereTransform(point, fullConfig, bounds);
      case "galaxy":
        return galaxyTransform(point, fullConfig, bounds);
      case "wave":
        return waveTransform(point, fullConfig);
      case "helix":
        return helixTransform(point, fullConfig, bounds);
      case "torus":
        return torusTransform(point, fullConfig, bounds);
      default:
        return point;
    }
  });
}

/**
 * Get optimal camera position for each layout type
 */
export function getCameraForLayout(layoutType: LayoutType): {
  eye: Point3D;
  center: Point3D;
  up: Point3D;
} {
  switch (layoutType) {
    case "sphere":
      return {
        eye: { x: 2, y: 2, z: 1.5 },
        center: { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 0, z: 1 },
      };
    case "galaxy":
      return {
        eye: { x: 0.2, y: 0.2, z: 2.5 }, // Top-down view for galaxy
        center: { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 1, z: 0 },
      };
    case "wave":
      return {
        eye: { x: 2, y: 1, z: 1 }, // Side angle for terrain
        center: { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 0, z: 1 },
      };
    case "helix":
      return {
        eye: { x: 1.5, y: 1.5, z: 1 }, // Angled view to see spiral
        center: { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 0, z: 1 },
      };
    case "torus":
      return {
        eye: { x: 1.8, y: 1.8, z: 1.2 }, // Elevated angle to see donut shape
        center: { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 0, z: 1 },
      };
    case "original":
    default:
      return {
        eye: { x: 0.6, y: 0.6, z: 0.6 },
        center: { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 0, z: 1 },
      };
  }
}
