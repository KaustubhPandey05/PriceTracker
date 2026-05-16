import { NextResponse } from "next/server";
import type { CardSearchParams, SearchMode } from "@/types/market";
import { searchPokemonCards } from "@/lib/providers/pokemonTcg";

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

  const cards = await searchPokemonCards(params);
  return NextResponse.json({ data: cards });
}
