"use client"

import Link from "next/link"
import { ShieldCheck, TrendingUp, Database, Loader2, Coins, CreditCard, RefreshCw, Sprout, ArrowUpRight } from "lucide-react"
import { useWallet, short, fmt } from "../wallet"

export default function PositionsPage() {
  const { positions, loading, reload } = useWallet()

  const loans = positions?.loans ?? []
  const yieldShares = positions?.yield.shares ?? 0
  const yieldValue = positions?.yield.value ?? 0
  const totalBorrowed = loans.reduce((s, p) => s + p.outstanding, 0)
  const score = positions?.credit?.score ?? 0

  type Row = { id: string; label: string; kind: string; amount: number; supply: boolean }
  const rows: Row[] = [
    ...loans.map((l) => ({ id: l.id, label: l.kind === "bnpl" ? "BNPL Loan" : "Unsecured Credit", kind: l.kind, amount: l.outstanding, supply: false })),
    ...(yieldShares > 0 ? [{ id: "yield", label: "Pool Supply (yield)", kind: "supply", amount: yieldValue, supply: true }] : []),
  ]

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">IRION // On_Ledger_Positions · canton</span>
          <h1 className="text-3xl tracking-tighter font-black uppercase">Your Positions</h1>
        </div>
        <button onClick={() => void reload()} disabled={loading} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-5 py-2.5 text-[10px] uppercase tracking-widest font-bold transition-all disabled:opacity-40">
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[["USDC_Balance", fmt(positions?.balance)], ["Total_Supplied", fmt(yieldValue)], ["Total_Borrowed", fmt(totalBorrowed)], ["Credit_Score", score ? `${score}` : "—"]].map(([l, v]) => (
          <div key={l} className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-5 flex flex-col gap-1"><span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">{l}</span><span className="text-2xl font-light tracking-tighter">{v}</span></div>
        ))}
      </div>

      {/* Earn — supply lives on the dedicated Lend tab. */}
      <Link href="/lend" className="bg-[#0d0f14] border border-primary/20 rounded-3xl p-6 flex items-center justify-between hover:bg-primary/[0.04] transition-colors group">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0"><Sprout size={18} /></div>
          <div>
            <div className="text-sm font-black uppercase tracking-widest text-white">Earn — Supply to Pool</div>
            <p className="text-[11px] text-foreground/50 mt-1.5 leading-relaxed max-w-2xl">Supply idle USDC to the Irion pool and earn borrower interest — a real on-ledger PoolShare you can withdraw anytime. Open the <span className="text-primary">Lend</span> tab.</p>
          </div>
        </div>
        <ArrowUpRight className="text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" size={18} />
      </Link>

      {/* positions table */}
      <div className="bg-card/20 border border-border/40 rounded-3xl overflow-hidden backdrop-blur-sm shadow-2xl">
        <div className="grid grid-cols-12 bg-white/5 border-b border-border/20 px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 items-center">
          <div className="col-span-6">Position</div>
          <div className="col-span-3 text-right">Amount</div>
          <div className="col-span-3 text-right">Type</div>
        </div>
        <div className="divide-y divide-border/10">
          {loading ? (
            <div className="px-8 py-14 text-center"><Loader2 size={28} className="mx-auto text-primary animate-spin mb-4" /><p className="text-sm text-foreground/40">Reading on-ledger positions…</p></div>
          ) : rows.length === 0 ? (
            <div className="px-8 py-14 text-center">
              <Database size={40} className="mx-auto text-foreground/20 mb-4" />
              <p className="text-sm text-foreground/40">No positions yet.</p>
              <div className="flex items-center justify-center gap-3 mt-5">
                <Link href="/borrow" className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20">Borrow</Link>
                <Link href="/faucet" className="px-4 py-2 rounded-xl bg-white/5 border border-border/40 text-[10px] font-black uppercase tracking-widest hover:border-primary/40">Get Test USDC</Link>
              </div>
            </div>
          ) : rows.map((p) => (
            <div key={p.id} className="grid grid-cols-12 px-8 py-6 items-center hover:bg-primary/5 transition-colors">
              <div className="col-span-6 flex items-center gap-4">
                <div className={`p-2 rounded-lg border ${p.supply ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-primary/10 text-primary border-primary/20"}`}>{p.supply ? <TrendingUp size={16} /> : p.kind === "bnpl" ? <CreditCard size={16} /> : <ShieldCheck size={16} />}</div>
                <div><div className="text-sm font-bold text-white">{p.label}</div><div className="text-[10px] text-foreground/40 uppercase tracking-tighter mt-0.5 font-mono">{short(p.id, 10, 6)}</div></div>
              </div>
              <div className="col-span-3 text-right"><span className="text-sm font-bold tabular-nums">{fmt(p.amount)}</span><span className="text-[10px] text-foreground/30 ml-1">USDC</span></div>
              <div className="col-span-3 text-right text-[11px] text-foreground/50 uppercase tracking-widest">{p.kind}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/borrow" className="bg-[#0d0f14] border border-border/30 rounded-3xl p-6 hover:border-primary/40 transition-all"><TrendingUp className="text-primary mb-3" size={20} /><div className="text-sm font-black uppercase tracking-widest">Borrow</div><p className="text-[11px] text-foreground/40 mt-1">Draw on your credit line, repay loans.</p></Link>
        <Link href="/credit" className="bg-[#0d0f14] border border-border/30 rounded-3xl p-6 hover:border-primary/40 transition-all"><CreditCard className="text-primary mb-3" size={20} /><div className="text-sm font-black uppercase tracking-widest">Credit</div><p className="text-[11px] text-foreground/40 mt-1">Your private score, limit & repay history.</p></Link>
        <Link href="/faucet" className="bg-[#0d0f14] border border-border/30 rounded-3xl p-6 hover:border-primary/40 transition-all"><Coins className="text-primary mb-3" size={20} /><div className="text-sm font-black uppercase tracking-widest">Get Test USDC</div><p className="text-[11px] text-foreground/40 mt-1">Mint testnet USDC to try the flows.</p></Link>
      </div>
    </div>
  )
}
