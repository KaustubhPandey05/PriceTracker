import type { CardIdentity, CardSearchParams, MarketAnalysis, MarketListing } from "@/types/market";
import { includedPrices, median } from "@/lib/market/math";
import { getActiveListings, getSoldListings } from "@/lib/providers/ebay";
import { getProviderHealth } from "@/lib/providers/health";
import { findMockCard } from "@/lib/providers/mock";
import { searchPokemonCards } from "@/lib/providers/pokemonTcg";

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

function buildSummary(referencePrice: number | undefined, medianAsk: number | undefined, includedCount: number, activeCount: number) {
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
  summary.push("Demand scoring is limited until eBay sold-history access is approved.");
  return summary;
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
      demandSignal: "pending",
      trend: soldListings.length ? "stable" : "insufficient data",
      confidence: soldListings.length ? "medium" : includedListingCount ? "medium" : "low"
    },
    gradeBreakdown: getGradeBreakdown(activeListings.filter((listing) => listing.includedInAnalysis)),
    summary: buildSummary(referencePrice, medianAsk, includedListingCount, activeListings.length)
  };
}
