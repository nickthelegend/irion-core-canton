"use client"

import { useState } from "react"
import Link from "next/link"
import { ShieldCheck, Loader2, X, CreditCard } from "lucide-react"
import { useWallet, sameFlow, short, fmt } from "../wallet"

export default function BorrowPage() {
  const { positions, loading, busy, operator, onBorrow, onRepay } = useWallet()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")

  const credit = positions?.credit ?? null
  const score = credit?.score ?? 0
  const available = credit ? (credit.available ?? credit.creditLimit - credit.outstanding) : 0
  const loans = (positions?.loans ?? []).filter((l) => l.status === "active" || l.outstanding > 0)
  const amt = Number(amount)

  const confirm = async () => {
    if (!(amt > 0)) return
    await onBorrow(amt)
    setOpen(false); setAmount("")
  }

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">IRION // Borrow · canton</span>
          <h1 className="text-white text-3xl md:text-5xl tracking-tighter font-black uppercase">Borrow</h1>
        </div>
        <button onClick={() => { setOpen(true); setAmount("") }} disabled={busy !== null}
          className="px-6 h-11 rounded-xl bg-primary text-black text-[11px] font-black uppercase tracking-widest hover:scale-[1.02] disabled:opacity-40 flex items-center gap-2">
          <CreditCard size={15} /> New Borrow
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[["Credit_Score", credit ? `${score}` : "—"], ["Credit_Limit", credit ? `${fmt(credit.creditLimit)} USDC` : "—"], ["Available", credit ? `${fmt(available)} USDC` : "—"], ["Outstanding", credit ? `${fmt(credit.outstanding)} USDC` : "—"]].map(([l, v]) => (
          <div key={l} className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-5 flex flex-col gap-1"><span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">{l}</span><span className="text-2xl font-light tracking-tighter">{v}</span></div>
        ))}
      </div>

      <div className="bg-card/20 border border-border/40 rounded-3xl overflow-hidden">
        <div className="px-8 py-4 border-b border-border/20 text-[10px] font-black uppercase tracking-widest text-foreground/40">Open Borrows</div>
        {loading ? (
          <div className="px-8 py-12 text-center"><Loader2 className="mx-auto animate-spin text-primary/60" /></div>
        ) : loans.length === 0 ? (
          <div className="px-8 py-12 text-center text-sm text-foreground/40">No open borrows. Hit <span className="text-primary">New Borrow</span> to draw on your credit line.</div>
        ) : (
          <div className="divide-y divide-border/10">
            {loans.map((p) => (
              <div key={p.id} className="px-8 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg border bg-primary/10 text-primary border-primary/20"><ShieldCheck size={15} /></div>
                  <div>
                    <div className="text-sm font-bold">{p.kind === "bnpl" ? "BNPL Loan" : "Unsecured Credit"}</div>
                    <span className="text-[9px] text-primary/50 font-mono">{short(p.id, 10, 6)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold tabular-nums">{fmt(p.outstanding)} USDC</span>
                  <button onClick={() => void onRepay(p)} disabled={busy !== null}
                    className="px-4 h-9 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 disabled:opacity-40 flex items-center gap-1.5">
                    {sameFlow(busy, { repay: p.id }) ? <Loader2 size={12} className="animate-spin" /> : null} Repay
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-foreground/40 leading-relaxed max-w-2xl">
        Borrow collateral-free against your private <Link href="/credit" className="text-primary hover:underline">Canton credit line</Link>. You sign an UnsecuredRequest in Carpincho and a real Loan disburses USDC. Repayments grow your score and limit.
      </p>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => busy === null && setOpen(false)}>
          <div className="w-full max-w-md bg-[#0d0f14] border border-primary/20 rounded-3xl p-6 font-mono shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-black uppercase tracking-tighter">New Borrow</h2><button onClick={() => busy === null && setOpen(false)} className="text-foreground/40 hover:text-white"><X size={18} /></button></div>
            <div className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-4 focus-within:border-primary/40 mb-3">
              <input type="number" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-transparent text-3xl font-light tracking-tighter placeholder:text-foreground/20 focus:outline-none" />
            </div>
            <p className="text-[10px] text-primary/70 mb-4 flex items-center gap-1.5"><ShieldCheck size={12} /> Collateral-free USDC against your credit line (available {fmt(available)} USDC · score {score}).</p>
            <button onClick={() => void confirm()} disabled={busy !== null || !(amt > 0) || operator === undefined}
              className="w-full py-4 rounded-2xl bg-primary text-black font-black text-sm uppercase tracking-widest hover:scale-[1.02] disabled:opacity-40 disabled:bg-white/5 disabled:text-foreground/30 transition-all flex items-center justify-center gap-2">
              {sameFlow(busy, "borrow") ? <Loader2 size={16} className="animate-spin" /> : null} Confirm Borrow
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
