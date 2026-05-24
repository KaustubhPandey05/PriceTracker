export type SearchMode = "strict" | "balanced" | "loose";
export type ListingConfidence = "high" | "medium" | "low";
export type ListingSource = "mock-ebay" | "ebay" | "pricecharting" | "pokemon-tcg";
export type ProviderStatus = "connected" | "mocked" | "missing-config" | "pending-approval" | "disabled" | "error";

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
  basis: "active-listing proxy" | "sold-history";
  factors: string[];
  soldCounts: {
    sold7: number;
    sold30: number;
    sold90: number;
  };
  medianSoldPrice?: number;
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
  explainers: Record<string, string>;
}
