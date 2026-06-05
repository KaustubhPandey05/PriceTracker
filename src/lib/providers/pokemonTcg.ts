import type { CardIdentity, CardPrice, CardSearchParams } from "@/types/market";
import { env, isMockMode } from "@/lib/env";
import { mockCards, searchMockCards } from "@/lib/providers/mock";

interface PokemonTcgCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  set: {
    name: string;
    series?: string;
  };
  images?: {
    small?: string;
    large?: string;
  };
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: Record<string, { low?: number; mid?: number; high?: number; market?: number; directLow?: number }>;
  };
  cardmarket?: {
    url?: string;
    updatedAt?: string;
    prices?: {
      averageSellPrice?: number;
      lowPrice?: number;
      trendPrice?: number;
    };
  };
}

interface PokemonTcgSet {
  id: string;
  name: string;
  series?: string;
}

function mapCard(card: PokemonTcgCard): CardIdentity {
  const prices: CardPrice[] = [];
  Object.entries(card.tcgplayer?.prices ?? {}).forEach(([variant, price]) => {
    prices.push({
      source: "Pokemon TCG API / TCGplayer",
      variant,
      low: price.low,
      mid: price.mid,
      high: price.high,
      market: price.market,
      currency: "USD",
      updatedAt: card.tcgplayer?.updatedAt
    });
  });
  if (card.cardmarket?.prices) {
    prices.push({
      source: "Pokemon TCG API / Cardmarket",
      variant: "cardmarket",
      low: card.cardmarket.prices.lowPrice,
      mid: card.cardmarket.prices.averageSellPrice,
      market: card.cardmarket.prices.trendPrice,
      currency: "EUR",
      updatedAt: card.cardmarket.updatedAt
    });
  }

  return {
    id: card.id,
    name: card.name,
    setName: card.set.name,
    setSeries: card.set.series,
    number: card.number,
    rarity: card.rarity,
    imageUrl: card.images?.large ?? card.images?.small,
    tcgplayerUrl: card.tcgplayer?.url,
    cardmarketUrl: card.cardmarket?.url,
    prices
  };
}

function buildPokemonQuery(params: CardSearchParams) {
  const parts = [`name:"${params.q.replace(/"/g, "")}*"`];
  if (params.set) parts.push(`set.name:"${params.set.replace(/"/g, "")}"`);
  if (params.number) parts.push(`number:"${params.number.replace(/"/g, "")}"`);
  return parts.join(" ");
}

export async function searchPokemonCards(params: CardSearchParams): Promise<CardIdentity[]> {
  if (isMockMode()) return searchMockCards(params);

  const url = new URL("https://api.pokemontcg.io/v2/cards");
  url.searchParams.set("q", buildPokemonQuery(params));
  url.searchParams.set("pageSize", "12");
  url.searchParams.set("select", "id,name,number,rarity,set,images,tcgplayer,cardmarket");

  try {
    const response = await fetch(url, {
      headers: env.pokemonTcgApiKey ? { "X-Api-Key": env.pokemonTcgApiKey } : {},
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      return mockCards;
    }

    const payload = await response.json() as { data?: PokemonTcgCard[] };
    return (payload.data ?? []).map(mapCard);
  } catch {
    return mockCards;
  }
}

export async function searchPokemonCardNames(prefix: string): Promise<string[]> {
  const query = prefix.trim();
  if (!query) return [];
  if (isMockMode()) {
    return [...new Set(searchMockCards({ q: query, mode: "loose" }).map((card) => card.name))];
  }

  const url = new URL("https://api.pokemontcg.io/v2/cards");
  url.searchParams.set("q", `name:"${query.replace(/"/g, "")}*"`);
  url.searchParams.set("pageSize", "20");
  url.searchParams.set("select", "name");

  try {
    const response = await fetch(url, {
      headers: env.pokemonTcgApiKey ? { "X-Api-Key": env.pokemonTcgApiKey } : {},
      next: { revalidate: 3600 }
    });
    if (!response.ok) return [];
    const payload = await response.json() as { data?: Array<{ name: string }> };
    return [...new Set((payload.data ?? []).map((card) => card.name))];
  } catch {
    return [];
  }
}

export async function searchPokemonSetNames(prefix: string): Promise<string[]> {
  const query = prefix.trim().toLowerCase();
  if (isMockMode()) {
    return [...new Set(mockCards.map((card) => card.setName))]
      .filter((setName) => setName.toLowerCase().includes(query));
  }

  const url = new URL("https://api.pokemontcg.io/v2/sets");
  url.searchParams.set("pageSize", "250");
  url.searchParams.set("select", "id,name,series");

  try {
    const response = await fetch(url, {
      headers: env.pokemonTcgApiKey ? { "X-Api-Key": env.pokemonTcgApiKey } : {},
      next: { revalidate: 86400 }
    });
    if (!response.ok) return [];
    const payload = await response.json() as { data?: PokemonTcgSet[] };
    return [...new Set((payload.data ?? [])
      .map((set) => set.name)
      .filter((name) => name.toLowerCase().includes(query)))];
  } catch {
    return [];
  }
}
