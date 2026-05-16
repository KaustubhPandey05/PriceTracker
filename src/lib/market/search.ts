import type { CardIdentity, CardSearchParams, ListingConfidence, MarketListing } from "@/types/market";

const blockedTerms = [
  "proxy",
  "custom",
  "digital",
  "orica",
  "metal",
  "jumbo",
  "oversized",
  "lot",
  "bundle",
  "booster",
  "pack",
  "box",
  "sealed"
];

function normalize(value?: string) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesToken(haystack: string, needle?: string) {
  const normalizedNeedle = normalize(needle);
  return !normalizedNeedle || haystack.includes(normalizedNeedle);
}

function extractGrade(text: string) {
  const match = text.match(/\b(psa|cgc|bgs)\s*(10|9\.5|9|8\.5|8|7\.5|7|6|5|4|3|2|1)\b/i);
  return match ? `${match[1].toUpperCase()} ${match[2]}` : undefined;
}

export function scoreListing(listing: Omit<MarketListing, "confidence" | "includedInAnalysis" | "reason">, card: CardIdentity | undefined, query: CardSearchParams): Pick<MarketListing, "confidence" | "includedInAnalysis" | "reason"> {
  const title = normalize(listing.title);
  const reasons: string[] = [];
  const blockers = blockedTerms.filter((term) => title.includes(term));

  if (blockers.length) {
    return {
      confidence: "low",
      includedInAnalysis: false,
      reason: `Excluded: title contains ${blockers.join(", ")}`
    };
  }

  const requestedGrade = normalize(query.grade);
  const listingGrade = normalize(extractGrade(listing.title) ?? listing.grade);
  if (requestedGrade && listingGrade && requestedGrade !== listingGrade) {
    return {
      confidence: "low",
      includedInAnalysis: false,
      reason: `Excluded: requested ${query.grade}, listing appears to be ${listingGrade.toUpperCase()}`
    };
  }

  let score = 0;
  const name = card?.name ?? query.q;
  const setName = card?.setName ?? query.set;
  const number = card?.number ?? query.number;

  if (includesToken(title, name)) {
    score += 3;
    reasons.push("name match");
  }
  if (includesToken(title, setName)) {
    score += 2;
    reasons.push("set match");
  }
  if (number && title.includes(normalize(number))) {
    score += 2;
    reasons.push("number match");
  }
  if (query.variant && includesToken(title, query.variant)) {
    score += 1;
    reasons.push("variant match");
  }
  if (requestedGrade && listingGrade === requestedGrade) {
    score += 2;
    reasons.push("grade match");
  }
  if (query.condition && includesToken(title, query.condition)) {
    score += 1;
    reasons.push("condition match");
  }

  const strictThreshold = query.mode === "strict" ? 7 : query.mode === "loose" ? 3 : 5;
  const confidence: ListingConfidence = score >= 7 ? "high" : score >= 4 ? "medium" : "low";
  const includedInAnalysis = score >= strictThreshold && confidence !== "low";

  return {
    confidence,
    includedInAnalysis,
    reason: reasons.length ? reasons.join(", ") : "Low title similarity"
  };
}

export function makeSearchQuery(params: CardSearchParams) {
  return [params.q, params.set, params.number, params.variant, params.grade, params.condition]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
