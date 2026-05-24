import type { CardIdentity, CardSearchParams, DemandInsight, MarketAnalysis, MarketListing } from "@/types/market";
import { includedPrices, median } from "@/lib/market/math";
import { getActiveListings, getSoldListings } from "@/lib/providers/ebay";
import { getProviderHealth } from "@/lib/providers/health";
import { findMockCard } from "@/lib/providers/mock";
import { searchPokemonCards } from "@/lib/providers/pokemonTcg";
import { getDemandHistory } from "@/lib/snapshots";

function getReferencePrice(card?: CardIdentity) {
  return card?.prices.find((price) => typeof price.market === "number")?.market
    ?? card?.prices.find((price) => typeof price.mid === "number")?.mid;
}

function getGradeBreakdown(listings: MarketListing[]) {
  return listings.reduce<Record<string, number>>((acc, listing) => {
    const key = listing.grade ?? listing.condition ?? "Unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function buildSummary(referencePrice: number | undefined, medianAsk: number | undefined, includedCount: number, activeCount: number, demandInsight: DemandInsight) {
  const summary: string[] = [];
  if (!activeCount) {
    summary.push("No active eBay-style listings are available for this search yet.");
    return summary;
  }
  if (!includedCount) {
    summary.push("Listings were found, but none met the confidence threshold for market analysis.");
  }
  if (referencePrice && medianAsk) {
    const spread = ((medianAsk - referencePrice) / referencePrice) * 100;
    summary.push(`Median active asking price is ${Math.abs(spread).toFixed(1)}% ${spread >= 0 ? "above" : "below"} the reference price.`);
  }
  summary.push(`Demand is currently estimated from ${demandInsight.basis} with ${demandInsight.confidence} confidence.`);
  return summary;
}

function priceSpread(prices: number[]) {
  if (prices.length < 2) return undefined;
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const middle = median(prices);
  return middle ? (high - low) / middle : undefined;
}

function soldWithinDays(listings: MarketListing[], days: number) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return listings.filter((listing) => listing.soldAt && new Date(listing.soldAt).getTime() >= cutoff);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildDemandInsight(prices: number[], includedCount: number, activeCount: number, soldListings: MarketListing[]): DemandInsight {
  const sold7Listings = soldWithinDays(soldListings, 7);
  const sold30Listings = soldWithinDays(soldListings, 30);
  const sold90Listings = soldWithinDays(soldListings, 90);
  const soldCounts = {
    sold7: sold7Listings.length,
    sold30: sold30Listings.length,
    sold90: sold90Listings.length
  };

  if (soldListings.length) {
    const soldPrices = sold30Listings.map((listing) => listing.price + (listing.shipping ?? 0));
    const medianSoldPrice = median(soldPrices);
    const medianActiveAsk = median(prices);
    const sellThroughRate = soldCounts.sold30 / Math.max(1, soldCounts.sold30 + includedCount);
    const sellThroughScore = clampScore((sellThroughRate / 0.35) * 100);
    const salesVelocityScore = clampScore((soldCounts.sold30 / 10) * 100);
    const priceStrengthScore = medianSoldPrice && medianActiveAsk ? clampScore((medianSoldPrice / medianActiveAsk) * 100) : 0;
    const listingQualityScore = activeCount ? clampScore((includedCount / activeCount) * 100) : 0;
    const score = clampScore(
      sellThroughScore * 0.45
      + salesVelocityScore * 0.25
      + priceStrengthScore * 0.2
      + listingQualityScore * 0.1
    );
    const signal = score >= 70 ? "strong" : score >= 40 ? "steady" : "weak";

    return {
      signal,
      confidence: "medium",
      score,
      basis: "sold-history",
      soldCounts,
      medianSoldPrice,
      factors: [
        `${soldCounts.sold30} completed sales in the last 30 days drive the demand score.`,
        `Sell-through score: ${sellThroughScore}/100; sales velocity score: ${salesVelocityScore}/100.`,
        `Price strength score: ${priceStrengthScore}/100; listing quality score: ${listingQualityScore}/100.`
      ]
    };
  }

  if (!activeCount || !includedCount) {
    return {
      signal: "unknown",
      confidence: "low",
      score: 0,
      basis: "active-listing proxy",
      soldCounts,
      factors: [
        "No usable active listings passed confidence filters.",
        "Sold-history data is not connected yet."
      ]
    };
  }

  const spread = priceSpread(prices);
  const includedRatio = includedCount / activeCount;
  let score = 45;
  const factors: string[] = [
    `${includedCount} of ${activeCount} active listings passed confidence filters.`,
    "Sold-history data is not connected yet, so this is not a true sell-through demand score."
  ];

  if (includedCount >= 8) {
    score += 15;
    factors.push("There is enough active market depth to compare asking prices.");
  } else if (includedCount <= 3) {
    score -= 5;
    factors.push("Usable active supply is thin, so demand confidence is limited.");
  }

  if (includedRatio >= 0.55) {
    score += 10;
    factors.push("Most returned listings look relevant after filtering.");
  } else {
    score -= 10;
    factors.push("Many returned listings were noisy or excluded.");
  }

  if (typeof spread === "number") {
    if (spread <= 0.35) {
      score += 10;
      factors.push("Included asking prices are fairly clustered.");
    } else if (spread >= 1) {
      score -= 10;
      factors.push("Included asking prices are widely spread.");
    } else {
      factors.push("Included asking prices show moderate spread.");
    }
  }

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const signal = boundedScore >= 70 ? "strong" : boundedScore >= 45 ? "steady" : "weak";

  return {
    signal,
    confidence: "low",
    score: boundedScore,
    basis: "active-listing proxy",
    soldCounts,
    factors
  };
}

export async function analyzeMarket(params: CardSearchParams): Promise<MarketAnalysis> {
  const cards = await searchPokemonCards(params);
  const card = cards[0] ?? findMockCard(params);
  const activeListings = await getActiveListings(card, params);
  const soldListings = await getSoldListings();
  const prices = includedPrices(activeListings);
  const medianAsk = median(prices);
  const referencePrice = getReferencePrice(card);
  const lowestAsk = prices.length ? Math.min(...prices) : undefined;
  const highestAsk = prices.length ? Math.max(...prices) : undefined;
  const referenceDelta = referencePrice && medianAsk ? medianAsk - referencePrice : undefined;
  const includedListingCount = activeListings.filter((listing) => listing.includedInAnalysis).length;
  const supplySignal = includedListingCount === 0 ? "unknown" : includedListingCount <= 2 ? "low" : includedListingCount >= 8 ? "high" : "normal";
  const demandInsight = buildDemandInsight(prices, includedListingCount, activeListings.length, soldListings);
  const demandHistory = await getDemandHistory(params);

  return {
    card,
    query: params,
    providerHealth: await getProviderHealth(),
    referencePrice,
    activeListings,
    soldListings,
    metrics: {
      activeListingCount: activeListings.length,
      includedListingCount,
      medianAsk,
      lowestAsk,
      highestAsk,
      referenceDelta,
      supplySignal,
      demandSignal: demandInsight.signal,
      trend: soldListings.length ? "stable" : "insufficient data",
      confidence: demandInsight.confidence
    },
    demandInsight,
    demandHistory,
    gradeBreakdown: getGradeBreakdown(activeListings.filter((listing) => listing.includedInAnalysis)),
    summary: buildSummary(referencePrice, medianAsk, includedListingCount, activeListings.length, demandInsight)
  };
}
