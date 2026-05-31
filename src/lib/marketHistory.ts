import { readObservationStore, PRESET_TRACKING_SERIES } from "@/lib/observations";
import { queryKey, readAllSnapshots } from "@/lib/snapshots";
import type { CardSearchParams, MarketHistoryPoint, MarketHistorySeries } from "@/types/market";

function pointLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(date));
}

function cleanPoint(point: MarketHistoryPoint): MarketHistoryPoint {
  return {
    capturedAt: point.capturedAt,
    label: point.label,
    medianActiveAsk: point.medianActiveAsk,
    referencePrice: point.referencePrice,
    pressureScore: point.pressureScore
  };
}

export async function getMarketHistoryForKey(key: string): Promise<MarketHistorySeries> {
  const [snapshots, observationStore] = await Promise.all([
    readAllSnapshots(),
    readObservationStore()
  ]);
  const snapshotPoints: MarketHistoryPoint[] = snapshots
    .filter((snapshot) => snapshot.queryKey === key)
    .map((snapshot) => cleanPoint({
      capturedAt: snapshot.capturedAt,
      label: pointLabel(snapshot.capturedAt),
      medianActiveAsk: snapshot.medianActiveAsk,
      referencePrice: snapshot.referencePrice,
      pressureScore: snapshot.demandBasis === "listing-lifecycle" ? snapshot.demandScore : undefined
    }));
  const capturePoints: MarketHistoryPoint[] = observationStore.captures
    .filter((capture) => capture.seriesKey === key)
    .map((capture) => cleanPoint({
      capturedAt: capture.capturedAt,
      label: pointLabel(capture.capturedAt),
      medianActiveAsk: capture.medianActiveAsk,
      referencePrice: capture.referencePrice,
      pressureScore: capture.trend.score
    }));
  const points = [...snapshotPoints, ...capturePoints]
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));

  return {
    queryKey: key,
    points,
    latest: points[points.length - 1]
  };
}

export async function getMarketHistory(query: CardSearchParams) {
  return getMarketHistoryForKey(queryKey(query));
}

export async function getPresetMarketHistories() {
  return Promise.all(PRESET_TRACKING_SERIES.map(async (series) => ({
    series,
    history: await getMarketHistoryForKey(series.key)
  })));
}
