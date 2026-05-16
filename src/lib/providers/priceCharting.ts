import type { CardSearchParams } from "@/types/market";
import { env } from "@/lib/env";

export async function getPriceChartingProduct(params: CardSearchParams) {
  void params;
  if (!env.priceChartingToken) {
    return {
      enabled: false,
      message: "PriceCharting token is not configured. This provider is optional for the MVP."
    };
  }

  return {
    enabled: false,
    message: "PriceCharting adapter placeholder is ready; endpoint wiring can be enabled after confirming your subscription API format."
  };
}
