import type { CardIdentity, CardSearchParams, MarketListing } from "@/types/market";
import { scoreListing } from "@/lib/market/search";

export const mockCards: CardIdentity[] = [
  {
    id: "base1-4",
    name: "Charizard",
    setName: "Base Set",
    setSeries: "Base",
    number: "4/102",
    rarity: "Rare Holo",
    imageUrl: "https://images.pokemontcg.io/base1/4_hires.png",
    tcgplayerUrl: "https://prices.pokemontcg.io/tcgplayer/base1-4",
    prices: [
      { source: "Pokemon TCG API", variant: "holofoil", low: 199.99, mid: 349.99, high: 799.99, market: 392.44, currency: "USD" }
    ]
  },
  {
    id: "swsh7-215",
    name: "Umbreon VMAX",
    setName: "Evolving Skies",
    setSeries: "Sword & Shield",
    number: "215/203",
    rarity: "Rare Rainbow",
    imageUrl: "https://images.pokemontcg.io/swsh7/215_hires.png",
    tcgplayerUrl: "https://prices.pokemontcg.io/tcgplayer/swsh7-215",
    prices: [
      { source: "Pokemon TCG API", variant: "holofoil", low: 24, mid: 38, high: 89, market: 42.12, currency: "USD" }
    ]
  },
  {
    id: "neo1-9",
    name: "Lugia",
    setName: "Neo Genesis",
    setSeries: "Neo",
    number: "9/111",
    rarity: "Rare Holo",
    imageUrl: "https://images.pokemontcg.io/neo1/9_hires.png",
    prices: [
      { source: "Pokemon TCG API", variant: "holofoil", low: 158, mid: 245, high: 520, market: 274.5, currency: "USD" }
    ]
  }
];

const baseListings: Array<Omit<MarketListing, "confidence" | "includedInAnalysis" | "reason">> = [
  {
    id: "mock-1",
    title: "1999 Pokemon Base Set Charizard 4/102 Holo PSA 9",
    price: 1180,
    shipping: 0,
    currency: "USD",
    url: "https://www.ebay.com/",
    source: "mock-ebay",
    grade: "PSA 9"
  },
  {
    id: "mock-2",
    title: "Pokemon TCG Charizard Base Set 4/102 Holo MP Raw",
    price: 315,
    shipping: 5.25,
    currency: "USD",
    url: "https://www.ebay.com/",
    source: "mock-ebay",
    condition: "MP"
  },
  {
    id: "mock-3",
    title: "Charizard Base Set 2 4/130 Holo PSA 9",
    price: 455,
    shipping: 0,
    currency: "USD",
    url: "https://www.ebay.com/",
    source: "mock-ebay",
    grade: "PSA 9"
  },
  {
    id: "mock-4",
    title: "Pokemon Charizard Proxy Custom Metal Card",
    price: 12,
    shipping: 3,
    currency: "USD",
    url: "https://www.ebay.com/",
    source: "mock-ebay"
  },
  {
    id: "mock-5",
    title: "Umbreon VMAX Evolving Skies 215/203 Secret Rare PSA 10",
    price: 670,
    shipping: 0,
    currency: "USD",
    url: "https://www.ebay.com/",
    source: "mock-ebay",
    grade: "PSA 10"
  },
  {
    id: "mock-6",
    title: "Lugia Neo Genesis 9/111 Holo Rare Pokemon Card LP",
    price: 240,
    shipping: 4.99,
    currency: "USD",
    url: "https://www.ebay.com/",
    source: "mock-ebay",
    condition: "LP"
  }
];

export function findMockCard(params: CardSearchParams) {
  const query = params.q.toLowerCase();
  return mockCards.find((card) => {
    const text = `${card.name} ${card.setName} ${card.number}`.toLowerCase();
    return text.includes(query) || query.includes(card.name.toLowerCase());
  }) ?? mockCards[0];
}

export function searchMockCards(params: CardSearchParams) {
  const query = params.q.toLowerCase();
  return mockCards.filter((card) => {
    const text = `${card.name} ${card.setName} ${card.number}`.toLowerCase();
    return !query || text.includes(query) || query.includes(card.name.toLowerCase());
  });
}

export function mockActiveListings(card: CardIdentity | undefined, params: CardSearchParams): MarketListing[] {
  return baseListings.map((listing) => ({
    ...listing,
    ...scoreListing(listing, card, params)
  }));
}
