import type { CardIdentity, CardSearchParams, MarketListing } from "@/types/market";
import { env, isMockMode } from "@/lib/env";
import { makeSearchQuery, scoreListing } from "@/lib/market/search";
import { mockActiveListings } from "@/lib/providers/mock";

interface EbayItemSummary {
  itemId: string;
  title: string;
  itemWebUrl: string;
  price?: { value: string; currency: string };
  shippingOptions?: Array<{ shippingCost?: { value: string; currency: string } }>;
  condition?: string;
}

async function getEbayToken() {
  if (!env.ebayClientId || !env.ebayClientSecret) return undefined;

  const credentials = Buffer.from(`${env.ebayClientId}:${env.ebayClientSecret}`).toString("base64");
  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope"
    }),
    cache: "no-store"
  });

  if (!response.ok) return undefined;
  const payload = await response.json() as { access_token?: string };
  return payload.access_token;
}

export async function getActiveListings(card: CardIdentity | undefined, params: CardSearchParams): Promise<MarketListing[]> {
  if (isMockMode() || !env.ebayClientId || !env.ebayClientSecret) {
    return mockActiveListings(card, params);
  }

  const token = await getEbayToken();
  if (!token) return mockActiveListings(card, params);

  const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
  url.searchParams.set("q", makeSearchQuery(params));
  url.searchParams.set("limit", "25");
  url.searchParams.set("category_ids", "183454");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": env.ebayMarketplaceId
    },
    cache: "no-store"
  });

  if (!response.ok) return mockActiveListings(card, params);
  const payload = await response.json() as { itemSummaries?: EbayItemSummary[] };

  return (payload.itemSummaries ?? []).map((item) => {
    const listing = {
      id: item.itemId,
      title: item.title,
      price: Number(item.price?.value ?? 0),
      shipping: Number(item.shippingOptions?.[0]?.shippingCost?.value ?? 0),
      currency: item.price?.currency ?? "USD",
      url: item.itemWebUrl,
      source: "ebay" as const,
      condition: item.condition
    };
    return {
      ...listing,
      ...scoreListing(listing, card, params)
    };
  });
}

export async function getSoldListings(): Promise<MarketListing[]> {
  // Marketplace Insights access is approval-gated; keep the route stable until credentials are ready.
  return [];
}
