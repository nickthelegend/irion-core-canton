"use client"

// SSR-safe wallet context + shared UI. This file does NOT import the Carpincho
// connect-kit (which references browser globals and breaks SSR) — the provider
// that does lives in wallet-provider.tsx and is loaded client-only by the layout.
// Pages import the hook + UI from here.
import { createContext, useContext } from "react"
import { CreditCard, ArrowDownToLine, RefreshCw, Loader2 } from "lucide-react"
import type { Positions, ConsumerLoan } from "@/lib/canton-pay"

export const short = (s: string, head = 12, tail = 8): string =>
  s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`
export const fmt = (n: number | undefined): string =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"

export type Flow = "faucet" | "borrow" | "supply" | "redeem" | { repay: string }
export const sameFlow = (a: Flow | null, b: Flow): boolean => {
  if (a === null) return false
  if (typeof a === "string" || typeof b === "string") return a === b
  return a.repay === b.repay
}

export interface WalletCtx {
  party?: string
  operator?: string
  positions: Positions | null
  loading: boolean
  busy: Flow | null
  reload: () => Promise<void>
  isConnected: boolean
  connect: () => void
  onFaucet: (amount?: number) => Promise<void>
  onBorrow: (amount: number) => Promise<void>
  onRepay: (loan: ConsumerLoan) => Promise<void>
  onLend: (amount: number) => Promise<void>
  onRedeem: () => Promise<void>
}
export const Ctx = createContext<WalletCtx | null>(null)
export function useWallet(): WalletCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error("useWallet must be used inside the wallet layout")
  return c
}

// ── shared UI ──
export function Panel({ icon, title, children, accent, action }: { icon: React.ReactNode; title: string; children: React.ReactNode; accent?: boolean; action?: React.ReactNode }) {
  return (
    <div className={`glass-card rounded-lg border p-5 shadow-xl ${accent ? "border-primary/20" : "border-white/10"}`}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${accent ? "text-primary" : "text-white/60"}`}>{icon} {title}</div>
        {action}
      </div>
      {children}
    </div>
  )
}
export function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-black/20 border border-white/5 rounded-lg p-3">
      <div className="text-[9px] text-white/40 uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-lg font-black tracking-tighter ${accent ? "text-primary" : "text-white"}`}>{value}</div>
    </div>
  )
}
export function Kpi({ icon, label, value, sub, loading }: { icon: React.ReactNode; label: string; value: string; sub?: string; loading?: boolean }) {
  return (
    <div className="glass-card rounded-lg border border-white/10 p-5 flex flex-col gap-2 shadow-xl">
      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-white/40">{icon} {label}</div>
      {loading ? <Loader2 className="w-5 h-5 text-primary/60 animate-spin mt-1" /> : (<><span className="text-xl font-black text-white tracking-tighter">{value}</span>{sub && <span className="text-[9px] text-white/40 font-bold uppercase tracking-wide normal-case">{sub}</span>}</>)}
    </div>
  )
}
export function Warn({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded px-4 py-3 text-[10px] uppercase tracking-wide font-bold text-amber-400/90">
      <span className="flex-shrink-0">{icon}</span> {children}
    </div>
  )
}
export function LoansList({ title, loans, empty }: { title: string; loans: ConsumerLoan[]; empty: string }) {
  const { busy, onRepay, reload, loading } = useWallet()
  return (
    <div className="glass-card rounded-lg border border-white/10 overflow-hidden shadow-xl">
      <div className="bg-white/5 px-5 py-3 border-b border-white/10 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/60 flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" /> {title}</span>
        <button onClick={() => void reload()} disabled={loading} className="text-[9px] font-bold uppercase tracking-widest text-white/40 hover:text-primary disabled:opacity-40 transition-colors flex items-center gap-1.5">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Reload
        </button>
      </div>
      {loans.length === 0 ? (
        <div className="px-5 py-10 flex flex-col items-center text-center gap-2">
          <ArrowDownToLine className="w-8 h-8 text-white/20" />
          <p className="text-[10px] text-white/40 uppercase font-bold tracking-wide">{loading ? "Loading…" : empty}</p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {loans.map((loan) => {
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
  )
}
