"use client";

import { Activity, AlertTriangle, ArrowDownUp, ExternalLink, Gem, LineChart, PackageSearch } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MarketHistoryChart } from "@/components/MarketHistoryChart";
import { money } from "@/lib/market/math";
import type { LeaderboardRow, MarketOverview, NoisyListingRow, OverviewMetric, TrackedSeriesSummary } from "@/types/market";

export default function OverviewPage() {
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOverview() {
      try {
        await fetch("/api/market/captures/daily", { method: "POST" });
        const response = await fetch("/api/market/overview");
        if (!response.ok) throw new Error("Market overview request failed.");
        setOverview(await response.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    }
    loadOverview();
  }, []);

  return (
    <AppShell>
      {error ? <div className="notice error">{error}</div> : null}

      <section className="overview-hero">
        <div>
          <p className="eyebrow">Market overview</p>
          <h2>Find cards worth investigating before you search one by one.</h2>
        </div>
        <p>
          Reference prices are paired with active eBay supply and observed listing movement.
          Lifecycle trends are directional signals, not confirmed sold-price data.
        </p>
      </section>

      {overview ? (
        <>
          <section className="overview-metrics">
            {overview.metrics.map((metric) => (
              <OverviewMetricCard key={metric.label} metric={metric} />
            ))}
          </section>

          <TrackedSeriesPanel rows={overview.trackedSeries} description={overview.explainers.lifecycle} />
          <PresetHistoryPanel overview={overview} />

          <section className="leaderboard-grid">
            <LeaderboardPanel
              title="Highest Reference Value"
              description={overview.explainers.referenceValue}
              icon={<Gem />}
              rows={overview.highestValueCards}
              valueLabel="Reference"
              formatValue={money}
            />
            <LeaderboardPanel
              title="Biggest Value Gaps"
              description={overview.explainers.valueGap}
              icon={<ArrowDownUp />}
              rows={overview.valueGapCards}
              valueLabel="Gap"
              formatValue={(value) => `${value >= 0 ? "+" : "-"}${money(Math.abs(value))}`}
            />
            <LeaderboardPanel
              title="Tightest Supply"
              description={overview.explainers.tightSupply}
              icon={<PackageSearch />}
              rows={overview.tightSupplyCards}
              valueLabel="Listings"
              formatValue={(value) => String(value)}
            />
            <NoisyListingsPanel rows={overview.noisyListings} description={overview.explainers.noisyListings} />
          </section>
        </>
      ) : (
        <section className="panel loading-panel">
          <LineChart />
          <strong>Building overview</strong>
        </section>
      )}
    </AppShell>
  );
}

function PresetHistoryPanel({ overview }: { overview: MarketOverview }) {
  const histories = overview.trackedHistory.filter((item) => item.history.points.length);
  return (
    <section className="panel preset-history-panel">
      <div className="panel-title">
        <LineChart />
        <h2>Preset History</h2>
      </div>
      {histories.length ? (
        <div className="preset-history-grid">
          {histories.slice(0, 4).map((item) => (
            <article key={item.series.key} className="preset-history-card">
              <strong>{item.series.name}</strong>
              <MarketHistoryChart history={item.history} compact />
            </article>
          ))}
        </div>
      ) : (
        <p className="history-empty">Daily captures will appear here after the first preset observation run.</p>
      )}
    </section>
  );
}

function TrackedSeriesPanel({ rows, description }: { rows: TrackedSeriesSummary[]; description: string }) {
  return (
    <section className="panel lifecycle-panel">
      <div className="panel-title">
        <Activity />
        <h2>Observed Market Pressure</h2>
      </div>
      <p className="panel-description">{description}</p>
      <div className="series-grid">
        {rows.map((row) => (
          <article className="series-row" key={row.key}>
            <div>
              <strong>{row.name}</strong>
              <small>{row.captures ? `${row.captures} capture${row.captures === 1 ? "" : "s"} stored` : "Awaiting first daily capture"}</small>
            </div>
            <div className="series-value">
              <span>{typeof row.trend.score === "number" ? `${row.trend.score}/100` : "N/A"}</span>
              <b className={`trend-label ${row.trend.label.toLowerCase().replaceAll(" ", "-")}`}>{row.trend.label}</b>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function OverviewMetricCard({ metric }: { metric: OverviewMetric }) {
  return (
    <div className="metric">
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
      <small>{metric.detail}</small>
    </div>
  );
}

function LeaderboardPanel({
  title,
  description,
  icon,
  rows,
  valueLabel,
  formatValue
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  rows: LeaderboardRow[];
  valueLabel: string;
  formatValue: (value: number) => string;
}) {
  return (
    <section className="panel leaderboard-panel">
      <div className="panel-title">
        {icon}
        <h2>{title}</h2>
      </div>
      <p className="panel-description">{description}</p>
      <div className="leaderboard-list">
        {rows.map((row, index) => (
          <article className="leaderboard-row" key={`${row.id}-${row.badge}`}>
            <span className="rank">{index + 1}</span>
            <div className="mini-card-art">
              {row.imageUrl ? <Image src={row.imageUrl} alt={row.cardName} width={52} height={72} /> : null}
            </div>
            <div>
              <strong>{row.cardName}</strong>
              <small>{row.setName} #{row.number}</small>
              <p>{row.note}</p>
            </div>
            <div className="leaderboard-value">
              <span>{valueLabel}</span>
              <b>{formatValue(row.primaryValue)}</b>
              {typeof row.secondaryValue === "number" ? <small>Ask {money(row.secondaryValue)}</small> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function NoisyListingsPanel({ rows, description }: { rows: NoisyListingRow[]; description: string }) {
  return (
    <section className="panel leaderboard-panel">
      <div className="panel-title">
        <AlertTriangle />
        <h2>Noisy Listing Watchlist</h2>
      </div>
      <p className="panel-description">{description}</p>
      <div className="noisy-list">
        {rows.map((row) => (
          <article className="noisy-row" key={row.id}>
            <div>
              <a href={row.url} target="_blank" rel="noreferrer">
                {row.title}
                <ExternalLink size={14} />
              </a>
              <small>{row.reason}</small>
            </div>
            <b>{money(row.price)}</b>
          </article>
        ))}
      </div>
    </section>
  );
}
