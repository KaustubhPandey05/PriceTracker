"use client";

import { useMemo, useState } from "react";
import type { MarketHistorySeries } from "@/types/market";
import { money } from "@/lib/market/math";

type ChartMode = "price" | "pressure";
type RangeDays = 7 | 30 | 60;

function seriesPath(values: Array<number | undefined>, width: number, height: number, min: number, max: number) {
  const usable = values
    .map((value, index) => ({ value, index }))
    .filter((point): point is { value: number; index: number } => typeof point.value === "number");
  if (!usable.length) return "";
  const range = max - min || 1;
  return usable.map((point, orderedIndex) => {
    const x = values.length <= 1 ? width / 2 : (point.index / (values.length - 1)) * width;
    const y = height - ((point.value - min) / range) * height;
    return `${orderedIndex === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

function latestNumber(values: Array<number | undefined>) {
  return [...values].reverse().find((value): value is number => typeof value === "number");
}

function average(values: Array<number | undefined>) {
  const usable = values.filter((value): value is number => typeof value === "number");
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : undefined;
}

function percent(value: number | undefined) {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "N/A";
}

function saturationValue(value: number | undefined) {
  return typeof value === "number" ? `${value.toFixed(2)}x` : "N/A";
}

export function MarketHistoryChart({ history, compact = false }: { history: MarketHistorySeries; compact?: boolean }) {
  const [mode, setMode] = useState<ChartMode>("price");
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const latestCaptureTime = history.points.length
    ? new Date(history.points[history.points.length - 1].capturedAt).getTime()
    : undefined;
  const points = history.points.filter((point) => {
    if (!latestCaptureTime) return false;
    const capturedTime = new Date(point.capturedAt).getTime();
    return latestCaptureTime - capturedTime <= rangeDays * 24 * 60 * 60 * 1000;
  }).slice(-24);
  const width = 520;
  const height = compact ? 86 : 150;
  const priceValues = points.flatMap((point) => [point.medianActiveAsk, point.referencePrice])
    .filter((value): value is number => typeof value === "number");
  const priceMin = priceValues.length ? Math.min(...priceValues) : 0;
  const priceMax = priceValues.length ? Math.max(...priceValues) : 1;
  const pressureMin = 0;
  const pressureMax = 100;
  const activePath = useMemo(
    () => seriesPath(points.map((point) => point.medianActiveAsk), width, height, priceMin, priceMax),
    [height, points, priceMax, priceMin]
  );
  const referencePath = useMemo(
    () => seriesPath(points.map((point) => point.referencePrice), width, height, priceMin, priceMax),
    [height, points, priceMax, priceMin]
  );
  const pressurePath = useMemo(
    () => seriesPath(points.map((point) => point.pressureScore), width, height, pressureMin, pressureMax),
    [height, points]
  );
  const demandPressurePath = useMemo(
    () => seriesPath(points.map((point) => typeof point.demandPressureProxy === "number" ? point.demandPressureProxy * 100 : undefined), width, height, pressureMin, pressureMax),
    [height, points]
  );
  const saturationPath = useMemo(
    () => seriesPath(points.map((point) => typeof point.supplySaturationShift === "number" ? Math.max(0, Math.min(100, point.supplySaturationShift * 50)) : undefined), width, height, pressureMin, pressureMax),
    [height, points]
  );
  const hasPrice = Boolean(activePath || referencePath);
  const hasPressure = Boolean(pressurePath || demandPressurePath || saturationPath);
  const latest = points[points.length - 1];
  const latestPressure = latestNumber(points.map((point) => point.pressureScore));
  const latestDemandProxy = latestNumber(points.map((point) => point.demandPressureProxy));
  const latestSaturation = latestNumber(points.map((point) => point.supplySaturationShift));
  const averagePressure = average(points.map((point) => point.pressureScore));
  const dateRange = points.length > 1 ? `${points[0].label} to ${points[points.length - 1].label}` : latest?.label;

  return (
    <div className={`history-chart ${compact ? "compact" : ""}`}>
      <div className="history-chart-head">
        <div>
          <strong>Market History</strong>
          <small>{latest ? `${rangeDays}d window, ${dateRange}` : "No captures yet"}</small>
        </div>
        <div className="history-controls">
          <div className="segmented-control" aria-label="Chart mode">
            <button type="button" className={mode === "price" ? "active" : ""} onClick={() => setMode("price")}>Price</button>
            <button type="button" className={mode === "pressure" ? "active" : ""} onClick={() => setMode("pressure")}>Pressure</button>
          </div>
          <div className="segmented-control range-control" aria-label="History range">
            {[7, 30, 60].map((days) => (
              <button
                key={days}
                type="button"
                className={rangeDays === days ? "active" : ""}
                onClick={() => setRangeDays(days as RangeDays)}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {(mode === "price" && !hasPrice) || (mode === "pressure" && !hasPressure) ? (
        <p className="history-empty">Capture observations over time to populate this graph.</p>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${mode} history chart`}>
          <line x1="0" y1={height} x2={width} y2={height} />
          {mode === "price" ? (
            <>
              <path className="active-ask-line" d={activePath} />
              <path className="reference-line" d={referencePath} />
            </>
          ) : (
            <>
              <path className="pressure-line" d={pressurePath} />
              <path className="demand-proxy-line" d={demandPressurePath} />
              <path className="saturation-line" d={saturationPath} />
            </>
          )}
        </svg>
      )}

      <div className="history-legend">
        {mode === "price" ? (
          <>
            <span><i className="active-ask-dot" /> eBay median active ask from local JSON captures</span>
            <span><i className="reference-dot" /> Pokemon TCG reference stored in local JSON</span>
            <b>{latest?.medianActiveAsk ? `${money(latest.medianActiveAsk)} ask` : "N/A"}</b>
            <b>{latest?.referencePrice ? `${money(latest.referencePrice)} ref` : "N/A ref"}</b>
          </>
        ) : (
          <>
            <span><i className="pressure-dot" /> Observed pressure score</span>
            <span><i className="demand-proxy-dot" /> Disappearance pressure proxy</span>
            <span><i className="saturation-dot" /> Supply saturation shift</span>
            <b>{typeof latestPressure === "number" ? `${latestPressure}/100 latest` : "N/A"}</b>
          </>
        )}
      </div>

      {mode === "pressure" ? (
        <div className="history-stat-grid">
          <span><strong>{typeof averagePressure === "number" ? averagePressure.toFixed(0) : "N/A"}</strong><small>{rangeDays}d avg pressure</small></span>
          <span><strong>{percent(latestDemandProxy)}</strong><small>latest disappearance pressure</small></span>
          <span><strong>{saturationValue(latestSaturation)}</strong><small>7d unsold share vs 30d</small></span>
          <span><strong>{latest?.activeSupply ?? "N/A"}</strong><small>included active supply</small></span>
        </div>
      ) : null}
    </div>
  );
}
