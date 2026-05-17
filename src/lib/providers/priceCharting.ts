import type { CardSearchParams } from "@/types/market";

export async function getPriceChartingProduct(params: CardSearchParams) {
  void params;
  return {
    enabled: false,
    message: "PriceCharting has been removed from the active MVP provider setup. Use Pokemon TCG API plus eBay Browse API instead."
  };
}
