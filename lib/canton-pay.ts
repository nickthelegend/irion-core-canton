// Canton payment helpers for the hosted /pay checkout.
//
// This is the REAL Canton path (replacing the Soroban lib/irion.ts for checkout):
// the shopper connects Carpincho, signs an `UnsecuredRequest` on `#irion-model`
// with their own Ed25519 key, and the Irion operator (irion-b2b-api) completes it
// — opening a credit profile, attesting a score, and accepting the request so a
// real `Loan` disburses on the live Canton ledger. Verified end-to-end headlessly
// (see irion-b2b-api/src/verify-rpc-path.ts).

/** The Irion operator backend (holds the operator party; mediates accepts). */
export const B2B_API_URL =
  process.env.NEXT_PUBLIC_B2B_API_URL ?? 'http://localhost:8088'

const UNSECURED_REQUEST_TID = '#irion-model:Irion.Bnpl:UnsecuredRequest'

/** Fetch the live Irion operator partyId from the b2b-api (survives re-bootstraps). */
export async function fetchOperatorParty(): Promise<string> {
  const r = await fetch(`${B2B_API_URL}/v1/health`)
  if (!r.ok) throw new Error(`operator lookup failed (${r.status}) — is the Irion API on :8088?`)
  const h = (await r.json()) as { operator?: string }
  if (!h.operator) throw new Error('Irion API returned no operator party')
  return h.operator
}

/**
 * Build the user-signed BNPL action: a `CreateCommand` for an UnsecuredRequest,
 * authorized by the shopper's own Canton party (the connected Carpincho wallet).
 * Solo-signable — no escrow token needed at create.
 */
export function buildBnplCommand(opts: {
  operator: string
  borrower: string
  amount: number
  termDays?: number
}): unknown {
  return {
    CreateCommand: {
      templateId: UNSECURED_REQUEST_TID,
      createArguments: {
        operator: opts.operator,
        borrower: opts.borrower,
        amount: String(opts.amount).includes('.') ? String(opts.amount) : `${opts.amount}.0`,
        termSeconds: String((opts.termDays ?? 30) * 86400),
      },
    },
  }
}

export type CheckoutMode = "direct" | "bnpl" | "credit"

export interface CheckoutResult {
  status: string
  mode: string
  amount: number
  txHash: string
  loanId: string | null
  merchantPaid: boolean
}

/**
 * Settle a checkout after the shopper authorized it in Carpincho. For
 * credit/bnpl the shopper has already signed an UnsecuredRequest; the operator
 * accepts it (a PRIVATE loan the shopper owes) and pays the merchant. For direct,
 * the merchant is paid in full. Returns the on-ledger result.
 */
export async function settleCheckout(opts: {
  party: string
  merchant?: string
  amount: number
  mode: CheckoutMode
  billHash?: string
  txHash?: string
}): Promise<CheckoutResult> {
  const r = await fetch(`${B2B_API_URL}/v1/wallet/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  })
  const body = (await r.json().catch(() => ({}))) as Partial<CheckoutResult> & { error?: string; detail?: string }
  if (!r.ok || body.error !== undefined) {
    throw new Error(body.error ?? body.detail ?? `checkout failed (${r.status})`)
  }
  return body as CheckoutResult
}

export interface BnplResult {
  status: string
  borrower: string
  loanId: string
  amount: number
}

/**
 * After the shopper SIGNS the request in Carpincho, ask the operator to complete
 * it: ensure credit eligibility + accept the pending request → a real Loan
 * disburses on the ledger.
 */
export async function completeBnplLoan(party: string): Promise<BnplResult> {
  const r = await fetch(`${B2B_API_URL}/v1/wallet/bnpl/complete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ party }),
  })
  const body = (await r.json().catch(() => ({}))) as Partial<BnplResult> & { error?: string; detail?: string }
  if (!r.ok || body.error !== undefined) {
    throw new Error(body.error ?? body.detail ?? `loan completion failed (${r.status})`)
  }
  return body as BnplResult
}

// ── Consumer wallet: faucet · positions · borrow · repay ────────────────────
const dec = (n: number): string => (String(n).includes(".") ? String(n) : `${n}.0`)

async function jpost<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${B2B_API_URL}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  const j = (await r.json().catch(() => ({}))) as any
  if (!r.ok || j.error) throw new Error(j.error ?? `${path} failed (${r.status})`)
  return j as T
}

export interface ConsumerLoan { id: string; principal: number; outstanding: number; principalRepaid: number; kind: string; status: string; merchant?: string }
export interface Positions {
  party: string
  balance: number
  yield: { shares: number; value: number }
  loans: ConsumerLoan[]
  credit: { creditLimit: number; outstanding: number; available?: number; score: number } | null
}
export interface RepayContext { loanCid: string; payTokenCid: string; poolCid: string; profileCid: string; configCid: string }

