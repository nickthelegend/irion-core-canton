# Irion Core

### Buy Now, Pay Never.

The consumer app for **Irion** — private consumer credit on the **Canton Network**. A self-custody
wallet and a Stripe-style hosted checkout, both settling real transactions against the Irion Daml
protocol. Positions are **private by construction**: your loans, credit score, and pool shares live
in Daml contracts visible only to you and the operator — no zero-knowledge circuits, no public
ledger trail.

> Part of the Irion monorepo. Sibling repos: [`irion-b2b-api`](../irion-b2b-api) (the REST API this
> app calls), [`irion-contracts-canton`](../irion-contracts-canton) (the Daml protocol),
> [`irion-merchant-app-canton`](../irion-merchant-app-canton) (the merchant console that issues
> checkout bills), and [`irion-sdk-canton`](../irion-sdk-canton) (the drop-in shops use to create
> those bills).

---

## What it is

A single Next.js 15 app serving three consumer surfaces:

- **Marketing landing** at `/` — the "Buy Now, Pay Never" hero, how-it-works, and FAQ.
- **The wallet** at `/app` — a self-custody **Carpincho** wallet, split into focused routes that
  share one ledger connection.
- **Hosted checkout** at `/pay/[hash]` — the payment page a merchant redirects shoppers to.

Brand: lime-green accent (`#a6f24a`) on near-black, with mono + Inter type.

## The wallet

`/app` redirects to `/borrow`. All wallet routes live under a `(wallet)` route group, so they share
a single wallet connection (one connect, navigate freely). The header nav is **Borrow · Lend ·
Credit · Positions · Activity · Faucet**.

| Route | What you do |
|---|---|
| **`/borrow`** | Draw on a private credit line — sign an `UnsecuredRequest`. |
| **`/lend`** | Supply USDC to the lending pool to earn yield, and withdraw. Includes a "Simulate Yield" demo button. Self-custody (two signatures). |
| **`/credit`** | Your private credit score and limit dashboard. |
| **`/positions`** | A table of open loans and your pool position. |
| **`/activity`** | An on-ledger activity feed. |
| **`/faucet`** | Mint test USDC to play with. |

Every wallet action is **self-custody (CIP-0103)**: the app builds the exact command, **Carpincho
signs it**, and the operator executes — the platform never holds your key. Wallet flows route through
Carpincho → the Irion wallet-service gateway → the [b2b-api](../irion-b2b-api) on `:8088`.

`lib/canton-pay.ts` builds the precise commands the shopper signs — `buildBnplCommand`,
`buildRepayCommand`, `buildDirectCommand`, `buildSupplyEscrowCommand`, `buildSupplyRequestCommand`,
`buildWithdrawRequestCommand` — and is unit-tested.

## How checkout works

A shop creates a bill through the [`@irion/sdk`](../irion-sdk-canton) →
[merchant](../irion-merchant-app-canton) chain, then redirects the shopper to `/pay/[hash]`. The
checkout offers three methods, each signed by the shopper via Carpincho:

- **Direct** — a real shopper-signed `Token_Transfer` of USDC to the merchant.
- **BNPL** — the lending pool pays the merchant now; the shopper repays from yield, anytime.
- **Credit** — the shopper's private credit line covers it; income and balances stay private.

On success the page posts an `IRION_PAYMENT_RESULT` message back to the opener window — what the
`@irion/sdk` drop-in listens for.

## Privacy by construction

Privacy isn't bolted on — it's how Canton works. A Daml contract is visible only to its signatory
and observer parties. A borrower's `CreditProfile` / `CreditAttestation` are signed by the operator
and observed only by the borrower, so a credit score, a loan, or a pool position is never visible to
anyone else and never written to a public ledger. The synchronizer that orders transactions sees
only encrypted commitments. This replaces the project's earlier zero-knowledge design.

## Getting started

```bash
npm install
npm run dev -- -p 3000      # http://localhost:3000
```

**Core MUST run on `:3000`.** Cross-app URLs hardcode it, and the b2b-api allows `:3000` as a
passkey/CORS origin.

You also need:

- **[`irion-b2b-api`](../irion-b2b-api) running on `:8088`** — the API the wallet and checkout call.
- **Carpincho** with its `walletServiceRpcUrl` pointed at the Irion wallet-service gateway, so
  prepare → sign → execute works end to end.

## Testing

```bash
npm test      # node:test via tsx
```

Covers the `lib/canton-pay.ts` command builders (the exact payloads the shopper signs, including
consumer supply) plus a Badge component render test.

## Project layout

| Path | What |
|---|---|
| `app/page.tsx` | Marketing landing (`/`). |
| `app/(wallet)/` | The wallet route group — `borrow`, `lend`, `credit`, `positions`, `activity`, `faucet`, sharing one connection. |
| `app/app/page.tsx` | Redirects `/app` → `/borrow`. |
| `app/pay/[hash]/` | Hosted checkout (`CantonCheckout.tsx`) — Direct / BNPL / Credit. |
| `app/api/bills/` | Bill create/resolve endpoints used by the storefront chain (MongoDB). |
| `lib/canton-pay.ts` | Command builders + prepare/execute helpers against the b2b-api (unit-tested). |
| `lib/canton-connect-kit/` | Carpincho wallet connect glue (CIP-0103). |

---

> **Canton-only.** All Stellar / Soroban / Privy / ZK code was purged in the 2026-06-26 audit. This
> app talks to one ledger: Canton.
