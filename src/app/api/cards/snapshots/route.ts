import { NextResponse } from "next/server";
import type { CardSearchParams } from "@/types/market";
import { analyzeMarket } from "@/lib/analysis";
import { getDemandHistory, saveDemandSnapshot, snapshotFromAnalysis } from "@/lib/snapshots";

export async function POST(request: Request) {
  const query = await request.json() as CardSearchParams;
  if (!query.q || !query.mode) {
    return NextResponse.json({ message: "Card query and search mode are required." }, { status: 400 });
  }

  const analysis = await analyzeMarket(query);
  const snapshot = snapshotFromAnalysis(analysis);
  await saveDemandSnapshot(snapshot);

  return NextResponse.json({
    snapshot,
    history: await getDemandHistory(query)
  });
}
