import type { ProviderHealth } from "@/types/market";
import { env, isMockMode } from "@/lib/env";
import { checkEbayBrowseConnection } from "@/lib/providers/ebay";

export async function getProviderHealth(): Promise<ProviderHealth[]> {
  const ebayBrowse = await checkEbayBrowseConnection();

  return [
    {
      name: "Pokemon TCG API",
      status: isMockMode() ? "mocked" : "connected",
      detail: isMockMode()
        ? "Mock mode is active. Set DATA_MODE=live to query the free Pokemon TCG API."
        : env.pokemonTcgApiKey
          ? "Live mode with API key configured."
          : "Live mode without API key; public lower rate limits apply."
    },
    {
      name: "eBay Browse API",
      status: ebayBrowse.status,
      detail: ebayBrowse.detail
    },
    {
      name: "eBay Marketplace Insights",
      status: "pending-approval",
      detail: "Sold-history demand analysis is placeholder-only until eBay approval is available."
    }
  ];
}
