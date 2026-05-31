"use client";

import { useMemo, useState } from "react";
import type { MarketHistorySeries } from "@/types/market";
import { money } from "@/lib/market/math";

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

export function MarketHistoryChart({ history, compact = false }: { history: MarketHistorySeries; compact?: boolean }) {
  const [mode, setMode] = useState<"price" | "pressure">("price");
  const points = history.points.slice(-12);
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
  const hasPrice = Boolean(activePath || referencePath);
  const hasPressure = Boolean(pressurePath);
  const latest = points[points.length - 1];

  return (
    <div className={`history-chart ${compact ? "compact" : ""}`}>
      <div className="history-chart-head">
        <div>
          <strong>Market History</strong>
          <small>{latest ? `Latest ${latest.label}` : "No captures yet"}</small>
        </div>
        {!compact ? (
          <div className="segmented-control" aria-label="Chart mode">
            <button type="button" className={mode === "price" ? "active" : ""} onClick={() => setMode("price")}>Price</button>
            <button type="button" className={mode === "pressure" ? "active" : ""} onClick={() => setMode("pressure")}>Pressure</button>
          </div>
        ) : null}
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
            <path className="pressure-line" d={pressurePath} />
          )}
        </svg>
      )}

      <div className="history-legend">
        {mode === "price" ? (
          <>
            <span><i className="active-ask-dot" /> eBay active median</span>
            <span><i className="reference-dot" /> Pokemon TCG reference</span>
            <b>{latest?.medianActiveAsk ? money(latest.medianActiveAsk) : "N/A"}</b>
          </>
        ) : (
          <>
            <span><i className="pressure-dot" /> Observed pressure</span>
            <b>{typeof latest?.pressureScore === "number" ? `${latest.pressureScore}/100` : "N/A"}</b>
          </>
        )}
      </div>
    </div>
  );
}
