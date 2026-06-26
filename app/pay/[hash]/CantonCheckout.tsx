"use client"

import { useEffect, useState } from "react"
import {
  ShieldCheck, Zap, AlertCircle, CheckCircle2, Loader2, Wallet, Lock, CreditCard, Clock,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ConnectKitProvider, useConnect, useExecute, useParty, useSignMessage, useWalletStatus,
} from "@/lib/canton-connect-kit"
import type { ConnectKitConfig } from "@/lib/canton-connect-kit"
import { buildBnplCommand, fetchOperatorParty, settleCheckout, type CheckoutMode } from "@/lib/canton-pay"

const CONNECT_CONFIG: ConnectKitConfig = {
  appName: "Irion Checkout",
  appDescription: "Private BNPL & credit on the Canton Network",
  network: "canton:irion-sandbox",
}

export interface CantonBill {
  amount: number
  merchant: string
  description?: string
  hash?: string
  party?: string           // merchant's Canton settlement party
  methods?: CheckoutMode[] // which methods the merchant enabled
}

const short = (s: string, head = 12, tail = 8): string =>
  s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`

// Never render "[object Object]" — coerce anything to a readable message.
function errMsg(e: unknown): string {
  if (e == null) return "Unknown error"
  if (typeof e === "string") return e
  if (e instanceof Error) return typeof e.message === "string" ? e.message : JSON.stringify(e.message)
  if (typeof e === "object") {
    const o = e as Record<string, unknown>
    const m = o.message ?? o.error ?? o.reason ?? o.detail
    if (typeof m === "string") return m
    try { return JSON.stringify(e) } catch { return String(e) }
  }
  return String(e)
}

const log = (...a: unknown[]) => console.log("%c[irion/pay]", "color:#a6f24a;font-weight:bold", ...a)

// Method metadata, in display order (Credit first — the private headline).
const METHODS: Record<CheckoutMode, { label: string; tag: string; blurb: string; icon: typeof Zap; primary?: boolean }> = {
  credit: { label: "Pay with Private Credit", tag: "Private", blurb: "Your attested credit line covers it — income & balances stay private by construction.", icon: ShieldCheck, primary: true },
  bnpl: { label: "Buy Now, Pay Never", tag: "BNPL", blurb: "The pool pays the merchant now; repay from yield, anytime, on /credit.", icon: Clock },
  direct: { label: "Pay in Full", tag: "Direct", blurb: "Settle the full amount now in USDC on Canton.", icon: CreditCard },
}
const ORDER: CheckoutMode[] = ["credit", "bnpl", "direct"]

export default function CantonCheckout({ bill }: { bill: CantonBill }) {
  return (
    <ConnectKitProvider config={CONNECT_CONFIG}>
      <CheckoutInner bill={bill} />
    </ConnectKitProvider>
  )
}

function CheckoutInner({ bill }: { bill: CantonBill }) {
  const { connect, isConnecting, isConnected, connectError } = useConnect()
  const { party } = useParty()
  const { isLocked } = useWalletStatus()
  const { execute } = useExecute()
  const { signMessage } = useSignMessage()

  const [operator, setOperator] = useState<string | undefined>(undefined)
  const [setupError, setSetupError] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState<CheckoutMode | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)
  const [success, setSuccess] = useState<null | { mode: CheckoutMode; txHash: string; loanId: string | null }>(null)

  const enabled = (bill.methods && bill.methods.length ? bill.methods : (["credit", "bnpl", "direct"] as CheckoutMode[]))
  const methods = ORDER.filter((m) => enabled.includes(m))

  useEffect(() => {
    log("bill:", bill)
    log("fetching operator party from b2b…")
    void fetchOperatorParty()
      .then((op) => { log("operator party:", op); setOperator(op); setSetupError(undefined) })
      .catch((e: unknown) => { console.error("[irion/pay] operator fetch failed:", e); setSetupError(errMsg(e)) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isConnected && party) { log("connected as", party.partyId); toast.success("Carpincho connected") }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected])

  useEffect(() => {
    // Only surface a connect error if we're actually NOT connected (ignore stale errors after a successful retry).
    if (connectError && !isConnected) { console.error("[irion/pay] connect error:", connectError); toast.error(errMsg(connectError)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectError])

  const notifyOpener = (txHash: string, mode: CheckoutMode) => {
    if (typeof window !== "undefined" && window.opener) {
      window.opener.postMessage(
        { type: "IRION_PAYMENT_RESULT", success: true, txHash, amount: bill.amount, paymentMode: mode === "direct" ? "direct" : "bnpl" },
        "*",
      )
      log("posted IRION_PAYMENT_RESULT to opener", { txHash, mode })
    }
  }

  const onConnect = (): void => {
    log("connecting Carpincho…")
    toast.info("Connecting Carpincho…")
    void connect("extension").catch((e: unknown) => { console.error("[irion/pay] connect failed:", e); toast.error(errMsg(e)) })
  }

  const pay = async (mode: CheckoutMode): Promise<void> => {
    if (party === undefined) return
    log(`pay → ${mode}`, { amount: bill.amount, merchant: bill.party, customer: party.partyId })
    setBusy(mode); setError(undefined)
    try {
      if (mode === "credit" || mode === "bnpl") {
        if (operator === undefined) throw new Error("Operator unavailable — is the Irion API (:8088) running?")
        toast.info("Approve the loan request in Carpincho…")
        log("execute UnsecuredRequest (sign in Carpincho)…")
        const res = await execute({ commands: [buildBnplCommand({ operator, borrower: party.partyId, amount: bill.amount })] })
        log("signed + executed:", res)
        toast.success("Loan request signed ✓")
      } else {
        toast.info("Authorize the payment in Carpincho…")
        log("signMessage (authorize direct payment)…")
        const sig = await signMessage(`Authorize ${bill.amount} USDC to ${bill.merchant} on Canton`)
        log("signed message:", sig)
        toast.success("Payment authorized ✓")
      }
      toast.info("Settling on Canton…")
      log("settleCheckout via b2b…")
      const r = await settleCheckout({ party: party.partyId, merchant: bill.party, amount: bill.amount, mode, billHash: bill.hash })
      log("settled:", r)
      setSuccess({ mode, txHash: r.txHash, loanId: r.loanId })
      toast.success(`Paid ${bill.amount} USDC — settled on Canton`)
      notifyOpener(r.txHash, mode)
    } catch (e) {
      console.error(`[irion/pay] ${mode} failed:`, e)
      const msg = errMsg(e)
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(null)
    }
  }

  if (success) {
    const meta = METHODS[success.mode]
    return (
      <div className="max-w-md mx-auto mt-12 glass-card rounded-lg border border-primary/30 p-8 flex flex-col items-center text-center gap-6 shadow-[0_0_50px_-12px_rgba(34,197,94,0.3)] text-white">
        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center"><CheckCircle2 className="w-10 h-10 text-primary" /></div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black uppercase tracking-tighter">{success.mode === "direct" ? "Payment_Settled" : "Bought_On_Credit"}</h1>
          <p className="text-[10px] text-white/40 uppercase">{meta.tag} · settled on Canton{success.loanId ? " · repay anytime on /credit" : ""}.</p>
        </div>
        <div className="w-full bg-white/5 border border-white/10 p-4 rounded flex flex-col gap-3">
          <Row label="Merchant" value={bill.merchant} />
          <Row label="Amount" value={`${bill.amount} USDC`} accent />
          <Row label={success.loanId ? "Loan" : "Ref"} value={short(success.txHash)} />
        </div>
        {success.loanId && (
          <Link href="/credit" className="w-full bg-white/5 border border-white/10 py-3 rounded text-[10px] font-black uppercase text-white hover:bg-white/10 text-center">Manage / Repay Loan</Link>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-12 flex flex-col gap-6 text-white font-mono">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-black uppercase tracking-tighter">Checkout</h1>
        <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 rounded px-2 py-1">Canton · private</span>
      </div>

      <div className="glass-card rounded-lg border border-white/10 overflow-hidden shadow-2xl">
        <div className="bg-white/5 p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center font-bold text-primary uppercase">{bill.merchant?.[0] || "M"}</div>
            <div className="flex flex-col"><span className="text-xs font-black uppercase tracking-tight">{bill.merchant || "Merchant"}</span><span className="text-[9px] text-white/40 uppercase font-bold">Canton Network</span></div>
          </div>
          <div className="flex flex-col items-end"><span className="text-lg font-black text-white">{bill.amount}</span><span className="text-[10px] text-white/40 font-bold uppercase">USDC</span></div>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Description</span>
            <p className="text-xs text-white/80 leading-relaxed font-medium">{bill.description || "Purchase via Irion on Canton."}</p>
          </div>

          {/* Wallet panel */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-primary" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-white uppercase tracking-wide">Carpincho Wallet</span>
                <span className="text-[9px] text-primary font-bold uppercase tracking-widest">
                  {isConnected && party ? `${short(party.partyId)} · ${isLocked ? "🔒 locked" : "🔓 ready"}` : "Not connected"}
                </span>
              </div>
            </div>
            <Zap className="w-4 h-4 text-primary animate-pulse" />
          </div>

          {!isConnected && <Warn icon={<Wallet size={14} />}>Connect Carpincho to check out on Canton. Set its <code>walletServiceRpcUrl</code> to the Irion wallet-service first.</Warn>}
          {!isConnected && connectError !== undefined && <Warn icon={<AlertCircle size={14} />}>{errMsg(connectError)}</Warn>}
          {setupError !== undefined && <Warn icon={<AlertCircle size={14} />}>Operator unavailable: {setupError}</Warn>}
          {error !== undefined && <Warn icon={<AlertCircle size={14} />}>{error}</Warn>}

          {/* Actions */}
          {!isConnected ? (
            <button onClick={onConnect} disabled={isConnecting} className="w-full py-4 rounded-xl bg-primary text-black font-black text-xs uppercase tracking-[0.2em] hover:scale-[1.02] disabled:opacity-40 transition-all flex items-center justify-center gap-2">
              {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />} {isConnecting ? "Connecting…" : "Connect Carpincho"}
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              {methods.map((m) => {
                const meta = METHODS[m]
                const Icon = meta.icon
                const disabled = busy !== null || bill.amount <= 0 || ((m === "credit" || m === "bnpl") && operator === undefined)
                return (
                  <button key={m} onClick={() => void pay(m)} disabled={disabled}
                    className={`w-full p-4 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${meta.primary ? "bg-primary/10 border-primary/40 hover:bg-primary/20" : "bg-white/5 border-white/10 hover:bg-white/10"} disabled:opacity-40 disabled:cursor-not-allowed`}>
                    <div className="flex items-center justify-between">
                      <span className={`flex items-center gap-2 font-black text-xs uppercase tracking-[0.15em] ${meta.primary ? "text-primary" : "text-white"}`}>
                        {busy === m ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />} {meta.label}
                      </span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/40 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">{meta.tag}</span>
                    </div>
                    <span className="text-[10px] text-white/45 leading-relaxed normal-case font-medium">{meta.blurb}</span>
                  </button>
                )
              })}
              <p className="text-[8px] text-center text-white/25 uppercase font-bold tracking-[0.1em] leading-relaxed flex items-center justify-center gap-1">
                <Lock className="w-2.5 h-2.5" /> You sign with your own key. Settles on the Canton ledger, private by construction.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center text-[10px] uppercase font-bold">
      <span className="text-white/40">{label}</span>
      <span className={accent ? "text-primary font-black" : "text-white font-black"}>{value}</span>
    </div>
  )
}

function Warn({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded px-4 py-3 text-[10px] uppercase tracking-wide font-bold text-amber-400/90">
      <span className="flex-shrink-0">{icon}</span> {children}
    </div>
  )
}
