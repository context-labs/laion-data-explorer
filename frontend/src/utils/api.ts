import * as pako from "pako";

/**
 * API base URL, configurable via VITE_API_URL environment variable.
 * Defaults to "/api" for local development with proxy.
 */
export const API_URL = import.meta.env.VITE_API_URL ?? "/api";

/**
 * Constructs a full API URL by appending the path to the base API URL.
 */
export function getApiUrl(path: string): string {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  // Remove /api prefix from path if present, since it's in the base URL
  const finalPath = cleanPath.startsWith("api/")
    ? cleanPath.slice(4)
    : cleanPath;
  return `${API_URL}/${finalPath}`;
}

/**
 * Fetch and decompress gzip-compressed JSON responses from the API.
 * Handles both compressed and uncompressed responses transparently.
 */
export async function fetchCompressed<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const isCompressed = response.headers.get("X-Content-Compressed");
  const contentType = response.headers.get("Content-Type") ?? "";

  // If the response is gzip-compressed or binary, try to decompress
  if (isCompressed === "gzip" || contentType.includes("octet-stream")) {
    try {
      const arrayBuffer = await response.arrayBuffer();
      // Try to decompress
      const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), {
        to: "string",
      });
      return JSON.parse(decompressed) as T;
    } catch (err) {
      // If decompression fails, the response might already be decompressed
      // Try to parse as JSON directly
      console.warn("Decompression failed, trying as plain JSON", err);
      const text = await response.text();
      return JSON.parse(text) as T;
    }
  }

  // Otherwise, parse as regular JSON
  return (await response.json()) as T;
}
