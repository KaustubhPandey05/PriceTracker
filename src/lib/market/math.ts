import type { MarketListing } from "@/types/market";

export function median(values: number[]) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[midpoint];
  return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

export function money(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

export function includedPrices(listings: MarketListing[]) {
  return listings
    .filter((listing) => listing.includedInAnalysis)
    .map((listing) => listing.price + (listing.shipping ?? 0));
}
