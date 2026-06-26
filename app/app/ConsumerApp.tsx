"use client"

import { useEffect, useState } from "react"
import {
  Wallet, ShieldCheck, Coins, TrendingUp, CreditCard, Droplets, ArrowDownToLine,
  AlertCircle, Loader2, Lock, RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import {
  ConnectKitProvider, useConnect, useExecute, useParty, useWalletStatus,
} from "@/lib/canton-connect-kit"
import type { ConnectKitConfig } from "@/lib/canton-connect-kit"
import {
  fetchOperatorParty, buildBnplCommand, completeBorrow, faucet, getPositions,
  buildRepayCommand, repayContext, type Positions, type ConsumerLoan,
} from "@/lib/canton-pay"

const CONNECT_CONFIG: ConnectKitConfig = {
  appName: "Irion Wallet",
  appDescription: "Private lending & credit on Canton",
  network: "canton:irion-sandbox",
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

const log = (...a: unknown[]) => console.log("%c[irion/app]", "color:#a6f24a;font-weight:bold", ...a)

const fmt = (n: number | undefined): string =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"

// Per-action flow identifiers (drives the busy spinner + disabled state).
type Flow = "faucet" | "borrow" | { repay: string }
const sameFlow = (a: Flow | null, b: Flow): boolean => {
  if (a === null) return false
  if (typeof a === "string" || typeof b === "string") return a === b
  return a.repay === b.repay
}

export default function ConsumerApp() {
  return (
    <ConnectKitProvider config={CONNECT_CONFIG}>
      <WalletInner />
    </ConnectKitProvider>
  )
}

function WalletInner() {
  const { connect, isConnecting, isConnected, connectError } = useConnect()
  const { party } = useParty()
  const { isLocked } = useWalletStatus()
  const { execute } = useExecute()

  const [operator, setOperator] = useState<string | undefined>(undefined)
  const [setupError, setSetupError] = useState<string | undefined>(undefined)
  const [positions, setPositions] = useState<Positions | null>(null)
  const [loadingPositions, setLoadingPositions] = useState(false)
  const [busy, setBusy] = useState<Flow | null>(null)
  const [amount, setAmount] = useState<number>(25)

  // Resolve the operator party (needed to borrow) on mount.
  useEffect(() => {
    log("fetching operator party from b2b…")
    void fetchOperatorParty()
      .then((op) => { log("operator party:", op); setOperator(op); setSetupError(undefined) })
      .catch((e: unknown) => { console.error("[irion/app] operator fetch failed:", e); setSetupError(errMsg(e)) })
  }, [])

  useEffect(() => {
    if (isConnected && party) { log("connected as", party.partyId); toast.success("Carpincho connected") }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected])

  useEffect(() => {
    // Only surface a connect error if we're actually NOT connected (ignore stale errors after a successful retry).
    if (connectError && !isConnected) { console.error("[irion/app] connect error:", connectError); toast.error(errMsg(connectError)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectError])

  // Load on-ledger positions whenever the connected party changes.
  useEffect(() => {
    if (party) void reload()
    else setPositions(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party?.partyId])

  async function reload(): Promise<void> {
    if (!party) return
    setLoadingPositions(true)
    try {
      log("loading positions for", party.partyId)
      const p = await getPositions(party.partyId)
      log("positions:", p)
      setPositions(p)
    } catch (e) {
      console.error("[irion/app] positions load failed:", e)
      toast.error(errMsg(e))
    } finally {
      setLoadingPositions(false)
    }
  }

  const onConnect = (): void => {
    log("connecting Carpincho…")
    toast.info("Connecting Carpincho…")
    void connect("extension").catch((e: unknown) => { console.error("[irion/app] connect failed:", e); toast.error(errMsg(e)) })
  }

  // Mint test USDC — operator-signed, no user signature needed.
  const onFaucet = async (): Promise<void> => {
    if (!party) return
    setBusy("faucet")
    try {
      log("faucet 100 USDC →", party.partyId)
      await faucet(party.partyId, 100)
      toast.success("Minted 100 USDC")
      await reload()
    } catch (e) {
      console.error("[irion/app] faucet failed:", e)
      toast.error(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  // Borrow against the credit line: sign an UnsecuredRequest, then the operator
  // ensures credit + accepts it → a Loan disburses USDC to the wallet.
  const onBorrow = async (): Promise<void> => {
    if (!party || operator === undefined || amount <= 0) return
    setBusy("borrow")
    try {
      log("borrow on credit", { operator, borrower: party.partyId, amount })
      toast.info("Approve in Carpincho…")
      const res = await execute({ commands: [buildBnplCommand({ operator, borrower: party.partyId, amount })] })
      log("signed + executed:", res)
      await completeBorrow(party.partyId)
      toast.success(`Borrowed ${amount} USDC`)
      await reload()
    } catch (e) {
      console.error("[irion/app] borrow failed:", e)
      toast.error(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  // Repay a loan: fetch the cids, then self-sign Loan_Pay in Carpincho.
  const onRepay = async (loan: ConsumerLoan): Promise<void> => {
    if (!party) return
    setBusy({ repay: loan.id })
    try {
      log("repay", { loan: loan.id, amount: loan.outstanding })
      const ctx = await repayContext(party.partyId, loan.id, loan.outstanding)
      log("repay context:", ctx)
      toast.info("Approve repayment in Carpincho…")
      const res = await execute({ commands: [buildRepayCommand(party.partyId, ctx, loan.outstanding)] })
      log("repaid:", res)
      toast.success("Repaid ✓")
      await reload()
    } catch (e) {
      console.error("[irion/app] repay failed:", e)
      toast.error(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  const credit = positions?.credit ?? null
  const creditAvailable = credit ? (credit.available ?? credit.creditLimit - credit.outstanding) : undefined

  return (
    <div className="max-w-3xl mx-auto mt-12 flex flex-col gap-6 text-white font-mono">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-black uppercase tracking-tighter">Your Wallet</h1>
          <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 rounded px-2 py-1">Canton · private</span>
        </div>
        {isConnected && party && (
          <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest flex items-center gap-1.5">
            {short(party.partyId)} <span className="text-primary">{isLocked ? "🔒" : "🔓"}</span>
          </span>
        )}
      </div>

      {setupError !== undefined && <Warn icon={<AlertCircle size={14} />}>Operator unavailable: {setupError}</Warn>}

      {!isConnected ? (
        /* ── Disconnected ─────────────────────────────────────────────── */
        <div className="glass-card rounded-lg border border-white/10 p-8 flex flex-col items-center text-center gap-6 shadow-2xl">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center"><Wallet className="w-9 h-9 text-primary" /></div>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-black uppercase tracking-tighter">Connect Carpincho</h2>
            <p className="text-[10px] text-white/40 uppercase font-bold">Private lending & credit on Canton.</p>
          </div>
          <button onClick={onConnect} disabled={isConnecting} className="w-full max-w-xs py-4 rounded-xl bg-primary text-black font-black text-xs uppercase tracking-[0.2em] hover:scale-[1.02] disabled:opacity-40 transition-all flex items-center justify-center gap-2">
            {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />} {isConnecting ? "Connecting…" : "Connect Carpincho"}
          </button>
          <Warn icon={<Wallet size={14} />}>Connect Carpincho to use your wallet on Canton. Set its <code>walletServiceRpcUrl</code> to the Irion wallet-service first.</Warn>
          {connectError !== undefined && <Warn icon={<AlertCircle size={14} />}>{errMsg(connectError)}</Warn>}
        </div>
      ) : (
        /* ── Connected ────────────────────────────────────────────────── */
        <div className="flex flex-col gap-6">
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Kpi icon={<Coins className="w-4 h-4 text-primary" />} label="USDC Balance" value={`${fmt(positions?.balance)} USDC`} loading={loadingPositions} />
            <Kpi
              icon={<CreditCard className="w-4 h-4 text-primary" />}
              label="Credit Line"
              value={credit ? `${fmt(creditAvailable)} / ${fmt(credit.creditLimit)}` : "No profile"}
              sub={credit ? `available · score ${credit.score}` : "No credit profile yet"}
              loading={loadingPositions}
            />
            <Kpi icon={<TrendingUp className="w-4 h-4 text-primary" />} label="Yield" value={`${fmt(positions?.yield.value)} USDC`} loading={loadingPositions} />
          </div>

          {/* Faucet + Borrow */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Faucet */}
            <div className="glass-card rounded-lg border border-white/10 p-5 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/60"><Droplets className="w-4 h-4 text-primary" /> Faucet</div>
              <p className="text-[10px] text-white/40 normal-case leading-relaxed font-medium">Mint test USDC to your wallet. Operator-signed — no signature needed.</p>
              <button onClick={() => void onFaucet()} disabled={busy !== null} className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white font-black text-[11px] uppercase tracking-[0.15em] hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                {sameFlow(busy, "faucet") ? <Loader2 className="w-4 h-4 animate-spin" /> : <Droplets className="w-4 h-4" />} Mint 100 USDC
              </button>
            </div>

            {/* Borrow */}
            <div className="glass-card rounded-lg border border-primary/20 p-5 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary"><ShieldCheck className="w-4 h-4" /> Borrow on Credit</div>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={1} value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  disabled={busy !== null}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-black text-white outline-none focus:border-primary/50 disabled:opacity-40"
                />
                <span className="text-[10px] text-white/40 font-bold uppercase">USDC</span>
              </div>
              <button onClick={() => void onBorrow()} disabled={busy !== null || operator === undefined || amount <= 0} className="w-full py-3 rounded-xl bg-primary text-black font-black text-[11px] uppercase tracking-[0.15em] hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                {sameFlow(busy, "borrow") ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Borrow on Credit
              </button>
            </div>
          </div>

          {/* Loans */}
          <div className="glass-card rounded-lg border border-white/10 overflow-hidden shadow-xl">
            <div className="bg-white/5 px-5 py-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/60 flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" /> Loans</span>
              <button onClick={() => void reload()} disabled={loadingPositions} className="text-[9px] font-bold uppercase tracking-widest text-white/40 hover:text-primary disabled:opacity-40 transition-colors flex items-center gap-1.5">
                <RefreshCw className={`w-3 h-3 ${loadingPositions ? "animate-spin" : ""}`} /> Reload
              </button>
            </div>
            {!positions || positions.loans.length === 0 ? (
              <div className="px-5 py-10 flex flex-col items-center text-center gap-2">
                <ArrowDownToLine className="w-8 h-8 text-white/20" />
                <p className="text-[10px] text-white/40 uppercase font-bold tracking-wide">{loadingPositions ? "Loading loans…" : "No loans yet — borrow on credit above."}</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {positions.loans.map((loan) => {
                  const repayable = loan.status === "active" || loan.outstanding > 0
                  const repaying = sameFlow(busy, { repay: loan.id })
                  return (
                    <div key={loan.id} className="px-5 py-4 flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-white">{fmt(loan.principal)} USDC</span>
                          <span className={`text-[8px] font-black uppercase tracking-widest rounded px-1.5 py-0.5 border ${repayable ? "text-primary bg-primary/10 border-primary/20" : "text-white/40 bg-white/5 border-white/10"}`}>{loan.status}</span>
                        </div>
                        <span className="text-[9px] text-white/40 font-bold uppercase tracking-wide">Outstanding {fmt(loan.outstanding)} USDC · {short(loan.id, 8, 6)}</span>
                      </div>
                      {repayable && (
                        <button onClick={() => void onRepay(loan)} disabled={busy !== null} className="flex-shrink-0 py-2 px-4 rounded-lg bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-[0.15em] hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                          {repaying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowDownToLine className="w-3.5 h-3.5" />} Repay
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <p className="text-[8px] text-center text-white/25 uppercase font-bold tracking-[0.1em] leading-relaxed flex items-center justify-center gap-1">
            <Lock className="w-2.5 h-2.5" /> You sign with your own key. Private by construction on the Canton ledger.
          </p>
        </div>
      )}
    </div>
  )
}

function Kpi({ icon, label, value, sub, loading }: { icon: React.ReactNode; label: string; value: string; sub?: string; loading?: boolean }) {
  return (
    <div className="glass-card rounded-lg border border-white/10 p-5 flex flex-col gap-2 shadow-xl">
      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-white/40">{icon} {label}</div>
      {loading ? (
        <Loader2 className="w-5 h-5 text-primary/60 animate-spin mt-1" />
      ) : (
        <>
          <span className="text-xl font-black text-white tracking-tighter">{value}</span>
          {sub && <span className="text-[9px] text-white/40 font-bold uppercase tracking-wide normal-case">{sub}</span>}
        </>
      )}
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
