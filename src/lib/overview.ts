import type { CardIdentity, CardSearchParams, LeaderboardRow, MarketListing, MarketOverview } from "@/types/market";
import { includedPrices, median, money } from "@/lib/market/math";
import { getActiveListings } from "@/lib/providers/ebay";
import { mockCards } from "@/lib/providers/mock";
import { searchPokemonCards } from "@/lib/providers/pokemonTcg";
import { getTrackedSeriesSummaries } from "@/lib/observations";
import { getPresetMarketHistories } from "@/lib/marketHistory";

function referencePrice(card: CardIdentity) {
  return card.prices.find((price) => typeof price.market === "number")?.market
    ?? card.prices.find((price) => typeof price.mid === "number")?.mid
    ?? 0;
}

function paramsForCard(card: CardIdentity): CardSearchParams {
  return {
    q: card.name,
    set: card.setName,
    number: card.number,
    variant: card.rarity?.toLowerCase().includes("holo") ? "holo" : undefined,
    mode: "balanced"
  };
}

async function overviewCards() {
  const cards = await Promise.all(
    mockCards.map(async (card) => {
      const results = await searchPokemonCards(paramsForCard(card));
      return results[0] ?? card;
    })
  );
  return cards.length ? cards : mockCards;
}

function cardRow(card: CardIdentity, primaryValue: number, badge: string, note: string, secondaryValue?: number): LeaderboardRow {
  return {
    id: card.id,
    cardName: card.name,
    setName: card.setName,
    number: card.number,
    imageUrl: card.imageUrl,
    primaryValue,
    secondaryValue,
    badge,
    note
  };
}

function includedMedian(listings: MarketListing[]) {
  return median(includedPrices(listings)) ?? 0;
}

export async function getMarketOverview(): Promise<MarketOverview> {
  const cards = await overviewCards();
  const trackedSeries = await getTrackedSeriesSummaries();
  const trackedHistory = await getPresetMarketHistories();
  const listingPairs = await Promise.all(cards.map(async (card) => ({
    card,
    listings: await getActiveListings(card, paramsForCard(card))
  })));

  const highestValueCards = [...cards]
    .sort((a, b) => referencePrice(b) - referencePrice(a))
    .map((card) => cardRow(card, referencePrice(card), "Reference value", `${card.setName} #${card.number}`));

  const valueGapCards = listingPairs
    .map(({ card, listings }) => {
      const ref = referencePrice(card);
      const ask = includedMedian(listings);
      return {
        card,
        ask,
        gap: ref ? ask - ref : 0
      };
    })
    .filter((item) => item.ask > 0)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .map((item) => cardRow(
      item.card,
      item.gap,
      item.gap >= 0 ? "Above reference" : "Below reference",
      `Median active ask is ${money(Math.abs(item.gap))} ${item.gap >= 0 ? "above" : "below"} reference.`,
      item.ask
    ));

  const tightSupplyCards = listingPairs
    .map(({ card, listings }) => {
      const included = listings.filter((listing) => listing.includedInAnalysis).length;
      return { card, included };
    })
    .sort((a, b) => a.included - b.included)
    .map((item) => cardRow(item.card, item.included, "Included listings", `${item.card.name} has ${item.included} high/medium confidence active listings.`));

  const noisyListings = listingPairs
    .flatMap(({ listings }) => listings)
    .filter((listing) => !listing.includedInAnalysis)
    .slice(0, 8)
    .map((listing) => ({
      id: listing.id,
      title: listing.title,
      price: listing.price + (listing.shipping ?? 0),
      reason: listing.reason,
      url: listing.url
    }));

  const totalReference = cards.reduce((sum, card) => sum + referencePrice(card), 0);
  const includedListingCount = listingPairs.reduce((sum, item) => sum + item.listings.filter((listing) => listing.includedInAnalysis).length, 0);

  return {
    generatedAt: new Date().toISOString(),
    metrics: [
      {
        label: "Tracked cards",
        value: String(cards.length),
        detail: "Seeded from current provider coverage."
      },
      {
        label: "Total reference value",
        value: money(totalReference),
        detail: "Sum of available Pokemon TCG reference prices."
      },
      {
        label: "Included supply",
        value: String(includedListingCount),
        detail: "Active listings that passed confidence filters."
      },
      {
        label: "Tracked series",
        value: String(trackedSeries.length),
        detail: "Daily raw near-mint and PSA 9 observation series."
      }
    ],
    highestValueCards,
    valueGapCards,
    tightSupplyCards,
    noisyListings,
    trackedSeries,
    trackedHistory,
    explainers: {
      referenceValue: "Reference value comes from the current Pokemon TCG provider price when available.",
      valueGap: "Value gap compares median active asking price with the reference value. It is not a buy recommendation.",
      tightSupply: "Tight supply counts active listings that passed confidence filters. Lower counts can mean scarcity or limited data.",
      noisyListings: "Noisy listings were found but excluded from calculations because the title looked mismatched or low confidence.",
      lifecycle: "eBay listings are observed over time for directional pressure only. An unavailable listing is not a confirmed sale."
    }
  };
}
