import type { FeatureFountainMetadata } from "./metadata.js";

export type FeatureFountainContext = {
  pageUrl: string;
  viewport: string;
  metadata?: FeatureFountainMetadata;
};

const MAX_PAGE_URL_LENGTH = 2048;
const MIN_VIEWPORT = 1;
const MAX_VIEWPORT = 10_000;

export function buildPageUrl(location: Location): string | undefined {
  if (location.origin === "null") return undefined;
  const pageUrl = `${location.origin}${location.pathname}`;
  if (pageUrl.length > MAX_PAGE_URL_LENGTH) return undefined;
  return pageUrl;
}

export function buildViewport(window: Window): string | undefined {
  const width = Math.round(window.innerWidth);
  const height = Math.round(window.innerHeight);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < MIN_VIEWPORT ||
    width > MAX_VIEWPORT ||
    height < MIN_VIEWPORT ||
    height > MAX_VIEWPORT
  ) {
    return undefined;
  }
  return `${width}x${height}`;
}

export function buildWidgetContext(
  window: Window,
  metadata?: FeatureFountainMetadata,
): FeatureFountainContext | undefined {
  const pageUrl = buildPageUrl(window.location);
  const viewport = buildViewport(window);
  if (!pageUrl || !viewport) return undefined;
  const context: FeatureFountainContext = { pageUrl, viewport };
  if (metadata) context.metadata = metadata;
  return context;
}
