import type { ProviderHealth } from "@/types/market";
import { env, isMockMode } from "@/lib/env";

export function getProviderHealth(): ProviderHealth[] {
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
      status: env.ebayClientId && env.ebayClientSecret ? "connected" : "missing-config",
      detail: env.ebayClientId && env.ebayClientSecret
        ? "Credentials are present for active listing supply."
        : "Credentials pending. Mock active listings are used."
    },
    {
      name: "eBay Marketplace Insights",
      status: "pending-approval",
      detail: "Sold-history demand analysis is placeholder-only until eBay approval is available."
    },
    {
      name: "PriceCharting",
      status: env.priceChartingToken ? "disabled" : "missing-config",
      detail: env.priceChartingToken
        ? "Token present; adapter is intentionally disabled until the subscription API format is confirmed."
        : "Optional provider. Not required for the MVP."
    }
  ];
}
