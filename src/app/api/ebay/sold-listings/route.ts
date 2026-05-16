import { NextResponse } from "next/server";
import { getSoldListings } from "@/lib/providers/ebay";

export async function GET() {
  return NextResponse.json({
    data: await getSoldListings(),
    status: "pending-approval",
    message: "eBay Marketplace Insights access is pending; sold-listing demand analysis is not live yet."
  });
}
