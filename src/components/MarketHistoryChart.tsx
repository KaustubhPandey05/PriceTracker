"use client";

import { useMemo, useState } from "react";
import type { MarketHistoryPoint, MarketHistorySeries } from "@/types/market";
import { money } from "@/lib/market/math";

type RangeDays = 7 | 30 | 60;

interface ChartLine {
  key: string;
  label: string;
  className: string;
  values: Array<number | undefined>;
  format: (value: number | undefined) => string;
}

const WIDTH = 620;
const HEIGHT = 150;

function usableNumbers(values: Array<number | undefined>) {
  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
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

function pointsFor(values: Array<number | undefined>, min: number, max: number) {
  const range = max - min || 1;
  return values.map((value, index) => {
    if (typeof value !== "number") return undefined;
    return {
      x: values.length <= 1 ? WIDTH / 2 : (index / (values.length - 1)) * WIDTH,
      y: HEIGHT - ((value - min) / range) * HEIGHT
    };
  });
}

function latestNumber(values: Array<number | undefined>) {
  return [...values].reverse().find((value): value is number => typeof value === "number");
}

function average(values: Array<number | undefined>) {
  const usable = usableNumbers(values);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : undefined;
}

function percent(value: number | undefined) {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "N/A";
}

function plainPercent(value: number | undefined) {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "N/A";
}

function compactMoney(value: number | undefined) {
  return typeof value === "number" ? money(value) : "N/A";
}

function saturationValue(value: number | undefined) {
  return typeof value === "number" ? `${value.toFixed(2)}x` : "N/A";
}

function filterPoints(points: MarketHistoryPoint[], rangeDays: RangeDays) {
  const latestCaptureTime = points.length ? new Date(points[points.length - 1].capturedAt).getTime() : undefined;
  if (!latestCaptureTime) return [];
  return points.filter((point) => {
    const capturedTime = new Date(point.capturedAt).getTime();
    return latestCaptureTime - capturedTime <= rangeDays * 24 * 60 * 60 * 1000;
  }).slice(-24);
}

function latestDateRange(points: MarketHistoryPoint[], rangeDays: RangeDays) {
  if (!points.length) return "No captures yet";
  if (points.length === 1) return `${rangeDays}d window, latest ${points[0].label}`;
  return `${rangeDays}d window, ${points[0].label} to ${points[points.length - 1].label}`;
}

function ChartPanel({
  title,
  subtitle,
  lines,
  points,
  fixedMin,
  fixedMax
}: {
  title: string;
  subtitle: string;
  lines: ChartLine[];
  points: MarketHistoryPoint[];
  fixedMin?: number;
  fixedMax?: number;
}) {
  const values = lines.flatMap((line) => usableNumbers(line.values));
  const min = typeof fixedMin === "number" ? fixedMin : values.length ? Math.min(...values) : 0;
  const max = typeof fixedMax === "number" ? fixedMax : values.length ? Math.max(...values) : 1;
  const hasAnyLine = lines.some((line) => pathFor(line.values, min, max));
  const yTop = lines[0]?.format(max);
  const yBottom = lines[0]?.format(min);

  return (
    <article className="history-card">
      <div className="history-card-head">
        <div>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </div>
        <span>{points.length} capture{points.length === 1 ? "" : "s"}</span>
      </div>

      {hasAnyLine ? (
        <div className="chart-frame">
          <div className="axis-label top">{yTop}</div>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={title}>
            {[0.25, 0.5, 0.75, 1].map((tick) => (
              <line key={tick} className="grid-line" x1="0" y1={HEIGHT * tick} x2={WIDTH} y2={HEIGHT * tick} />
            ))}
            {lines.map((line) => {
              const linePath = pathFor(line.values, min, max);
              const linePoints = pointsFor(line.values, min, max);
              return (
                <g key={line.key}>
                  <path className={line.className} d={linePath} />
                  {linePoints.map((point, index) => point ? (
                    <circle key={`${line.key}-${index}`} className={`${line.className}-dot`} cx={point.x} cy={point.y} r="3.5" />
                  ) : null)}
                </g>
              );
            })}
          </svg>
          <div className="axis-label bottom">{yBottom}</div>
        </div>
      ) : (
        <p className="history-empty">Save observations over time to populate this chart.</p>
      )}

      <div className="history-legend">
        {lines.map((line) => {
          const latest = latestNumber(line.values);
          return (
            <span key={line.key}>
              <i className={`${line.className}-swatch`} />
              {line.label}
              <b>{line.format(latest)}</b>
            </span>
          );
        })}
      </div>
    </article>
  );
}

function CompactChart({ points, rangeDays }: { points: MarketHistoryPoint[]; rangeDays: RangeDays }) {
  const hasPressure = points.some((point) => typeof point.pressureScore === "number");
  const pressureLine: ChartLine = {
    key: "pressure",
    label: "Pressure",
    className: "pressure-line",
    values: points.map((point) => point.pressureScore),
    format: (value) => typeof value === "number" ? `${value}/100` : "N/A"
  };
  const askLine: ChartLine = {
    key: "active",
    label: "Ask",
    className: "active-ask-line",
    values: points.map((point) => point.medianActiveAsk),
    format: compactMoney
  };

  return (
    <div className="history-chart compact">
      <div className="history-chart-head">
        <div>
          <strong>Market History</strong>
          <small>{latestDateRange(points, rangeDays)}</small>
        </div>
      </div>
      <ChartPanel
        title={hasPressure ? "Pressure trend" : "Price trend"}
        subtitle="Compact preset view"
        lines={hasPressure ? [pressureLine] : [askLine]}
        points={points}
        fixedMin={hasPressure ? 0 : undefined}
        fixedMax={hasPressure ? 100 : undefined}
      />
    </div>
  );
}

export function MarketHistoryChart({ history, compact = false }: { history: MarketHistorySeries; compact?: boolean }) {
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const points = useMemo(() => filterPoints(history.points, rangeDays), [history.points, rangeDays]);
  const latest = points[points.length - 1];
  const hasEnoughTrend = points.length >= 2;

  const priceLines: ChartLine[] = [
    {
      key: "active",
      label: "eBay active median ask",
      className: "active-ask-line",
      values: points.map((point) => point.medianActiveAsk),
      format: compactMoney
    },
    {
      key: "reference",
      label: "Pokemon TCG reference",
      className: "reference-line",
      values: points.map((point) => point.referencePrice),
      format: compactMoney
    }
  ];

  const dynamicsLines: ChartLine[] = [
    {
      key: "pressure",
      label: "Observed pressure score",
      className: "pressure-line",
      values: points.map((point) => point.pressureScore),
      format: (value) => typeof value === "number" ? `${value}/100` : "N/A"
    },
    {
      key: "demand",
      label: "Disappearance pressure proxy",
      className: "demand-proxy-line",
      values: points.map((point) => typeof point.demandPressureProxy === "number" ? point.demandPressureProxy * 100 : undefined),
      format: plainPercent
    },
    {
      key: "saturation",
      label: "Supply saturation shift",
      className: "saturation-line",
      values: points.map((point) => typeof point.supplySaturationShift === "number" ? Math.max(0, Math.min(100, point.supplySaturationShift * 50)) : undefined),
      format: (value) => typeof value === "number" ? `${(value / 50).toFixed(2)}x` : "N/A"
    }
  ];

  const volumeLines: ChartLine[] = [
    {
      key: "active-supply",
      label: "Included active supply",
      className: "active-supply-line",
      values: points.map((point) => point.activeSupply),
      format: (value) => typeof value === "number" ? String(value) : "N/A"
    },
    {
      key: "new-listings",
      label: "New included listings",
      className: "new-listings-line",
      values: points.map((point) => point.newListings),
      format: (value) => typeof value === "number" ? String(value) : "N/A"
    },
    {
      key: "unavailable",
      label: "Unavailable tracked listings",
      className: "unavailable-line",
      values: points.map((point) => point.unavailableListings),
      format: (value) => typeof value === "number" ? String(value) : "N/A"
    }
  ];

  const averagePressure = average(points.map((point) => point.pressureScore));
  const latestDemandProxy = latestNumber(points.map((point) => point.demandPressureProxy));
  const latestSaturation = latestNumber(points.map((point) => point.supplySaturationShift));

  if (compact) return <CompactChart points={points} rangeDays={rangeDays} />;

  return (
    <div className="history-chart">
      <div className="history-chart-head">
        <div>
          <strong>Market History</strong>
          <small>{latestDateRange(points, rangeDays)}</small>
        </div>
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
      </div>

      <div className="history-stat-grid">
        <span><strong>{latest?.medianActiveAsk ? money(latest.medianActiveAsk) : "N/A"}</strong><small>latest eBay active median ask</small></span>
        <span><strong>{typeof averagePressure === "number" ? averagePressure.toFixed(0) : "N/A"}</strong><small>{rangeDays}d avg pressure</small></span>
        <span><strong>{percent(latestDemandProxy)}</strong><small>latest disappearance pressure</small></span>
        <span><strong>{saturationValue(latestSaturation)}</strong><small>7d unsold share vs 30d</small></span>
      </div>

      {!hasEnoughTrend ? (
        <p className="history-empty">One capture can show current values. Save another observation on a later day to make trend lines meaningful.</p>
      ) : null}

      <div className="history-card-grid">
        <ChartPanel
          title="Price trend"
          subtitle="Active ask vs stored reference price"
          lines={priceLines}
          points={points}
        />
        <ChartPanel
          title="eBay market dynamics"
          subtitle="Directional proxy from observed listing lifecycle"
          lines={dynamicsLines}
          points={points}
          fixedMin={0}
          fixedMax={100}
        />
        <ChartPanel
          title="eBay listing volume"
          subtitle="Supply, new listings, and unavailable tracked listings"
          lines={volumeLines}
          points={points}
          fixedMin={0}
        />
      </div>

      <p className="history-note">
        eBay lifecycle data is modeled from active listing observations. Unavailable listings are an absorption/disappearance proxy, not confirmed sold listings.
      </p>
    </div>
  );
}
