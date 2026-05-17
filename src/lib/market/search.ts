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

const variantConflictTerms = [
  { term: "celebrations", label: "Celebrations" },
  { term: "classic collection", label: "Classic Collection" },
  { term: "shadowless", label: "Shadowless", allowWhenTitleIncludes: ["non-shadowless"] },
  { term: "1st edition", label: "1st Edition" },
  { term: "first edition", label: "1st Edition" },
  { term: "auto", label: "Autograph" },
  { term: "autograph", label: "Autograph" },
  { term: "signed", label: "Signed" },
  { term: "signature", label: "Signed" },
  { term: "chinese", label: "Chinese language" },
  { term: "japanese", label: "Japanese language" },
  { term: "italian", label: "Italian language" },
  { term: " ita ", label: "Italian language" },
  { term: "german", label: "German language" },
  { term: "spanish", label: "Spanish language" },
  { term: "french", label: "French language" },
  { term: "korean", label: "Korean language" }
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

function requestedAllowsConflict(term: string, query: CardSearchParams) {
  const requested = normalize([query.q, query.set, query.number, query.variant, query.condition, query.grade].filter(Boolean).join(" "));
  return requested.includes(normalize(term));
}

function findVariantConflicts(title: string, query: CardSearchParams) {
  const paddedTitle = ` ${title} `;
  const conflicts = variantConflictTerms
    .filter((conflict) => {
      const allowedByTitle = conflict.allowWhenTitleIncludes?.some((allowed) => paddedTitle.includes(normalize(allowed)));
      return !allowedByTitle && paddedTitle.includes(normalize(conflict.term)) && !requestedAllowsConflict(conflict.term, query);
    })
    .map((conflict) => conflict.label);

  return [...new Set(conflicts)];
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

  const variantConflicts = findVariantConflicts(title, query);
  if (variantConflicts.length) {
    return {
      confidence: "low",
      includedInAnalysis: false,
      reason: `Excluded: variant conflict (${variantConflicts.join(", ")})`
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
  const missingRequestedNumber = Boolean(number && !title.includes(normalize(number)));
  const includedInAnalysis = score >= strictThreshold && confidence !== "low" && !(query.mode !== "loose" && confidence === "medium" && missingRequestedNumber);

  return {
    confidence,
    includedInAnalysis,
    reason: !includedInAnalysis && confidence === "medium" && missingRequestedNumber
      ? `Excluded: missing requested card number (${reasons.join(", ")})`
      : reasons.length ? reasons.join(", ") : "Low title similarity"
  };
}

export function makeSearchQuery(params: CardSearchParams) {
  return [params.q, params.set, params.number, params.variant, params.grade, params.condition]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
