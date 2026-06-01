import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { median } from "@/lib/market/math";
import { checkListingAvailability } from "@/lib/providers/ebay";
import { queryKey } from "@/lib/snapshots";
import type {
  CardSearchParams,
  ListingCapture,
  ListingObservation,
  ListingTrendSignal,
  MarketAnalysis,
  MarketListing,
  TrackedSeriesSummary,
  TrackingSeries
} from "@/types/market";

const dataDirectory = path.join(process.cwd(), ".local-data");
const observationFile = path.join(dataDirectory, "listing-observations.json");
const INDIA_TIMEZONE = "Asia/Kolkata";

interface ObservationStore {
  observations: ListingObservation[];
  captures: ListingCapture[];
}

export const PRESET_TRACKING_SERIES: TrackingSeries[] = [
  presetSeries("Charizard", "Base Set", "4/102", "raw-near-mint-proxy"),
  presetSeries("Charizard", "Base Set", "4/102", "psa-9"),
  presetSeries("Umbreon VMAX", "Evolving Skies", "215/203", "raw-near-mint-proxy"),
  presetSeries("Umbreon VMAX", "Evolving Skies", "215/203", "psa-9"),
  presetSeries("Lugia", "Neo Genesis", "9/111", "raw-near-mint-proxy"),
  presetSeries("Lugia", "Neo Genesis", "9/111", "psa-9")
];

function presetSeries(q: string, set: string, number: string, kind: "raw-near-mint-proxy" | "psa-9"): TrackingSeries {
  const query: CardSearchParams = kind === "psa-9"
    ? { q, set, number, grade: "PSA 9", mode: "balanced" }
    : { q, set, number, condition: "Near Mint", variant: "raw", mode: "balanced" };
  const label = kind === "psa-9" ? "PSA 9" : "Raw Near Mint Proxy";
  return {
    key: queryKey(query),
    name: `${q} - ${set} - ${number} - ${label}`,
    kind,
    query
  };
}

export function indiaDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export async function readObservationStore(): Promise<ObservationStore> {
  try {
    const parsed = JSON.parse(await readFile(observationFile, "utf8")) as Partial<ObservationStore>;
    return {
      observations: Array.isArray(parsed.observations) ? parsed.observations : [],
      captures: Array.isArray(parsed.captures) ? parsed.captures : []
    };
  } catch {
    return { observations: [], captures: [] };
  }
}

async function saveStore(store: ObservationStore) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(observationFile, JSON.stringify(store, null, 2), "utf8");
}

function totalAsk(listing: Pick<MarketListing, "price" | "shipping">) {
  return listing.price + (listing.shipping ?? 0);
}

