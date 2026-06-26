"use client"

import { useCallback, useEffect, useState } from "react"
import { TrendingUp, Info, Loader2, Wallet, X } from "lucide-react"
import { TokenIcon } from "@/components/token-icon"
import { toast } from "sonner"
import { useStellarWallet } from "@/lib/stellar-wallet"
import { irion } from "@/lib/irion"
import { NETWORK, fromUnits, explorerTx } from "@/lib/stellar"

const fmt = (v: number) => (v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : v.toLocaleString(undefined, { maximumFractionDigits: 2 }))

export default function LendPage() {
  const { address, connected, sign } = useStellarWallet()

  const [pool, setPool] = useState<{ total: number; available: number } | null>(null)
  const [usdc, setUsdc] = useState(0)
  const [shares, setShares] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<"supply" | "withdraw" | null>(null)
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [ta, av] = await Promise.all([
      irion.totalAssets().catch(() => null),
      irion.availableLiquidity().catch(() => null),
    ])
    setPool(ta != null && av != null ? { total: fromUnits(ta), available: fromUnits(av) } : null)
    if (address) {
      const [bal, sh] = await Promise.all([
        irion.usdcBalance(address).catch(() => BigInt(0)),
        irion.sharesOf(address).catch(() => BigInt(0)),
      ])
      setUsdc(fromUnits(bal))
      setShares(fromUnits(sh))
    }
    setLoading(false)
  }, [address])

  useEffect(() => { refresh() }, [refresh])

  const confirm = async () => {
    if (!modal || !address) return
    const amt = Number(amount)
    if (!(amt > 0)) return
    setBusy(true)
    const toastId = toast.loading(`${modal === "supply" ? "Supply" : "Withdraw"} ${fmt(amt)} USDC…`)
    try {
      const { hash } = modal === "supply"
        ? await irion.supply(address, amt, sign)
        : await irion.withdraw(address, BigInt(Math.round(amt * 1e7)), sign)
      toast.success(`${modal === "supply" ? "Supplied" : "Withdrew"} ${fmt(amt)} USDC`, { id: toastId, action: { label: "View", onClick: () => window.open(explorerTx(hash), "_blank", "noopener,noreferrer") } })
      setModal(null); await refresh()
    } catch (e) { toast.error("Transaction failed", { id: toastId, description: e instanceof Error ? e.message : String(e) }) } finally { setBusy(false) }
  }

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">IRION // Lend · stellar_{NETWORK}</span>
        <h1 className="text-white text-3xl md:text-5xl tracking-tighter font-black uppercase">Lend &amp; Earn</h1>
      </div>

      {connected && address && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-4 flex items-center gap-3">
            <TokenIcon symbol="USDC" size={28} className="flex-shrink-0" />
            <div><div className="text-[10px] text-foreground/40 uppercase tracking-widest">Your USDC</div><div className="text-lg font-bold">{loading ? "…" : fmt(usdc)}</div></div>
          </div>
          <div className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-4 flex items-center gap-3">
            <TrendingUp size={28} className="flex-shrink-0 text-primary" />
            <div><div className="text-[10px] text-foreground/40 uppercase tracking-widest">Your Shares</div><div className="text-lg font-bold">{loading ? "…" : fmt(shares)}</div></div>
          </div>
        </div>
      )}

      {/* Supply market */}
      <div className="bg-card/20 border border-border/40 rounded-3xl overflow-hidden backdrop-blur-sm shadow-2xl">
        <div className="grid grid-cols-12 bg-white/5 border-b border-border/20 px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">
          <div className="col-span-5">Asset</div>
          <div className="col-span-2 text-right">Supplied</div>
          <div className="col-span-2 text-right">Available</div>
          <div className="col-span-3 text-right">Actions</div>
        </div>
        <div className="divide-y divide-border/10">
          <div className="grid grid-cols-12 px-8 py-6 items-center hover:bg-primary/5 transition-colors">
            <div className="col-span-5 flex items-center gap-3">
              <TokenIcon symbol="USDC" size={28} className="flex-shrink-0" />
              <div>
                <div className="text-sm font-bold text-white">USDC</div>
                <div className="text-[10px] text-foreground/40 max-w-[280px] leading-tight mt-0.5">Irion core pool — backs BNPL credit. Earns borrower interest.</div>
              </div>
            </div>
            <div className="col-span-2 text-right text-sm font-bold text-green-400">{loading ? "…" : pool ? fmt(pool.total) : "—"}</div>
            <div className="col-span-2 text-right text-sm font-bold text-primary">{loading ? "…" : pool ? fmt(pool.available) : "—"}</div>
            <div className="col-span-3 flex justify-end items-center gap-2">
              <button onClick={() => { setModal("supply"); setAmount("") }} disabled={!connected}
                className="px-4 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary/20 disabled:opacity-40 transition-all">Supply</button>
              <button onClick={() => { setModal("withdraw"); setAmount("") }} disabled={!connected || shares <= 0}
                className="px-3 py-1.5 rounded-lg border border-border/40 bg-white/5 text-[10px] font-black uppercase tracking-wider hover:border-primary/40 disabled:opacity-40 transition-all">Withdraw</button>
            </div>
          </div>
        </div>
      </div>

      {!connected && (
        <div className="flex items-center gap-3 p-6 rounded-2xl bg-primary/5 border border-primary/10"><Wallet className="text-primary flex-shrink-0" size={18} /><p className="text-[11px] text-foreground/50">Connect your Stellar wallet to supply and earn.</p></div>
      )}

      <div className="flex items-start gap-4 p-6 rounded-2xl bg-cyan-500/5 border border-cyan-500/10">
        <Info className="text-cyan-300 flex-shrink-0" size={20} />
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">How yield works</p>
          <p className="text-[11px] text-foreground/50 leading-relaxed">Supplied USDC backs Buy-Now-Pay-Never credit and collateralized borrows. Interest paid by borrowers accrues to the pool, lifting every supplier&apos;s share value — withdraw to claim principal + yield.</p>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !busy && setModal(null)}>
          <div className="w-full max-w-md bg-[#0d0f14] border border-primary/20 rounded-3xl p-6 font-mono shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3"><TokenIcon symbol="USDC" size={28} />
                <h2 className="text-lg font-black uppercase tracking-tighter">{modal === "supply" ? "Supply" : "Withdraw"} USDC</h2>
              </div>
              <button onClick={() => !busy && setModal(null)} className="text-foreground/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-foreground/40 mb-2">
              <span>{modal === "supply" ? "Your balance" : "Your shares"}</span>
              <button onClick={() => setAmount(String(modal === "supply" ? usdc : shares))} className="text-primary/70 hover:text-primary font-bold">{fmt(modal === "supply" ? usdc : shares)} {modal === "supply" ? "USDC" : "shares"}</button>
            </div>
            <div className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-4 focus-within:border-primary/40 transition-all mb-4">
              <input type="number" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-transparent text-3xl font-light tracking-tighter placeholder:text-foreground/20 focus:outline-none" />
            </div>
            <button onClick={confirm} disabled={busy || !(Number(amount) > 0) || (modal === "supply" ? Number(amount) > usdc : Number(amount) > shares)}
              className="w-full py-4 rounded-2xl bg-primary text-black font-black text-sm uppercase tracking-widest hover:scale-[1.02] disabled:opacity-40 disabled:bg-white/5 disabled:text-foreground/30 transition-all flex items-center justify-center gap-2">
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}{modal === "supply" ? "Confirm Supply" : "Confirm Withdraw"}
            </button>
            {modal === "supply" && usdc <= 0 && <p className="text-[10px] text-foreground/40 text-center mt-3">You have no USDC. Mint some from the faucet.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
