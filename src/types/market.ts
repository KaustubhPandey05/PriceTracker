export type SearchMode = "strict" | "balanced" | "loose";
export type ListingConfidence = "high" | "medium" | "low";
export type ListingSource = "mock-ebay" | "ebay" | "pricecharting" | "pokemon-tcg";
export type ProviderStatus = "connected" | "mocked" | "missing-config" | "unavailable" | "disabled" | "error";

export interface CardSearchParams {
  q: string;
  set?: string;
  number?: string;
  variant?: string;
  condition?: string;
  grade?: string;
  mode: SearchMode;
}

export interface CardPrice {
  source: string;
  variant: string;
  low?: number;
  mid?: number;
  high?: number;
  market?: number;
  currency: string;
  updatedAt?: string;
}

export interface CardIdentity {
  id: string;
  name: string;
  setName: string;
  setSeries?: string;
  number: string;
  rarity?: string;
  imageUrl?: string;
  tcgplayerUrl?: string;
  cardmarketUrl?: string;
  prices: CardPrice[];
}

export interface MarketListing {
  id: string;
  title: string;
  price: number;
  shipping?: number;
  currency: string;
  url: string;
  source: ListingSource;
  condition?: string;
  grade?: string;
  soldAt?: string;
  imageUrl?: string;
  lifecycleStatus?: ListingLifecycleStatus;
  confidence: ListingConfidence;
  includedInAnalysis: boolean;
  reason: string;
}

export interface ProviderHealth {
  name: string;
  status: ProviderStatus;
  detail: string;
}

export interface DemandInsight {
  signal: "pending" | "weak" | "steady" | "strong" | "unknown";
  confidence: "low" | "medium" | "high";
  score: number;
  basis: "active-listing proxy" | "listing-lifecycle" | "sold-history";
  factors: string[];
  soldCounts: {
    sold7: number;
    sold30: number;
    sold90: number;
  };
  medianSoldPrice?: number;
}

export type ListingLifecycleStatus = "new" | "continuing" | "repriced" | "unavailable";
export type TrackingSeriesKind = "manual" | "raw-near-mint-proxy" | "psa-9";

export interface ListingPricePoint {
  observedAt: string;
  totalAsk: number;
}

export interface ListingObservation {
  seriesKey: string;
  listingId: string;
  title: string;
  url: string;
  imageUrl?: string;
  currency: string;
  condition?: string;
  grade?: string;
  confidence: ListingConfidence;
  includedInAnalysis: boolean;
  reason: string;
  firstSeenAt: string;
  lastCheckedAt: string;
  unavailableAt?: string;
  status: ListingLifecycleStatus;
  priceHistory: ListingPricePoint[];
}

export interface ListingTrendSignal {
  label: "Not enough history" | "Cooling" | "Stable" | "Strengthening";
  confidence: "low" | "medium";
  score?: number;
  factors: string[];
  newListings: number;
  unavailableListings: number;
  priceIncreases: number;
  priceCuts: number;
  activeSupplyChange: number;
  medianAskChange?: number;
}

export interface TrackingSeries {
  key: string;
  name: string;
  kind: TrackingSeriesKind;
  query: CardSearchParams;
}

export interface ListingCapture {
  id: string;
  seriesKey: string;
  seriesName: string;
  seriesKind: TrackingSeriesKind;
  query: CardSearchParams;
  capturedAt: string;
  dayKey: string;
  activeListingCount: number;
  includedListingIds: string[];
  medianActiveAsk?: number;
  newListings: number;
  unavailableListings: number;
  priceIncreases: number;
  priceCuts: number;
  trend: ListingTrendSignal;
}

export interface TrackedSeriesSummary {
  key: string;
  name: string;
  kind: TrackingSeriesKind;
  captures: number;
  lastCapturedAt?: string;
  activeListings?: number;
  trend: ListingTrendSignal;
}

export interface DemandSnapshot {
  id: string;
  queryKey: string;
  capturedAt: string;
  cardName: string;
  setName: string;
  number: string;
  activeListingCount: number;
  includedListingCount: number;
  medianActiveAsk?: number;
  sold7: number;
  sold30: number;
  sold90: number;
  medianSoldPrice?: number;
  demandScore: number;
  demandBasis: DemandInsight["basis"];
  supplySignal: "low" | "normal" | "high" | "unknown";
}

export interface DemandHistory {
  snapshots: DemandSnapshot[];
  trend: "not enough history" | "increasing" | "decreasing" | "stable" | "volatile";
  changeFromPrevious?: number;
  change7?: number;
  change30?: number;
}

export interface MarketAnalysis {
  card?: CardIdentity;
  query: CardSearchParams;
  providerHealth: ProviderHealth[];
  referencePrice?: number;
  activeListings: MarketListing[];
  soldListings: MarketListing[];
  metrics: {
    activeListingCount: number;
    includedListingCount: number;
    medianAsk?: number;
    lowestAsk?: number;
    highestAsk?: number;
    referenceDelta?: number;
    supplySignal: "low" | "normal" | "high" | "unknown";
    demandSignal: "pending" | "weak" | "steady" | "strong" | "unknown";
    trend: "rising" | "falling" | "stable" | "volatile" | "insufficient data";
    confidence: "low" | "medium" | "high";
  };
  demandInsight: DemandInsight;
  demandHistory: DemandHistory;
  listingTrend?: ListingTrendSignal;
  gradeBreakdown: Record<string, number>;
  summary: string[];
}

export interface OverviewMetric {
  label: string;
  value: string;
  detail: string;
}

export interface LeaderboardRow {
  id: string;
  cardName: string;
  setName: string;
  number: string;
  imageUrl?: string;
  primaryValue: number;
  secondaryValue?: number;
  badge: string;
  note: string;
}

export interface NoisyListingRow {
  id: string;
  title: string;
  price: number;
  reason: string;
  url: string;
}

export interface MarketOverview {
  generatedAt: string;
  metrics: OverviewMetric[];
  highestValueCards: LeaderboardRow[];
  valueGapCards: LeaderboardRow[];
  tightSupplyCards: LeaderboardRow[];
  noisyListings: NoisyListingRow[];
  trackedSeries: TrackedSeriesSummary[];
  explainers: Record<string, string>;
}
