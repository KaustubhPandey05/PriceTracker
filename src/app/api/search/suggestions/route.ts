import { NextResponse } from "next/server";
import { getSearchSuggestions } from "@/lib/searchSuggestions";

const fields = new Set(["card", "set", "variant"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const field = searchParams.get("field") ?? "";
  const q = searchParams.get("q") ?? "";

  if (!fields.has(field)) {
    return NextResponse.json({ message: "field must be card, set, or variant." }, { status: 400 });
  }

  return NextResponse.json({
    data: await getSearchSuggestions(field as "card" | "set" | "variant", q)
  });
}
