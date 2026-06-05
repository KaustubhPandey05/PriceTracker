"use client";

import { useMemo, useState } from "react";
import type { MarketHistoryPoint, MarketHistorySeries } from "@/types/market";
import { money } from "@/lib/market/math";

type RangeDays = 7 | 30 | 60;

interface IndexedLine {
  key: string;
  label: string;
  className: string;
  values: Array<number | undefined>;
  format: (value: number | undefined) => string;
}

const WIDTH = 680;
const HEIGHT = 220;

function numbers(values: Array<number | undefined>) {
  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function latestNumber(values: Array<number | undefined>) {
  return [...values].reverse().find((value): value is number => typeof value === "number");
}

function filterPoints(points: MarketHistoryPoint[], rangeDays: RangeDays) {
  const latestCaptureTime = points.length ? new Date(points[points.length - 1].capturedAt).getTime() : undefined;
  if (!latestCaptureTime) return [];
  return points.filter((point) => {
    const capturedTime = new Date(point.capturedAt).getTime();
    return latestCaptureTime - capturedTime <= rangeDays * 24 * 60 * 60 * 1000;
  }).slice(-30);
}

function dateRangeLabel(points: MarketHistoryPoint[], rangeDays: RangeDays) {
  if (!points.length) return "No captures yet";
  if (points.length === 1) return `${rangeDays}d window, latest ${points[0].label}`;
  return `${rangeDays}d window, ${points[0].label} to ${points[points.length - 1].label}`;
}

function indexValues(values: Array<number | undefined>) {
  const base = values.find((value): value is number => typeof value === "number" && value > 0);
  if (!base) return values.map(() => undefined);
  return values.map((value) => typeof value === "number" ? (value / base) * 100 : undefined);
}

function pathFor(values: Array<number | undefined>, min: number, max: number) {
  const usable = values
    .map((value, index) => ({ value, index }))
    .filter((point): point is { value: number; index: number } => typeof point.value === "number");
  if (!usable.length) return "";
  const range = max - min || 1;
  return usable.map((point, orderedIndex) => {
    const x = values.length <= 1 ? WIDTH / 2 : (point.index / (values.length - 1)) * WIDTH;
    const y = HEIGHT - ((point.value - min) / range) * HEIGHT;
    return `${orderedIndex === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

function dotsFor(values: Array<number | undefined>, min: number, max: number) {
  const range = max - min || 1;
  return values.map((value, index) => {
    if (typeof value !== "number") return undefined;
    return {
      x: values.length <= 1 ? WIDTH / 2 : (index / (values.length - 1)) * WIDTH,
      y: HEIGHT - ((value - min) / range) * HEIGHT
    };
  });
}

function percent(value: number | undefined) {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "N/A";
}

function saturation(value: number | undefined) {
  return typeof value === "number" ? `${value.toFixed(2)}x` : "N/A";
}

function sourceLines(points: MarketHistoryPoint[]): IndexedLine[] {
  return [
    {
      key: "active-ask",
      label: "eBay active median ask",
      className: "active-ask-line",
      values: points.map((point) => point.medianActiveAsk),
      format: (value) => typeof value === "number" ? money(value) : "N/A"
    },
    {
      key: "reference",
      label: "Pokemon TCG reference",
      className: "reference-line",
      values: points.map((point) => point.referencePrice),
      format: (value) => typeof value === "number" ? money(value) : "N/A"
    },
    {
      key: "pressure",
      label: "Observed pressure score",
      className: "pressure-line",
      values: points.map((point) => point.pressureScore),
      format: (value) => typeof value === "number" ? `${value}/100` : "N/A"
    },
    {
      key: "supply",
      label: "Included active supply",
      className: "active-supply-line",
      values: points.map((point) => point.activeSupply),
      format: (value) => typeof value === "number" ? String(value) : "N/A"
    }
  ];
}

export function MarketHistoryChart({ history, compact = false }: { history: MarketHistorySeries; compact?: boolean }) {
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const points = useMemo(() => filterPoints(history.points, rangeDays), [history.points, rangeDays]);
  const lines = useMemo(() => sourceLines(points).filter((line) => numbers(line.values).length), [points]);
  const indexedLines = lines.map((line) => ({ ...line, indexedValues: indexValues(line.values) }));
  const indexedNumbers = indexedLines.flatMap((line) => numbers(line.indexedValues));
  const min = indexedNumbers.length ? Math.min(80, Math.floor(Math.min(...indexedNumbers) / 5) * 5) : 80;
  const max = indexedNumbers.length ? Math.max(120, Math.ceil(Math.max(...indexedNumbers) / 5) * 5) : 120;
  const latest = points[points.length - 1];
  const hasEnoughTrend = points.length >= 2;

  return (
    <div className={`history-chart ${compact ? "compact" : ""}`}>
      <div className="history-chart-head">
        <div>
          <strong>Market History</strong>
          <small>{dateRangeLabel(points, rangeDays)} | indexed comparison, first visible capture = 100</small>
        </div>
        {!compact ? (
          <div className="history-controls">
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
        ) : null}
      </div>

      {!hasEnoughTrend && !compact ? (
        <p className="history-empty">This search needs at least two captures for a meaningful trend. Current values still appear in the legend.</p>
      ) : null}

      {indexedLines.length ? (
        <div className="chart-frame unified-chart-frame">
          <div className="axis-row">
            <span>{max}</span>
            <span>Index</span>
          </div>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Indexed market history comparison">
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
              <line key={tick} className="grid-line" x1="0" y1={HEIGHT * tick} x2={WIDTH} y2={HEIGHT * tick} />
            ))}
            <line className="baseline-line" x1="0" y1={HEIGHT - ((100 - min) / (max - min || 1)) * HEIGHT} x2={WIDTH} y2={HEIGHT - ((100 - min) / (max - min || 1)) * HEIGHT} />
            {indexedLines.map((line) => {
              const linePath = pathFor(line.indexedValues, min, max);
              const lineDots = dotsFor(line.indexedValues, min, max);
              return (
                <g key={line.key}>
                  <path className={line.className} d={linePath} />
                  {lineDots.map((dot, index) => dot ? (
                    <circle key={`${line.key}-${index}`} className={`${line.className}-dot`} cx={dot.x} cy={dot.y} r={compact ? "3" : "4"} />
                  ) : null)}
                </g>
              );
            })}
          </svg>
          <div className="axis-row">
            <span>{min}</span>
            <span>{points[0]?.label ?? ""}{points.length > 1 ? ` -> ${points[points.length - 1].label}` : ""}</span>
          </div>
        </div>
      ) : (
        <p className="history-empty">Save observations over time to populate this graph.</p>
      )}

      <div className="history-legend unified-history-legend">
        {lines.map((line) => {
          const latestValue = latestNumber(line.values);
          const indexedValue = latestNumber(indexValues(line.values));
          return (
            <span key={line.key}>
              <i className={`${line.className}-swatch`} />
              {line.label}
              <b>{line.format(latestValue)}</b>
              <small>{typeof indexedValue === "number" ? `${indexedValue.toFixed(1)} index` : "N/A index"}</small>
            </span>
          );
        })}
      </div>

      {!compact ? (
        <>
          <div className="history-stat-grid">
            <span><strong>{latest?.medianActiveAsk ? money(latest.medianActiveAsk) : "N/A"}</strong><small>latest eBay active median ask</small></span>
            <span><strong>{typeof latest?.pressureScore === "number" ? `${latest.pressureScore}/100` : "N/A"}</strong><small>observed pressure</small></span>
            <span><strong>{percent(latest?.demandPressureProxy)}</strong><small>disappearance pressure proxy</small></span>
            <span><strong>{saturation(latest?.supplySaturationShift)}</strong><small>unsold share shift</small></span>
          </div>
          <p className="history-note">
            eBay lines come from local listing observations. Unavailable listings are a disappearance proxy, not confirmed sold listings.
          </p>
        </>
      ) : null}
    </div>
  );
}
