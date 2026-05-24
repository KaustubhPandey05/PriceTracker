# Pokemon Card Market Tracker

Local MVP dashboard for checking Pokemon card prices, active supply, and early trend signals.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Pages

- `http://localhost:3000` - single-card dashboard and listing confidence analysis.
- `http://localhost:3000/overview` - market overview and discovery leaderboards.

## Demand history

The Demand Analysis panel includes a `Save snapshot` action. Each capture stores the current demand score, active supply, asking-price median, and available sold-window totals in `.local-data/demand-snapshots.json`.

`.local-data/` is local-only and gitignored. Save multiple snapshots for the same search to see whether its demand signal is increasing, decreasing, stable, or volatile over time.

## Environment

Copy `.env.local.example` to `.env.local` when you are ready to use real providers.

```env
DATA_MODE=mock
POKEMON_TCG_API_KEY=
EBAY_CLIENT_ID=
EBAY_CLIENT_SECRET=
EBAY_MARKETPLACE_ID=EBAY_US
PRICECHARTING_TOKEN=
```

`DATA_MODE=mock` is the default and works without API keys. Set `DATA_MODE=live` when you want the backend to query the Pokemon TCG API and eBay Browse API.

## Current provider state

- Pokemon TCG API: free card identity, images, and available reference prices.
- Mock eBay: active listing examples for local analysis.
- eBay Browse API: adapter is ready for active listing supply once credentials are approved.
- eBay Marketplace Insights: route is present, but sold-history analysis remains pending approval.
- PriceCharting: optional placeholder until a token and subscription API format are available.
