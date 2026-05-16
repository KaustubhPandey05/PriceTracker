import { NextResponse } from "next/server";
import type { CardSearchParams, SearchMode } from "@/types/market";
import { analyzeMarket } from "@/lib/analysis";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params: CardSearchParams = {
    q: searchParams.get("q") || "Charizard",
    set: searchParams.get("set") || undefined,
    number: searchParams.get("number") || undefined,
    variant: searchParams.get("variant") || undefined,
    condition: searchParams.get("condition") || undefined,
    grade: searchParams.get("grade") || undefined,
    mode: (searchParams.get("mode") as SearchMode) || "balanced"
  };

  const analysis = await analyzeMarket(params);
  return NextResponse.json(analysis);
}
