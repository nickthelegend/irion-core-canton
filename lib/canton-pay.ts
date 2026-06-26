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
