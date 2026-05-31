import { NextResponse } from "next/server";
import { getSoldListings } from "@/lib/providers/ebay";

export async function GET() {
  return NextResponse.json({
    data: await getSoldListings(),
    status: "unavailable",
    message: "Confirmed sold-history data is unavailable. Listing lifecycle captures are used only for directional market pressure."
  });
}
