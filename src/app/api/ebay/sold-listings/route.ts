import { NextResponse } from "next/server";
import { getSoldListings } from "@/lib/providers/ebay";

export async function GET() {
  return NextResponse.json({
    data: await getSoldListings(),
    status: "unavailable",
    message: "Sold-history data is not connected. eBay Marketplace Insights is restricted and not open to new users."
  });
}
