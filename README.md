# Irion Core

**The Irion consumer app — a self-custody wallet and hosted credit/BNPL checkout on the Canton Network.**

---

## What it is

The consumer-facing surface of Irion's "Buy Now, Pay Never" protocol. Two products in one Next.js 15
app, both settling real transactions on the Canton ledger via the [Irion B2B API](../irion-b2b-api):

- **`/app` — Carpincho wallet (self-custody).** A consumer wallet where the user holds their own
  Canton external-party key (CIP-0103 style). The app *prepares* commands, the **user signs**, then
  the operator *executes* — the platform never holds the consumer's key. Features: a USDC **faucet**,
  **borrow** against an attested credit line (signs an `UnsecuredRequest`), **repay** an open loan,
  and live on-ledger **positions**.
- **`/pay/[hash]` — hosted checkout.** A Stripe-style hosted payment page a merchant redirects to.
  Three methods:
  - **Pay with Private Credit** — the shopper's attested credit line covers it; income & balances
    stay private by construction.
  - **Buy Now, Pay Never (BNPL)** — the lending pool pays the merchant now; the shopper repays from
    yield, anytime.
  - **Pay in Full (Direct)** — a **real shopper-signed `Token_Transfer`** of USDC to the merchant.

  On success it posts an `IRION_PAYMENT_RESULT` message back to the opener window (used by the
  `@irion/sdk` drop-in).

It also hosts a small **bills API** (`/api/bills/create`, `/api/bills/[hash]`, MongoDB) used by the
demo storefront chain; `/api/bills/[hash]` falls back to the merchant app when a bill isn't found
locally.

Privacy is **by construction**: a borrower's `CreditProfile`/`CreditAttestation` live in Daml
contracts visible only to the borrower and the operator — this replaces the project's old
zero-knowledge design.

## Run

```bash
npm install
npm run dev          # http://localhost:3000   (Next.js dev server)
# npm run build && npm start   # production
```

**Core MUST run on `:3000`** — other apps hardcode cross-app URLs to it, and the b2b-api allows
`:3000` as a passkey/CORS origin.

### Environment (`.env.local`)

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_B2B_API_URL` | Irion B2B API base (operator party + ledger calls) — default `http://localhost:8088` |
| `MONGODB_URI` / `MONGODB_DB` | data layer for `app/api/bills/**` (via `lib/mongodb.ts`) |
| `MERCHANT_APP_URL` | cross-app bill resolution: `/api/bills/[hash]` falls back to the merchant app (default `http://localhost:3004`) |

## How it fits the system

```
shopping storefront ──(@irion/sdk)──► merchant /api ──► creates a bill
                                                          │
consumer  ───────────────────────────────────────────────► core /pay/[hash]  (Direct / BNPL / Credit)
                                                          │
core /app + /pay  ── prepare → user signs → execute ─────► irion-b2b-api :8088 ─► Canton ledger ─► Irion Daml protocol
```

- The wallet + checkout call `../irion-b2b-api`'s public `/v1/wallet/*` and `/pay/*` endpoints; the
  shopper signs, the operator mediates the protocol side.
- The Daml protocol behind it lives in `../irion-contracts-canton`.

## Layout

| Path | What |
|---|---|
| `app/app/` | Carpincho wallet (`ConsumerApp.tsx`) |
| `app/pay/[hash]/` | hosted checkout (`CantonCheckout.tsx`) |
| `app/api/bills/` | bills create/resolve API (MongoDB) |
| `lib/canton-pay.ts` | command builders + prepare/execute helpers against the b2b-api |
| `lib/canton-connect-kit/`, `lib/mongodb.ts` | wallet connect glue · Mongo client |

> **Note (Canton-only):** all Stellar / Soroban / Privy / ZK code was purged in the 2026-06-26 audit;
> this app is Canton-only.
