import { NextResponse } from "next/server";
import { analyzeMarket } from "@/lib/analysis";
import { captureListingObservations, hasPresetCaptureToday, PRESET_TRACKING_SERIES } from "@/lib/observations";

let captureRun: Promise<unknown> | undefined;

async function captureDailyPresets() {
  const results = [];
  for (const series of PRESET_TRACKING_SERIES) {
    if (await hasPresetCaptureToday(series)) {
      results.push({ key: series.key, name: series.name, status: "skipped" as const, detail: "Already captured today." });
      continue;
    }
    try {
      const analysis = await analyzeMarket(series.query);
      const capture = await captureListingObservations(analysis, series);
      results.push({ key: series.key, name: series.name, status: "created" as const, capture });
    } catch (error) {
      results.push({
        key: series.key,
        name: series.name,
        status: "failed" as const,
        detail: error instanceof Error ? error.message : "Capture failed."
      });
    }
  }
  return results;
}

export async function POST() {
  captureRun ??= captureDailyPresets().finally(() => {
    captureRun = undefined;
  });
  return NextResponse.json({ data: await captureRun });
}
