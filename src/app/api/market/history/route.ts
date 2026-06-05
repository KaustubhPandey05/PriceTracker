import { NextResponse } from "next/server";
import type { CardSearchParams, SearchMode } from "@/types/market";
import { getMarketHistory, getMarketHistoryForKey, getPresetMarketHistories } from "@/lib/marketHistory";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("preset") === "true") {
    return NextResponse.json({ data: await getPresetMarketHistories() });
  }

  const key = searchParams.get("key");
  if (key) {
    return NextResponse.json(await getMarketHistoryForKey(key));
  }

  const params: CardSearchParams = {
    q: searchParams.get("q") || "Charizard",
    set: searchParams.get("set") || undefined,
    number: searchParams.get("number") || undefined,
    variant: searchParams.get("variant") || undefined,
    condition: searchParams.get("condition") || undefined,
    grade: searchParams.get("grade") || undefined,
    mode: (searchParams.get("mode") as SearchMode) || "balanced"
  };

  return NextResponse.json(await getMarketHistory(params));
}