function cap(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function notEnoughHistory(): ListingTrendSignal {
  return {
    label: "Not enough history",
    confidence: "low",
    factors: ["Collect at least two captures on separate days to calculate observed market pressure."],
    newListings: 0,
    unavailableListings: 0,
    priceIncreases: 0,
    priceCuts: 0,
    activeSupplyChange: 0
  };
}

function average(values: number[]) {
  if (!values.length) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function unsoldShare(capture: ListingCapture) {
  const active = capture.includedListingIds.length;
  const cohort = active + capture.unavailableListings;
  return cohort > 0 ? active / cohort : undefined;
}

function calculateSaturationShift(current: ListingCapture, captures: ListingCapture[]) {
  const latestTime = new Date(current.capturedAt).getTime();
  const day = 24 * 60 * 60 * 1000;
  const datedCaptures = [...captures, current].filter((capture) => capture.seriesKey === current.seriesKey);
  const inWindow = (days: number) => datedCaptures.filter((capture) => {
    const capturedTime = new Date(capture.capturedAt).getTime();
    return latestTime - capturedTime <= days * day;
  });
  const avgUnsoldShare = (items: ListingCapture[]) => average(
    items.map(unsoldShare).filter((value): value is number => typeof value === "number")
  );
  const last7 = inWindow(7);
  const last30 = inWindow(30);
  if (last7.length < 2 || last30.length < 4) return undefined;
  const sevenDayShare = avgUnsoldShare(last7);
  const thirtyDayShare = avgUnsoldShare(last30);
  if (!sevenDayShare || !thirtyDayShare) return undefined;
  return sevenDayShare / thirtyDayShare;
}

function calculateTrend(
  current: ListingCapture,
  prior: ListingCapture | undefined,
  dailyCaptureCount: number,
  seriesCaptures: ListingCapture[]
): ListingTrendSignal {
  if (!prior || prior.dayKey === current.dayKey || !prior.includedListingIds.length) return notEnoughHistory();

  const priorCount = prior.includedListingIds.length;
  const disappearanceRate = current.unavailableListings / priorCount;
  const demandPressureProxy = current.demandPressureProxy ?? 0;
  const supplySaturationShift = current.supplySaturationShift ?? calculateSaturationShift(current, seriesCaptures);
  const saturationSignal = typeof supplySaturationShift === "number" ? cap(1 - supplySaturationShift, -1, 1) : 0;
  const newSupplyRate = current.newListings / priorCount;
  const netFlow = cap(disappearanceRate - newSupplyRate, -1, 1);
  const medianAskChange = prior.medianActiveAsk && current.medianActiveAsk
    ? (current.medianActiveAsk - prior.medianActiveAsk) / prior.medianActiveAsk
    : undefined;
  const askMovement = typeof medianAskChange === "number" ? cap(medianAskChange / 0.5, -1, 1) : 0;
  const continuingCount = Math.max(1, current.includedListingIds.length - current.newListings);
  const repricingDirection = cap((current.priceIncreases - current.priceCuts) / continuingCount, -1, 1);
  const directionalIndex = cap(
    0.35 * cap(demandPressureProxy / 0.35, 0, 1)
    + 0.25 * netFlow
    + 0.2 * askMovement
    + 0.1 * repricingDirection,
    -1,
    1
  ) + cap(0.1 * saturationSignal, -0.1, 0.1);
  const normalizedIndex = cap(
    directionalIndex,
    -1,
    1
  );
  const score = Math.round(50 + normalizedIndex * 50);
  const label = score >= 60 ? "Strengthening" : score <= 40 ? "Cooling" : "Stable";

  return {
    label,
    confidence: dailyCaptureCount >= 7 ? "medium" : "low",
    score,
    newListings: current.newListings,
    unavailableListings: current.unavailableListings,
    priceIncreases: current.priceIncreases,
    priceCuts: current.priceCuts,
    activeSupplyChange: current.includedListingIds.length - prior.includedListingIds.length,
    medianAskChange,
    demandPressureProxy,
    supplySaturationShift,
    factors: [
      `Demand pressure proxy is ${(demandPressureProxy * 100).toFixed(1)}%: unavailable previously tracked listings divided by the current active-plus-unavailable observation cohort. This is not confirmed sold data.`,
      typeof supplySaturationShift === "number"
        ? `Supply saturation shift is ${supplySaturationShift.toFixed(2)}x: 7-day unsold share compared with the 30-day baseline. Values above 1.00 mean the unsold share is rising.`
        : "Supply saturation shift needs more 7-day and 30-day capture history before it can be calculated.",
      `${current.newListings} new included listings appeared and active tracked supply changed by ${current.includedListingIds.length - prior.includedListingIds.length}.`,
      typeof medianAskChange === "number"
        ? `Median active ask moved ${(medianAskChange * 100).toFixed(1)}% from the prior daily capture.`
        : "Median active ask movement is unavailable for this comparison.",
      `${current.priceIncreases} tracked listings increased price and ${current.priceCuts} cut price.`
    ]
  };
}

function priorDifferentDay(captures: ListingCapture[], seriesKey: string, dayKey: string) {
  return [...captures]
    .filter((capture) => capture.seriesKey === seriesKey && capture.dayKey !== dayKey)
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
}

function latestCapture(captures: ListingCapture[], seriesKey: string) {
  return [...captures]
    .filter((capture) => capture.seriesKey === seriesKey)
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
}

function updateObservation(
  existing: ListingObservation | undefined,
  seriesKey: string,
  listing: MarketListing,
  capturedAt: string,
  status: ListingObservation["status"]
) {
  const amount = totalAsk(listing);
  const priceHistory = existing?.priceHistory ?? [];
  if (!priceHistory.length || priceHistory[priceHistory.length - 1].totalAsk !== amount) {
    priceHistory.push({ observedAt: capturedAt, totalAsk: amount });
  }

  return {
    seriesKey,
    listingId: listing.id,
    title: listing.title,
    url: listing.url,
    imageUrl: listing.imageUrl,
    currency: listing.currency,
    condition: listing.condition,
    grade: listing.grade,
    confidence: listing.confidence,
    includedInAnalysis: listing.includedInAnalysis,
    reason: listing.reason,
    firstSeenAt: existing?.firstSeenAt ?? capturedAt,
    lastCheckedAt: capturedAt,
    unavailableAt: undefined,
    status,
    priceHistory
  } satisfies ListingObservation;
}

export async function captureListingObservations(analysis: MarketAnalysis, series?: TrackingSeries): Promise<ListingCapture> {
  const store = await readObservationStore();
  const capturedAt = new Date().toISOString();
  const dayKey = indiaDayKey();
  const seriesKey = series?.key ?? queryKey(analysis.query);
  const seriesName = series?.name ?? `Manual: ${analysis.card?.name ?? analysis.query.q}`;
  const seriesKind = series?.kind ?? "manual";
  const previous = priorDifferentDay(store.captures, seriesKey, dayKey);
  const existingById = new Map(
    store.observations.filter((observation) => observation.seriesKey === seriesKey)
      .map((observation) => [observation.listingId, observation])
  );
  const currentById = new Map(analysis.activeListings.map((listing) => [listing.id, listing]));
  const persisted = new Map(existingById);

  let newListings = 0;
  let unavailableListings = 0;
  let priceIncreases = 0;
  let priceCuts = 0;

  for (const listing of analysis.activeListings) {
    const existing = existingById.get(listing.id);
    const priorPrice = existing?.priceHistory[existing.priceHistory.length - 1]?.totalAsk;
    const repriced = typeof priorPrice === "number" && priorPrice !== totalAsk(listing);
    const status = !existing ? "new" : repriced ? "repriced" : "continuing";
    if (listing.includedInAnalysis && (!previous || !previous.includedListingIds.includes(listing.id))) newListings += 1;
    if (listing.includedInAnalysis && repriced && typeof priorPrice === "number") {
      if (totalAsk(listing) > priorPrice) priceIncreases += 1;
      if (totalAsk(listing) < priorPrice) priceCuts += 1;
    }
    persisted.set(listing.id, updateObservation(existing, seriesKey, listing, capturedAt, status));
  }

  const trackedIncluded = new Set(
    analysis.activeListings.filter((listing) => listing.includedInAnalysis).map((listing) => listing.id)
  );
  if (previous) {
    for (const id of previous.includedListingIds) {
      if (currentById.has(id)) continue;
      const availability = await checkListingAvailability(id, analysis.card, analysis.query);
      const existing = existingById.get(id);
      if (availability.status === "active" && availability.listing.includedInAnalysis) {
        const rechecked = availability.listing;
        const priorPrice = existing?.priceHistory[existing.priceHistory.length - 1]?.totalAsk;
        const repriced = typeof priorPrice === "number" && priorPrice !== totalAsk(rechecked);
        if (repriced && typeof priorPrice === "number") {
          if (totalAsk(rechecked) > priorPrice) priceIncreases += 1;
          if (totalAsk(rechecked) < priorPrice) priceCuts += 1;
        }
        trackedIncluded.add(id);
        persisted.set(id, updateObservation(existing, seriesKey, rechecked, capturedAt, repriced ? "repriced" : "continuing"));
      } else if (availability.status === "unavailable" && existing) {
        unavailableListings += 1;
        persisted.set(id, {
          ...existing,
          lastCheckedAt: capturedAt,
          unavailableAt: capturedAt,
          status: "unavailable"
        });
      } else if (availability.status === "unknown" && existing) {
        trackedIncluded.add(id);
        persisted.set(id, { ...existing, lastCheckedAt: capturedAt, status: "continuing" });
      }
    }
  }

  const includedListings = [...trackedIncluded]
    .map((id) => persisted.get(id))
    .filter((observation): observation is ListingObservation => Boolean(observation && observation.status !== "unavailable"));
  const activePrices = includedListings
    .map((observation) => observation.priceHistory[observation.priceHistory.length - 1]?.totalAsk)
    .filter((price): price is number => typeof price === "number");
  const capture: ListingCapture = {
    id: crypto.randomUUID(),
    seriesKey,
    seriesName,
    seriesKind,
    query: analysis.query,
    capturedAt,
    dayKey,
    activeListingCount: analysis.activeListings.length,
    includedListingIds: includedListings.map((observation) => observation.listingId),
    medianActiveAsk: median(activePrices),
    referencePrice: analysis.referencePrice,
    referenceSource: analysis.card?.prices.find((price) => typeof price.market === "number")?.source
      ?? analysis.card?.prices.find((price) => typeof price.mid === "number")?.source,
    newListings,
    unavailableListings,
    priceIncreases,
    priceCuts,
    demandPressureProxy: undefined,
    unsoldShare: undefined,
    supplySaturationShift: undefined,
    trend: notEnoughHistory()
  };
  const activeIncludedCount = capture.includedListingIds.length;
  const observedCohortCount = activeIncludedCount + unavailableListings;
  capture.demandPressureProxy = observedCohortCount > 0 ? unavailableListings / observedCohortCount : undefined;
  capture.unsoldShare = unsoldShare(capture);
  capture.supplySaturationShift = calculateSaturationShift(capture, store.captures);
  const priorDailyCaptures = store.captures.filter((item) => item.seriesKey === seriesKey && item.dayKey !== dayKey).length;
  capture.trend = calculateTrend(capture, previous, priorDailyCaptures + 1, store.captures);

  store.observations = [
    ...store.observations.filter((observation) => observation.seriesKey !== seriesKey),
    ...persisted.values()
  ];
  store.captures.push(capture);
  await saveStore(store);
  return capture;
}

export async function getLatestListingTrend(query: CardSearchParams) {
  const capture = latestCapture((await readObservationStore()).captures, queryKey(query));
  return capture?.trend;
}

export async function decorateListingsWithLifecycle(query: CardSearchParams, listings: MarketListing[]) {
  const capture = latestCapture((await readObservationStore()).captures, queryKey(query));
  if (!capture) return listings;
  const observations = (await readObservationStore()).observations.filter((item) => item.seriesKey === capture.seriesKey);
  const statusById = new Map(observations.map((item) => [item.listingId, item.status]));
  return listings.map((listing) => ({ ...listing, lifecycleStatus: statusById.get(listing.id) }));
}

export async function hasPresetCaptureToday(series: TrackingSeries) {
  const today = indiaDayKey();
  return (await readObservationStore()).captures.some((capture) => capture.seriesKey === series.key && capture.dayKey === today);
}

export async function getTrackedSeriesSummaries(): Promise<TrackedSeriesSummary[]> {
  const store = await readObservationStore();
  return PRESET_TRACKING_SERIES.map((series) => {
    const captures = store.captures.filter((capture) => capture.seriesKey === series.key);
    const latest = latestCapture(captures, series.key);
    return {
      key: series.key,
      name: series.name,
      kind: series.kind,
      captures: captures.length,
      lastCapturedAt: latest?.capturedAt,
      activeListings: latest?.includedListingIds.length,
      trend: latest?.trend ?? notEnoughHistory()
    };
  });
}
