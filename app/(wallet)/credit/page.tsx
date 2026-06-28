"use client"

import Link from "next/link"
import { ShieldCheck, Lock, Loader2, CreditCard, TrendingUp, RefreshCw, ArrowUpRight } from "lucide-react"
import { useWallet, sameFlow, short, fmt } from "../wallet"

const MIN_SCORE = 600

export default function CreditPage() {
  const { positions, loading, busy, reload, onRepay } = useWallet()
  const credit = positions?.credit ?? null
  const loans = (positions?.loans ?? []).filter((l) => l.status === "active" || l.outstanding > 0)
  const score = credit?.score ?? 0
  const scorePct = Math.min(100, (score / 850) * 100)
  const available = credit ? (credit.available ?? credit.creditLimit - credit.outstanding) : 0
  const repaidTotal = (positions?.loans ?? []).reduce((s, l) => s + (l.principalRepaid || 0), 0)

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">IRION // Private_Credit · canton</span>
          <h1 className="text-3xl tracking-tighter font-black uppercase">Credit Dashboard</h1>
        </div>
        <button onClick={() => void reload()} disabled={loading} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-5 py-2.5 text-[10px] uppercase tracking-widest font-bold transition-all disabled:opacity-40">
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Sync
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[["Credit_Limit", credit ? `${fmt(credit.creditLimit)} USDC` : "—"], ["Available", credit ? `${fmt(available)} USDC` : "—"], ["Outstanding", credit ? `${fmt(credit.outstanding)} USDC` : "—"], ["Repaid_Total", `${fmt(repaidTotal)} USDC`]].map(([l, v]) => (
          <div key={l} className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-5 flex flex-col gap-1"><span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">{l}</span><span className="text-2xl font-light tracking-tighter">{v}</span></div>
        ))}
      </div>

      {/* Private Daml credit score */}
      <div className="glass-card rounded-lg border border-primary/20 overflow-hidden shadow-[0_0_20px_rgba(166,242,74,0.05)]">
        <div className="bg-primary/5 px-5 py-2.5 border-b border-primary/10 flex justify-between items-center">
          <div className="flex items-center gap-2"><Lock className="size-3.5 text-primary" /><span className="text-[10px] text-primary/80 uppercase tracking-widest font-bold">Private_Credit_Score</span></div>
          <span className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-green-400 bg-green-500/10 border border-green-500/30 rounded-full px-2 py-1"><ShieldCheck className="size-3" /> Daml · Private by construction</span>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-[10px] text-white/40 leading-relaxed max-w-2xl">
            Your score is computed on-ledger from treasury depth + repayment history and lives in a private <span className="text-primary font-bold">CreditProfile</span> Daml contract — visible only to you and the operator, never the network. A score of at least {MIN_SCORE} unlocks unsecured borrowing.
          </p>
          {credit ? (
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-4 py-2"><ShieldCheck className="size-3.5 text-primary" /><span className="text-primary text-xl font-black tracking-tighter">{score}</span><span className="text-[9px] text-primary/50 ml-1">/ 850</span></div>
              <div className="flex-1 min-w-[120px]"><div className="h-2 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-primary transition-all duration-700" style={{ width: `${scorePct}%` }} /></div></div>
              <span className={`text-[10px] uppercase font-bold ${score >= MIN_SCORE ? "text-green-400" : "text-amber-400"}`}>{score >= MIN_SCORE ? "Unsecured borrowing unlocked" : `Needs ≥ ${MIN_SCORE} for unsecured`}</span>
            </div>
          ) : (
            <p className="text-[11px] text-amber-400/80">No credit profile yet — <Link href="/borrow" className="text-primary underline">borrow once</Link> to open your private credit line.</p>
          )}
        </div>
      </div>

      {/* Open credit lines */}
      <div className="glass-card rounded-lg border border-white/10 overflow-hidden">
        <div className="bg-white/5 px-5 py-2.5 border-b border-white/10 flex justify-between items-center">
          <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Open_Credit_Lines</span>
          <span className="text-[9px] text-primary/50 font-bold">{loans.length} active</span>
        </div>
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto animate-spin text-primary/60" /></div>
        ) : loans.length === 0 ? (
          <div className="p-8 text-center"><p className="text-[10px] text-white/20 uppercase tracking-widest">No active credit lines</p></div>
        ) : (
          <div className="divide-y divide-white/5">
            {loans.map((l) => (
              <div key={l.id} className="px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <CreditCard size={14} className="text-primary/70" />
                  <div className="flex flex-col"><span className="text-xs text-white font-bold">{l.kind === "bnpl" ? "BNPL Loan" : "Unsecured Credit"}</span><span className="text-[9px] text-primary/50 font-mono">{short(l.id, 10, 6)}</span></div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-white tabular-nums">{fmt(l.outstanding)} USDC</span>
                  <button onClick={() => void onRepay(l)} disabled={busy !== null} className="px-4 h-9 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 disabled:opacity-40 flex items-center gap-1.5">
                    {sameFlow(busy, { repay: l.id }) ? <Loader2 size={12} className="animate-spin" /> : null} Repay
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/borrow" className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex items-center justify-between hover:bg-primary/10 transition-colors group">
          <div className="flex items-center gap-4"><CreditCard className="text-primary" size={22} /><div><div className="text-sm font-black uppercase tracking-widest text-primary">Borrow on Credit</div><p className="text-[11px] text-foreground/50 mt-1">Draw collateral-free USDC against your line.</p></div></div>
          <ArrowUpRight className="text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" size={18} />
        </Link>
        <Link href="/positions" className="bg-white/5 border border-border/40 rounded-3xl p-6 flex items-center justify-between hover:border-primary/40 transition-colors group">
          <div className="flex items-center gap-4"><TrendingUp className="text-primary" size={22} /><div><div className="text-sm font-black uppercase tracking-widest">Positions</div><p className="text-[11px] text-foreground/50 mt-1">Supply to earn yield, manage your loans.</p></div></div>
          <ArrowUpRight className="text-foreground/40 group-hover:text-primary transition-colors" size={18} />
        </Link>
      </div>
    </div>
  )
}
