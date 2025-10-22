import { atom } from "jotai";
import { atomFamily } from "jotai/utils";
import type { ClusterInfo, ClusterTemporalData } from "../types";

// Cache for cluster distribution data
export const clustersDataAtom = atom<ClusterInfo[] | null>(null);

// Cache family for temporal data by year range
// Key format: "minYear-maxYear"
export const temporalDataAtomFamily = atomFamily((_yearRange: string) =>
  atom<ClusterTemporalData[] | null>(null),
);

// Helper to create year range key
export function createYearRangeKey(minYear: number, maxYear: number): string {
  return `${minYear}-${maxYear}`;
}
