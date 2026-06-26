"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ShieldCheck, Lock, Loader2, Wallet, X, CreditCard } from "lucide-react"
import { toast } from "sonner"
import { useStellarWallet } from "@/lib/stellar-wallet"
import { irion, type Profile, type Loan } from "@/lib/irion"
import { NETWORK, fromUnits, explorerTx } from "@/lib/stellar"

const LS_LOANS = "irion_market_loans"
const MERCHANT = process.env.NEXT_PUBLIC_IRION_MERCHANT_ADDRESS ?? ""
const TERM_LEDGERS = 518400 // ~30 days
const fmt = (v: number) => (v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : v.toLocaleString(undefined, { maximumFractionDigits: 2 }))

type LoanRec = { id: string }

export default function BorrowPage() {
  const { address, connected, sign } = useStellarWallet()

  const [usdc, setUsdc] = useState(0)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loanIds, setLoanIds] = useState<LoanRec[]>([])
  const [loans, setLoans] = useState<Record<string, Loan>>({})
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try { setLoanIds(JSON.parse(localStorage.getItem(LS_LOANS) || "[]")) } catch { /* */ }
  }, [])

  const refresh = useCallback(async () => {
    if (!address) { setLoading(false); return }
    setLoading(true)
    const [bal, prof] = await Promise.all([
      irion.usdcBalance(address).catch(() => BigInt(0)),
      irion.getProfile(address).catch(() => null),
    ])
    setUsdc(fromUnits(bal))
    setProfile(prof)
    const stored: LoanRec[] = JSON.parse(localStorage.getItem(LS_LOANS) || "[]")
    const v: Record<string, Loan> = {}
    await Promise.all(stored.map(async (l) => { const lv = await irion.getLoan(BigInt(l.id)).catch(() => null); if (lv) v[l.id] = lv }))
    setLoans(v)
    setLoading(false)
  }, [address])

  useEffect(() => { refresh() }, [refresh])

  const saveLoans = (next: LoanRec[]) => { localStorage.setItem(LS_LOANS, JSON.stringify(next)); setLoanIds(next) }

  const onBorrow = async () => {
    if (!address) return
    const amt = Number(amount)
    if (!(amt > 0)) return
    setBusy(true)
    const collateral = Math.ceil(amt * 1.5)
    const merchant = MERCHANT || address
    const toastId = toast.loading(`Borrow ${fmt(amt)} USDC…`)
    try {
      const res = await irion.openPurchase(address, merchant, amt, collateral, TERM_LEDGERS, sign)
      const id = res.returnValue != null ? String(res.returnValue) : null
      if (id) saveLoans([...loanIds, { id }])
      toast.success(`Borrowed ${fmt(amt)} USDC`, { id: toastId, action: { label: "View", onClick: () => window.open(explorerTx(res.hash), "_blank", "noopener,noreferrer") } })
      setOpen(false); await refresh()
    } catch (e) { toast.error("Borrow failed", { id: toastId, description: e instanceof Error ? e.message : String(e) }) } finally { setBusy(false) }
  }

  const onRepay = async (id: string, lv: Loan) => {
    if (!address) return
    setBusy(true)
    const toastId = toast.loading(`Repay ${fmt(fromUnits(lv.outstanding))} USDC…`)
    try {
      const { hash } = await irion.repay(address, BigInt(id), fromUnits(lv.outstanding), sign)
      toast.success("Repaid", { id: toastId, action: { label: "View", onClick: () => window.open(explorerTx(hash), "_blank", "noopener,noreferrer") } })
      await refresh()
    } catch (e) { toast.error("Repay failed", { id: toastId, description: e instanceof Error ? e.message : String(e) }) } finally { setBusy(false) }
  }

  const score = profile?.score ?? 0
  const creditLimit = profile ? fromUnits(profile.credit_limit) : 0
  const outstanding = profile ? fromUnits(profile.outstanding) : 0
  const available = Math.max(0, creditLimit - outstanding)
  const openLoans = loanIds.map((l) => ({ id: l.id, view: loans[l.id] })).filter((l) => l.view && l.view.status === 0 && fromUnits(l.view.outstanding) > 0)

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">IRION // Borrow · stellar_{NETWORK}</span>
          <h1 className="text-white text-3xl md:text-5xl tracking-tighter font-black uppercase">Borrow</h1>
        </div>
        <button onClick={() => { setOpen(true); setAmount("") }} disabled={!connected}
          className="px-6 h-11 rounded-xl bg-primary text-black text-[11px] font-black uppercase tracking-widest hover:scale-[1.02] disabled:opacity-40 flex items-center gap-2">
          <CreditCard size={15} /> New Borrow
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[["ZK_Score", profile ? `${score}` : "—"], ["Credit_Limit", profile ? `${fmt(creditLimit)} USDC` : "—"], ["Available", profile ? `${fmt(available)} USDC` : "—"], ["Outstanding", profile ? `${fmt(outstanding)} USDC` : "—"]].map(([l, v]) => (
          <div key={l} className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-5 flex flex-col gap-1"><span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">{l}</span><span className="text-2xl font-light tracking-tighter">{v}</span></div>
        ))}
      </div>

      <div className="bg-card/20 border border-border/40 rounded-3xl overflow-hidden">
        <div className="px-8 py-4 border-b border-border/20 text-[10px] font-black uppercase tracking-widest text-foreground/40">Open Borrows</div>
        {!connected ? (
          <div className="px-8 py-12 text-center flex flex-col items-center gap-3"><Wallet size={32} className="text-foreground/20" /><p className="text-sm text-foreground/40 uppercase tracking-widest">Connect your wallet to borrow</p></div>
        ) : loading ? (
          <div className="px-8 py-12 text-center"><Loader2 className="mx-auto animate-spin text-primary/60" /></div>
        ) : openLoans.length === 0 ? (
          <div className="px-8 py-12 text-center text-sm text-foreground/40">No open borrows. Hit <span className="text-primary">New Borrow</span> to start, or <Link href="/lend" className="text-primary underline">lend</Link> to earn.</div>
        ) : (
          <div className="divide-y divide-border/10">
            {openLoans.map(({ id, view }) => (
              <div key={id} className="px-8 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg border bg-primary/10 text-primary border-primary/20"><Lock size={15} /></div>
                  <div>
                    <div className="text-sm font-bold">Collateralized Loan</div>
                    <span className="text-[9px] text-primary/50 font-mono">Loan #{id} · due ledger {view!.due_ledger}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold tabular-nums">{fmt(fromUnits(view!.outstanding))} USDC</span>
                  <button onClick={() => onRepay(id, view!)} disabled={busy}
                    className="px-4 h-9 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 disabled:opacity-40">Repay</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-foreground/40 leading-relaxed max-w-2xl">
        Borrow over-collateralized against USDC (lock 150%), or unlock collateral-free credit with a strong private
        <Link href="/credit" className="text-purple-400 hover:underline"> zero-knowledge credit score</Link>. Repayments grow your credit limit.
      </p>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md bg-[#0d0f14] border border-primary/20 rounded-3xl p-6 font-mono shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-black uppercase tracking-tighter">New Borrow</h2><button onClick={() => !busy && setOpen(false)} className="text-foreground/40 hover:text-white"><X size={18} /></button></div>

            <div className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-4 focus-within:border-primary/40 mb-3">
              <input type="number" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-transparent text-3xl font-light tracking-tighter placeholder:text-foreground/20 focus:outline-none" />
            </div>

            <p className="text-[10px] text-amber-400/70 mb-4 flex items-center gap-1.5"><Lock size={12} /> Locks {fmt((Number(amount) || 0) * 1.5)} USDC collateral (150%). You hold {fmt(usdc)} USDC.</p>

            <button onClick={onBorrow} disabled={busy || !(Number(amount) > 0) || usdc < Math.ceil((Number(amount) || 0) * 1.5)}
              className="w-full py-4 rounded-2xl bg-primary text-black font-black text-sm uppercase tracking-widest hover:scale-[1.02] disabled:opacity-40 disabled:bg-white/5 disabled:text-foreground/30 transition-all flex items-center justify-center gap-2">
              {busy ? <Loader2 size={16} className="animate-spin" /> : null} Confirm Borrow
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
