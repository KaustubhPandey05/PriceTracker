import { NextResponse } from "next/server";
import type { CardSearchParams, SearchMode } from "@/types/market";
import { getActiveListings } from "@/lib/providers/ebay";
import { findMockCard } from "@/lib/providers/mock";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params: CardSearchParams = {
    q: searchParams.get("card") || searchParams.get("q") || "Charizard",
    set: searchParams.get("set") || undefined,
    number: searchParams.get("number") || undefined,
    variant: searchParams.get("variant") || undefined,
    condition: searchParams.get("condition") || undefined,
    grade: searchParams.get("grade") || undefined,
    mode: (searchParams.get("mode") as SearchMode) || "balanced"
  };

  return NextResponse.json({ data: await getActiveListings(findMockCard(params), params) });
}
