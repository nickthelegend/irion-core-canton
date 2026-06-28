"use client"

import { Database, ShieldCheck, History, Loader2, RefreshCw, CheckCircle2, ArrowDownToLine, ArrowUpRight, CreditCard } from "lucide-react"
import { useWallet, short, fmt } from "../wallet"

export default function ActivityPage() {
  const { positions, loading, reload } = useWallet()
  const loans = positions?.loans ?? []

  type Row = { id: string; kind: string; amount: number; tone: "in" | "out" }
  const rows: Row[] = []
  for (const l of loans) {
    rows.push({ id: `${l.id}-b`, kind: l.kind === "bnpl" ? "BNPL Borrow" : "Unsecured Borrow", amount: l.principal, tone: "in" })
    if (l.principalRepaid > 0) rows.push({ id: `${l.id}-r`, kind: "Loan Repayment", amount: l.principalRepaid, tone: "out" })
  }
  if (positions && positions.yield.shares > 0) rows.push({ id: "supply", kind: "Pool Supply", amount: positions.yield.value, tone: "out" })

  return (
    <div className="flex flex-col gap-8 py-8 font-mono text-white">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] tracking-[0.4em] text-primary/60 uppercase">IRION // Activity · canton</span>
          <h1 className="text-white text-3xl tracking-tighter font-black uppercase">Transaction History</h1>
        </div>
        <button onClick={() => void reload()} disabled={loading} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-5 py-2.5 text-[10px] uppercase tracking-widest font-bold transition-all disabled:opacity-40">
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-8 flex flex-col gap-4">
          {loading ? (
            <div className="bg-card/20 border border-border/40 rounded-2xl p-12 text-center"><Loader2 size={28} className="mx-auto text-primary animate-spin mb-4" /><p className="text-sm text-foreground/40">Reading on-ledger activity…</p></div>
          ) : rows.length === 0 ? (
            <div className="bg-card/20 border border-border/40 rounded-2xl p-12 text-center"><History size={48} className="mx-auto text-foreground/20 mb-4" /><p className="text-sm text-foreground/40">No activity found</p><p className="text-xs text-foreground/30 mt-2">Faucet, borrow, or supply and it will appear here.</p></div>
          ) : rows.map((t) => (
            <div key={t.id} className="bg-card/20 border border-border/40 rounded-2xl p-6 flex items-center justify-between hover:bg-white/[0.04] transition-all group backdrop-blur-sm shadow-xl">
              <div className="flex items-center gap-6">
                <div className="size-14 rounded-2xl bg-white/5 border border-border/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {t.tone === "in" ? <ArrowDownToLine className="w-5 h-5 text-primary" /> : t.kind === "Loan Repayment" ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <ArrowUpRight className="w-5 h-5 text-foreground/60" />}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-white font-bold text-lg tracking-tight">{t.kind}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded border font-black tracking-widest uppercase bg-primary/10 text-primary border-primary/20">settled</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 font-mono">
                    <span className="text-[10px] text-foreground/40 uppercase font-black flex items-center gap-1"><CreditCard size={10} /> {short(t.id.replace(/-(b|r)$/, ""), 8, 6)}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-foreground/40 uppercase font-black">Amount</div>
                <div className="text-white font-black text-lg tabular-nums tracking-tighter">{fmt(t.amount)} <span className="text-[10px] text-foreground/30">USDC</span></div>
              </div>
            </div>
          ))}
        </section>

        <section className="lg:col-span-4 space-y-6">
          <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2"><ShieldCheck size={16} /> On_Ledger_Activity</h3>
            <p className="text-[10px] text-foreground/60 leading-relaxed font-mono">Every action settles on the Canton ledger as a private Daml contract — visible only to you and the operator. This view is derived from your on-ledger loans and pool position.</p>
            <div className="pt-4 border-t border-primary/10 space-y-3">
              <div className="flex justify-between text-[10px]"><span className="text-foreground/40">NETWORK</span><span className="text-white font-bold uppercase">Canton</span></div>
              <div className="flex justify-between text-[10px]"><span className="text-foreground/40">SHOWING</span><span className="text-primary font-bold">{rows.length} events</span></div>
            </div>
          </div>
          <div className="bg-[#05080f]/40 border border-border/40 rounded-3xl p-6 flex items-center gap-3"><Database size={16} className="text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-foreground/50">Private by construction — no public explorer</span></div>
        </section>
      </div>
    </div>
  )
}
