import type { CardIdentity, CardSearchParams, MarketListing } from "@/types/market";
import { env, isMockMode } from "@/lib/env";
import { makeSearchQuery, scoreListing } from "@/lib/market/search";
import { mockActiveListings } from "@/lib/providers/mock";

type TokenFailure = "missing-config" | "unauthorized" | "network" | "unknown";

interface EbayTokenResult {
  accessToken?: string;
  failure?: TokenFailure;
  status?: number;
}

interface EbayItemSummary {
  itemId: string;
  title: string;
  itemWebUrl: string;
  price?: { value: string; currency: string };
  shippingOptions?: Array<{ shippingCost?: { value: string; currency: string } }>;
  condition?: string;
}

async function requestEbayToken(): Promise<EbayTokenResult> {
  if (!env.ebayClientId || !env.ebayClientSecret) return { failure: "missing-config" };

  try {
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

    if (!response.ok) {
      return {
        failure: response.status === 401 ? "unauthorized" : "unknown",
        status: response.status
      };
    }
    const payload = await response.json() as { access_token?: string };
    return { accessToken: payload.access_token };
  } catch {
    return { failure: "network" };
  }
}

async function getEbayToken() {
  return (await requestEbayToken()).accessToken;
}

export async function checkEbayBrowseConnection() {
  if (isMockMode()) {
    return {
      status: "mocked" as const,
      detail: "Mock mode is active. Set DATA_MODE=live to query eBay Browse API."
    };
  }

  const token = await requestEbayToken();
  if (token.accessToken) {
    return {
      status: "connected" as const,
      detail: "Credentials are valid for eBay OAuth. Active listing searches can use the Browse API."
    };
  }

  if (token.failure === "missing-config") {
    return {
      status: "missing-config" as const,
      detail: "eBay credentials are missing. Mock active listings are used."
    };
  }

  if (token.failure === "unauthorized") {
    return {
      status: "error" as const,
      detail: "eBay rejected the OAuth request with 401. Check that .env.local uses the Production App ID and Cert ID for this app."
    };
  }

  return {
    status: "error" as const,
    detail: "The app could not validate eBay OAuth right now. Active listings fall back to mock data."
  };
}

function fallbackListings(card: CardIdentity | undefined, params: CardSearchParams) {
  return mockActiveListings(card, params).map((listing) => ({
    ...listing,
    reason: listing.reason.startsWith("Fallback:")
      ? listing.reason
      : `Fallback: eBay live data unavailable. ${listing.reason}`
  }));
}

export async function getActiveListings(card: CardIdentity | undefined, params: CardSearchParams): Promise<MarketListing[]> {
  if (isMockMode() || !env.ebayClientId || !env.ebayClientSecret) {
    return mockActiveListings(card, params);
  }

  const token = await getEbayToken();
  if (!token) return fallbackListings(card, params);

  const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
  url.searchParams.set("q", makeSearchQuery(params));
  url.searchParams.set("limit", "25");
  url.searchParams.set("category_ids", "183454");

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": env.ebayMarketplaceId
      },
      cache: "no-store"
    });

    if (!response.ok) return fallbackListings(card, params);
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
  } catch {
    return fallbackListings(card, params);
  }
}

export async function getSoldListings(): Promise<MarketListing[]> {
  // Marketplace Insights access is approval-gated; keep the route stable until credentials are ready.
  return [];
}
