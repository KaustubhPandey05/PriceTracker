import { NextResponse } from "next/server";
import type { CardSearchParams, SearchMode } from "@/types/market";
import { getPriceChartingProduct } from "@/lib/providers/priceCharting";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params: CardSearchParams = {
    q: searchParams.get("q") || searchParams.get("card") || "Charizard",
    set: searchParams.get("set") || undefined,
    number: searchParams.get("number") || undefined,
    variant: searchParams.get("variant") || undefined,
    condition: searchParams.get("condition") || undefined,
    grade: searchParams.get("grade") || undefined,
    mode: (searchParams.get("mode") as SearchMode) || "balanced"
  };

  return NextResponse.json(await getPriceChartingProduct(params));
}
