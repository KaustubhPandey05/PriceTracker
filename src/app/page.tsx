"use client";

import { Activity, BadgeDollarSign, BarChart3, Boxes, ExternalLink, Save, Search, ShieldCheck, TrendingUp } from "lucide-react";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AutocompleteInput } from "@/components/AutocompleteInput";
import { AppShell } from "@/components/AppShell";
import { MarketHistoryChart } from "@/components/MarketHistoryChart";
import type { MarketAnalysis, SearchMode } from "@/types/market";
import { money } from "@/lib/market/math";

const initialQuery = {
  q: "Charizard",
  set: "Base Set",
  number: "4/102",
  variant: "holo",
  condition: "",
  grade: "PSA 9",
  mode: "balanced" as SearchMode
};

function statusLabel(value: string) {
  return value.replace(/-/g, " ");
}

export default function Home() {
  const [query, setQuery] = useState(initialQuery);
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [snapshotMessage, setSnapshotMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [query]);

  async function loadAnalysis() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/cards/analysis?${queryString}`);
      if (!response.ok) throw new Error("Market analysis request failed.");
      setAnalysis(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSnapshotMessage(null);
    loadAnalysis();
  }

  async function saveSnapshot() {
    if (!analysis) return;
    setIsSavingSnapshot(true);
    setSnapshotMessage(null);
    try {
      const response = await fetch("/api/cards/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analysis.query)
      });
      if (!response.ok) throw new Error("Could not save observation.");
      const result = await response.json() as {
        history: MarketAnalysis["demandHistory"];
        activeListings: MarketAnalysis["activeListings"];
        listingTrend?: MarketAnalysis["listingTrend"];
        demandInsight: MarketAnalysis["demandInsight"];
        marketHistory: MarketAnalysis["marketHistory"];
      };
      setAnalysis({
        ...analysis,
        activeListings: result.activeListings,
        demandHistory: result.history,
        marketHistory: result.marketHistory,
        listingTrend: result.listingTrend,
        demandInsight: result.demandInsight
      });
      setSnapshotMessage("Observation saved.");
    } catch (err) {
      setSnapshotMessage(err instanceof Error ? err.message : "Could not save observation.");
    } finally {
      setIsSavingSnapshot(false);
    }
  }

  return (
    <AppShell>
      <section className="search-band">
        <form onSubmit={onSubmit} className="search-grid">
          <AutocompleteInput label="Card name" field="card" value={query.q} onChange={(value) => setQuery({ ...query, q: value })} placeholder="Charizard" />
          <AutocompleteInput label="Set" field="set" value={query.set ?? ""} onChange={(value) => setQuery({ ...query, set: value })} placeholder="Base Set" />
          <label>
            Number
            <input value={query.number} onChange={(event) => setQuery({ ...query, number: event.target.value })} placeholder="4/102" />
          </label>
          <AutocompleteInput label="Variant" field="variant" value={query.variant ?? ""} onChange={(value) => setQuery({ ...query, variant: value })} placeholder="holo" />
          <label>
            Condition
            <input value={query.condition} onChange={(event) => setQuery({ ...query, condition: event.target.value })} placeholder="LP, NM, raw" />
          </label>
          <label>
            Grade
            <input value={query.grade} onChange={(event) => setQuery({ ...query, grade: event.target.value })} placeholder="PSA 9" />
          </label>
          <label>
            Search mode
            <select value={query.mode} onChange={(event) => setQuery({ ...query, mode: event.target.value as SearchMode })}>
              <option value="balanced">Balanced</option>
              <option value="strict">Strict</option>
              <option value="loose">Loose</option>
            </select>
          </label>
          <button type="submit" className="primary-button" disabled={isLoading}>
            <Search size={18} />
            {isLoading ? "Checking" : "Analyze"}
          </button>
        </form>
      </section>

      {error ? <div className="notice error">{error}</div> : null}

      {analysis ? (
        <>
          <section className="identity-row">
            <div className="card-art">
              {analysis.card?.imageUrl ? (
                <Image src={analysis.card.imageUrl} alt={analysis.card.name} width={245} height={342} priority />
              ) : (
                <div className="empty-art">No image</div>
              )}
            </div>
            <div className="identity-copy">
              <p className="eyebrow">Card identity</p>
              <h2>{analysis.card?.name ?? query.q}</h2>
              <div className="identity-meta">
                <span>{analysis.card?.setName ?? query.set ?? "Unknown set"}</span>
                <span>#{analysis.card?.number ?? query.number ?? "N/A"}</span>
                <span>{analysis.card?.rarity ?? "Unknown rarity"}</span>
                <span>{query.grade || query.condition || "Any condition"}</span>
              </div>
              <div className="summary-list">
                {analysis.summary.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>
          </section>

          <section className="metrics-grid">
            <Metric icon={<BadgeDollarSign />} label="Reference price" value={money(analysis.referencePrice)} />
            <Metric icon={<BarChart3 />} label="Median active ask" value={money(analysis.metrics.medianAsk)} />
            <Metric icon={<Boxes />} label="Active supply" value={String(analysis.metrics.activeListingCount)} detail={`${analysis.metrics.includedListingCount} included`} />
            <Metric icon={<TrendingUp />} label="Trend" value={statusLabel(analysis.metrics.trend)} detail={`${analysis.metrics.confidence} confidence`} />
          </section>

          <section className="analysis-grid">
            <Panel title="Supply Analysis" icon={<Boxes />}>
              <div className="signal-row">
                <strong>{statusLabel(analysis.metrics.supplySignal)}</strong>
                <span>{analysis.metrics.includedListingCount} listings passed confidence filters.</span>
              </div>
              <div className="bars">
                {Object.entries(analysis.gradeBreakdown).map(([grade, count]) => (
                  <div className="bar-row" key={grade}>
                    <span>{grade}</span>
                    <div><i style={{ width: `${Math.min(100, count * 25)}%` }} /></div>
                    <b>{count}</b>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Observed Market Pressure" icon={<Activity />}>
              <div className="pending-box">
                <strong>{statusLabel(analysis.demandInsight.signal)}</strong>
                <p>{statusLabel(analysis.demandInsight.basis)} | {analysis.demandInsight.confidence} confidence | score {analysis.demandInsight.score}/100</p>
              </div>
              <div className="snapshot-actions">
                <button type="button" className="secondary-button" onClick={saveSnapshot} disabled={isSavingSnapshot}>
                  <Save size={16} />
                  {isSavingSnapshot ? "Saving" : "Save observation"}
                </button>
                {snapshotMessage ? <span>{snapshotMessage}</span> : null}
              </div>
              <DemandHistoryPanel analysis={analysis} />
              <div className="factor-list">
                {analysis.demandInsight.factors.map((factor) => (
                  <p key={factor}>{factor}</p>
                ))}
              </div>
            </Panel>

            <Panel title="Provider Health" icon={<ShieldCheck />}>
              <div className="provider-list">
                {analysis.providerHealth.map((provider) => (
                  <div className="provider" key={provider.name}>
                    <span>{provider.name}</span>
                    <b className={`status ${provider.status}`}>{statusLabel(provider.status)}</b>
                    <p>{provider.detail}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </section>

          <section className="panel history-panel">
            <MarketHistoryChart history={analysis.marketHistory} />
          </section>

          <section className="table-section">
            <div className="section-heading">
              <h2>Active Listings</h2>
              <p>Inspect image and title yourself; excluded matches stay visible but do not influence pressure signals.</p>
            </div>
            <div className="listing-table">
              <div className="table-head">
                <span>Image</span>
                <span>Title</span>
                <span>Price</span>
                <span>Confidence</span>
                <span>Analysis</span>
              </div>
              {analysis.activeListings.map((listing) => (
                <div className="table-row" key={listing.id}>
                  <span className="listing-thumb">
                    {listing.imageUrl ? <Image src={listing.imageUrl} alt="" width={66} height={66} /> : <small>No image</small>}
                  </span>
                  <span>
                    <a href={listing.url} target="_blank" rel="noreferrer">
                      {listing.title}
                      <ExternalLink size={14} />
                    </a>
                    <small>{listing.reason}</small>
                    {listing.lifecycleStatus ? <small className={`lifecycle ${listing.lifecycleStatus}`}>{statusLabel(listing.lifecycleStatus)}</small> : null}
                  </span>
                  <span>{money(listing.price + (listing.shipping ?? 0))}</span>
                  <span className={`confidence ${listing.confidence}`}>{listing.confidence}</span>
                  <span>{listing.includedInAnalysis ? "Included" : "Excluded"}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail?: string }) {
  return (
    <div className="metric">
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-title">
        {icon}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function signedValue(value?: number) {
  if (typeof value !== "number") return "N/A";
  return `${value > 0 ? "+" : ""}${value}`;
}

function DemandHistoryPanel({ analysis }: { analysis: MarketAnalysis }) {
  const { demandHistory } = analysis;

  return (
    <div className="demand-history">
      <div className="demand-history-heading">
        <strong>Observed pressure over time</strong>
        <span className={`trend-label ${demandHistory.trend.replaceAll(" ", "-")}`}>{demandHistory.trend}</span>
      </div>
      {demandHistory.snapshots.length < 2 ? (
        <p className="history-empty">Save observations on at least two different days to calculate directional listing pressure.</p>
      ) : (
        <>
          <div className="trend-metrics">
            <div><span>Previous</span><b>{signedValue(demandHistory.changeFromPrevious)}</b></div>
            <div><span>7-day avg</span><b>{signedValue(demandHistory.change7)}</b></div>
            <div><span>30-day avg</span><b>{signedValue(demandHistory.change30)}</b></div>
          </div>
          <div className="sparkline" aria-label="Saved demand score history">
            {demandHistory.snapshots.slice(-12).map((snapshot) => (
              <div key={snapshot.id} className="spark-column" title={`${new Date(snapshot.capturedAt).toLocaleDateString()}: ${snapshot.demandScore}`}>
                <i style={{ height: `${Math.max(6, snapshot.demandScore)}%` }} />
                <small>{snapshot.demandScore}</small>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
