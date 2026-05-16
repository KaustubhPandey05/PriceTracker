import { NextResponse } from "next/server";
import { getMarketOverview } from "@/lib/overview";

export async function GET() {
  return NextResponse.json(await getMarketOverview());
}