/** Mint test USDC to the wallet (operator-signed; no user signature needed). */
export const faucet = (party: string, amount = 100) => jpost<{ balance: number }>("/v1/wallet/faucet", { party, amount })

/** Supply USDC to the yield pool to earn yield (demo: operator-mediated like the
 * faucet; the on-ledger effect is a REAL SupplyRequest+accept → PoolShare). */
export const supply = (party: string, amount: number) => jpost<{ shares: number; amount: number; status: string }>("/v1/wallet/supply", { party, amount })

/** Redeem the wallet's yield position back to USDC. */
export const redeemYield = (party: string) => jpost<{ status: string; balance: number }>("/v1/wallet/redeem", { party })

/** Read the wallet's full on-ledger position. */
export async function getPositions(party: string): Promise<Positions> {
  const r = await fetch(`${B2B_API_URL}/v1/wallet/positions?party=${encodeURIComponent(party)}`)
  const j = (await r.json().catch(() => ({}))) as any
  if (!r.ok || j.error) throw new Error(j.error ?? `positions failed (${r.status})`)
  return j as Positions
}

/** Borrow against the credit line: the wallet has already signed an UnsecuredRequest;
 * the operator ensures credit + accepts it → a Loan disburses USDC to the wallet. */
export const completeBorrow = (party: string) => jpost<BnplResult>("/v1/wallet/bnpl/complete", { party })

/** Get the cids the wallet needs to self-sign Loan_Pay. */
export const repayContext = (party: string, loanId: string, amount: number) =>
  jpost<RepayContext>("/v1/wallet/repay/context", { party, loanId, amount })

/** Build the user-signed Loan_Pay command (repay). */
export function buildRepayCommand(party: string, ctx: RepayContext, amount: number): unknown {
  return {
    ExerciseCommand: {
      templateId: "#irion-model:Irion.Bnpl:Loan",
      contractId: ctx.loanCid,
      choice: "Loan_Pay",
      choiceArgument: { payer: party, payTokenCid: ctx.payTokenCid, amount: dec(amount), poolCid: ctx.poolCid, profileCid: ctx.profileCid, configCid: ctx.configCid },
    },
  }
}

// ── Direct checkout: a REAL self-custody debit (shopper signs Token_Transfer → merchant) ──
const TOKEN_TID = "#irion-model:Irion.Token:Token"

/** Operator funds the shopper `amount` (demo on-ramp) and returns the token cid
 * the shopper then transfers to the merchant — the real settlement is the
 * shopper-signed transfer below, not an operator mint-to-merchant. */
export const prepareDirect = (party: string, amount: number) =>
  jpost<{ tokenCid: string; amount: number }>("/v1/wallet/direct/prepare", { party, amount })

/** Build the user-signed Token_Transfer for a direct payment to the merchant. */
export function buildDirectCommand(tokenCid: string, merchant: string): unknown {
  return { ExerciseCommand: { templateId: TOKEN_TID, contractId: tokenCid, choice: "Token_Transfer", choiceArgument: { newOwner: merchant } } }
}

// ── Consumer supply: earn yield (shopper signs escrow + SupplyRequest; operator accepts) ──
// Uses the EXISTING Pool templates — the same request/accept pattern as BNPL, so no
// Daml SupplyDirect choice / DAR rebuild is needed (verified headlessly in the b2b-api).
const SUPPLY_REQUEST_TID = "#irion-model:Irion.Pool:SupplyRequest"

export interface SupplyContext { operator: string; usdcIssuer: string }

/** Parties the wallet needs to build the supply commands. */
export const supplyContext = async (): Promise<SupplyContext> => {
  const r = await fetch(`${B2B_API_URL}/v1/wallet/supply/context`)
  if (!r.ok) throw new Error(`supply context failed (${r.status})`)
  return (await r.json()) as SupplyContext
}

/** Step 1: escrow the supply amount to the operator (shopper signs a Token_Transfer). */
export function buildSupplyEscrowCommand(tokenCid: string, operator: string): unknown {
  return { ExerciseCommand: { templateId: TOKEN_TID, contractId: tokenCid, choice: "Token_Transfer", choiceArgument: { newOwner: operator } } }
}

/** Step 2: create the SupplyRequest the operator will accept (shopper signs). */
export function buildSupplyRequestCommand(opts: { operator: string; supplier: string; usdcIssuer: string; amount: number; escrowCid: string }): unknown {
  return {
    CreateCommand: {
      templateId: SUPPLY_REQUEST_TID,
      createArguments: { operator: opts.operator, supplier: opts.supplier, usdcIssuer: opts.usdcIssuer, amount: dec(opts.amount), escrowCid: opts.escrowCid },
    },
  }
}

/** After the shopper signs both steps, the operator accepts → a PoolShare (yield position). */
export const completeSupply = (party: string) =>
  jpost<{ status: string; supplier: string; shares: number }>("/v1/wallet/supply/complete", { party })
