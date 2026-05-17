import { NextResponse } from "next/server";
import { getProviderHealth } from "@/lib/providers/health";

export async function GET() {
  return NextResponse.json({ data: await getProviderHealth() });
}
