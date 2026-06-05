import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CardSearchParams, DemandHistory, DemandSnapshot, MarketAnalysis } from "@/types/market";

const dataDirectory = path.join(process.cwd(), ".local-data");
const snapshotFile = path.join(dataDirectory, "demand-snapshots.json");

function normalize(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

export function queryKey(query: CardSearchParams) {
  return [
    query.q,
    query.set,
    query.number,
    query.variant,
    query.condition,
    query.grade,
    query.mode
  ].map(normalize).join("|");
}

export async function readAllSnapshots() {
  try {
    const content = await readFile(snapshotFile, "utf8");
    const snapshots = JSON.parse(content) as DemandSnapshot[];
    return Array.isArray(snapshots) ? snapshots : [];
  } catch {
    return [];
  }
}

function averageScore(snapshots: DemandSnapshot[]) {
  if (!snapshots.length) return undefined;
  return snapshots.reduce((sum, snapshot) => sum + snapshot.demandScore, 0) / snapshots.length;
}

function summarizeHistory(snapshots: DemandSnapshot[]): DemandHistory {
  const ordered = [...snapshots].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  if (ordered.length < 2) {
    return { snapshots: ordered, trend: "not enough history" };
  }

  const latest = ordered[ordered.length - 1];
  const previous = ordered[ordered.length - 2];
  const latestTime = new Date(latest.capturedAt).getTime();
  const trailing7 = ordered.filter((snapshot) => latestTime - new Date(snapshot.capturedAt).getTime() <= 7 * 24 * 60 * 60 * 1000);
  const trailing30 = ordered.filter((snapshot) => latestTime - new Date(snapshot.capturedAt).getTime() <= 30 * 24 * 60 * 60 * 1000);
  const changeFromPrevious = latest.demandScore - previous.demandScore;
  const average7 = averageScore(trailing7);
  const average30 = averageScore(trailing30);
  const scores = ordered.map((snapshot) => snapshot.demandScore);
  const range = Math.max(...scores) - Math.min(...scores);
  const trend = range >= 25 && Math.abs(changeFromPrevious) < 5
    ? "volatile"
    : changeFromPrevious >= 5
      ? "increasing"
      : changeFromPrevious <= -5
        ? "decreasing"
        : "stable";

  return {
    snapshots: ordered,
    trend,
    changeFromPrevious,
    change7: average7 === undefined ? undefined : Math.round(latest.demandScore - average7),
    change30: average30 === undefined ? undefined : Math.round(latest.demandScore - average30)
  };
}

export async function getDemandHistory(query: CardSearchParams) {
  const key = queryKey(query);
  const snapshots = (await readAllSnapshots()).filter((snapshot) => snapshot.queryKey === key);
  return summarizeHistory(snapshots);
}

export function snapshotFromAnalysis(analysis: MarketAnalysis): DemandSnapshot {
  const referenceSource = analysis.card?.prices.find((price) => typeof price.market === "number")
    ?? analysis.card?.prices.find((price) => typeof price.mid === "number");
  return {
    id: crypto.randomUUID(),
    queryKey: queryKey(analysis.query),
    capturedAt: new Date().toISOString(),
    cardName: analysis.card?.name ?? analysis.query.q,
    setName: analysis.card?.setName ?? analysis.query.set ?? "Unknown set",
    number: analysis.card?.number ?? analysis.query.number ?? "N/A",
    activeListingCount: analysis.metrics.activeListingCount,
    includedListingCount: analysis.metrics.includedListingCount,
    medianActiveAsk: analysis.metrics.medianAsk,
    referencePrice: analysis.referencePrice,
    referenceSource: referenceSource?.source,
    sold7: analysis.demandInsight.soldCounts.sold7,
    sold30: analysis.demandInsight.soldCounts.sold30,
    sold90: analysis.demandInsight.soldCounts.sold90,
    medianSoldPrice: analysis.demandInsight.medianSoldPrice,
    demandScore: analysis.demandInsight.score,
    demandBasis: analysis.demandInsight.basis,
    supplySignal: analysis.metrics.supplySignal
  };
}

export async function saveDemandSnapshot(snapshot: DemandSnapshot) {
  const snapshots = await readAllSnapshots();
  snapshots.push(snapshot);
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(snapshotFile, JSON.stringify(snapshots, null, 2), "utf8");
}
