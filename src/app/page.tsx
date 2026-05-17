"use client";

import { Activity, BadgeDollarSign, BarChart3, Boxes, ExternalLink, Search, ShieldCheck, TrendingUp } from "lucide-react";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
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
    loadAnalysis();
  }

  return (
    <AppShell>
      <section className="search-band">
        <form onSubmit={onSubmit} className="search-grid">
          <label>
            Card name
            <input value={query.q} onChange={(event) => setQuery({ ...query, q: event.target.value })} placeholder="Charizard" />
          </label>
          <label>
            Set
            <input value={query.set} onChange={(event) => setQuery({ ...query, set: event.target.value })} placeholder="Base Set" />
          </label>
          <label>
            Number
            <input value={query.number} onChange={(event) => setQuery({ ...query, number: event.target.value })} placeholder="4/102" />
          </label>
          <label>
            Variant
            <input value={query.variant} onChange={(event) => setQuery({ ...query, variant: event.target.value })} placeholder="holo" />
          </label>
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

            <Panel title="Demand Analysis" icon={<Activity />}>
              <div className="pending-box">
                <strong>{statusLabel(analysis.demandInsight.signal)}</strong>
                <p>{statusLabel(analysis.demandInsight.basis)} · {analysis.demandInsight.confidence} confidence · score {analysis.demandInsight.score}/100</p>
              </div>
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

          <section className="table-section">
            <div className="section-heading">
              <h2>Active Listings</h2>
              <p>Low-confidence and noisy matches are visible but excluded from calculations.</p>
            </div>
            <div className="listing-table">
              <div className="table-head">
                <span>Title</span>
                <span>Price</span>
                <span>Confidence</span>
                <span>Analysis</span>
              </div>
              {analysis.activeListings.map((listing) => (
                <div className="table-row" key={listing.id}>
                  <span>
                    <a href={listing.url} target="_blank" rel="noreferrer">
                      {listing.title}
                      <ExternalLink size={14} />
                    </a>
                    <small>{listing.reason}</small>
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
