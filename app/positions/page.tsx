"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  ShieldCheck, Lock, TrendingUp, Database, Loader2,
  Coins, CreditCard, RefreshCw, Wallet,
} from "lucide-react"
import { useStellarWallet } from "@/lib/stellar-wallet"
import { irion, type Profile, type Loan } from "@/lib/irion"
import { NETWORK, fromUnits } from "@/lib/stellar"

// Loan id sets tracked across the app (market + bnpl + checkout).
const LS_KEYS = ["irion_market_loans", "irion_bnpl_loans"]

type Row = { id: string; kind: "loan" | "supply"; label: string; amount: number; secondary?: number }

export default function PositionsPage() {
  const { address, connected } = useStellarWallet()

  const [rows, setRows] = useState<Row[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [usdc, setUsdc] = useState(0)
  const [shares, setShares] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!address) return
    setLoading(true)
    setError(null)
    try {
      const [bal, sh, prof] = await Promise.all([
        irion.usdcBalance(address).catch(() => BigInt(0)),
        irion.sharesOf(address).catch(() => BigInt(0)),
        irion.getProfile(address).catch(() => null),
      ])
      setUsdc(fromUnits(bal))
      setShares(fromUnits(sh))
      setProfile(prof)

      const ids = new Set<string>()
      for (const k of LS_KEYS) {
        try { for (const l of JSON.parse(localStorage.getItem(k) || "[]") as { id: string }[]) ids.add(String(l.id)) } catch { /* */ }
      }
      const loanRows: Row[] = []
      await Promise.all([...ids].map(async (id) => {
        const lv: Loan | null = await irion.getLoan(BigInt(id)).catch(() => null)
        if (lv && lv.status === 0 && fromUnits(lv.outstanding) > 0) {
          loanRows.push({ id, kind: "loan", label: "BNPL / Collateralized Loan", amount: fromUnits(lv.outstanding), secondary: fromUnits(lv.collateral) })
        }
      }))
      const supplyRows: Row[] = fromUnits(sh) > 0 ? [{ id: "pool", kind: "supply", label: "Pool Supply (shares)", amount: fromUnits(sh) }] : []
      setRows([...supplyRows, ...loanRows])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read on-chain positions")
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => { refresh() }, [refresh])

  const totalBorrowed = rows.filter((p) => p.kind === "loan").reduce((s, p) => s + p.amount, 0)
  const totalSupplied = shares

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">IRION // On_Chain_Positions · stellar_{NETWORK}</span>
          <h1 className="text-3xl tracking-tighter font-black uppercase">Your Positions</h1>
        </div>
        <button onClick={refresh} disabled={loading || !connected}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-5 py-2.5 text-[10px] uppercase tracking-widest font-bold transition-all disabled:opacity-40">
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ["USDC_Balance", usdc.toLocaleString()],
          ["Total_Supplied", totalSupplied.toLocaleString()],
          ["Total_Borrowed", totalBorrowed.toLocaleString()],
          ["ZK_Score", profile ? `${profile.score}` : "—"],
        ].map(([l, v]) => (
          <div key={l} className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-5 flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">{l}</span>
            <span className="text-2xl font-light tracking-tighter">{v}</span>
          </div>
        ))}
      </div>

      {/* positions table */}
      <div className="bg-card/20 border border-border/40 rounded-3xl overflow-hidden backdrop-blur-sm shadow-2xl">
        <div className="grid grid-cols-12 bg-white/5 border-b border-border/20 px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 items-center">
          <div className="col-span-6">Position</div>
          <div className="col-span-3 text-right">Outstanding / Principal</div>
          <div className="col-span-3 text-right">Collateral</div>
        </div>
        <div className="divide-y divide-border/10">
          {!connected && (
            <div className="px-8 py-14 text-center">
              <Wallet size={40} className="mx-auto text-foreground/20 mb-4" />
              <p className="text-sm text-foreground/40 uppercase tracking-widest">Connect your Stellar wallet to view positions</p>
            </div>
          )}
          {connected && loading && (
            <div className="px-8 py-14 text-center">
              <Loader2 size={28} className="mx-auto text-primary animate-spin mb-4" />
              <p className="text-sm text-foreground/40">Reading on-chain state…</p>
            </div>
          )}
          {connected && !loading && error && (
            <div className="px-8 py-14 text-center"><p className="text-sm text-red-400">{error}</p></div>
          )}
          {connected && !loading && !error && rows.length === 0 && (
            <div className="px-8 py-14 text-center">
              <Database size={40} className="mx-auto text-foreground/20 mb-4" />
              <p className="text-sm text-foreground/40">No positions yet.</p>
              <div className="flex items-center justify-center gap-3 mt-5">
                <Link href="/bnpl" className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20">Try BNPL</Link>
                <Link href="/lend-borrow" className="px-4 py-2 rounded-xl bg-white/5 border border-border/40 text-[10px] font-black uppercase tracking-widest hover:border-primary/40">Lend / Borrow</Link>
              </div>
            </div>
          )}
          {connected && !loading && !error && rows.map((p) => (
            <div key={`${p.kind}-${p.id}`} className="grid grid-cols-12 px-8 py-6 items-center hover:bg-primary/5 transition-colors">
              <div className="col-span-6 flex items-center gap-4">
                <div className={`p-2 rounded-lg border ${p.kind === "supply" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-primary/10 text-primary border-primary/20"}`}>
                  {p.kind === "supply" ? <TrendingUp size={16} /> : <Lock size={16} />}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{p.label}</div>
                  <div className="text-[10px] text-foreground/40 uppercase tracking-tighter mt-0.5">{p.kind === "supply" ? "supply" : `loan #${p.id}`}</div>
                </div>
              </div>
              <div className="col-span-3 text-right">
                <span className="text-sm font-bold tabular-nums">{p.amount.toLocaleString()}</span>
                <span className="text-[10px] text-foreground/30 ml-1">USDC</span>
              </div>
              <div className="col-span-3 text-right text-[11px] text-foreground/50 tabular-nums">
                {p.secondary != null ? `${p.secondary.toLocaleString()} USDC` : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* manage links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/lend-borrow" className="bg-[#0d0f14] border border-border/30 rounded-3xl p-6 hover:border-primary/40 transition-all group">
          <TrendingUp className="text-primary mb-3" size={20} />
          <div className="text-sm font-black uppercase tracking-widest">Manage Borrows</div>
          <p className="text-[11px] text-foreground/40 mt-1">Repay or reclaim collateral, open new positions.</p>
        </Link>
        <Link href="/bnpl" className="bg-[#0d0f14] border border-border/30 rounded-3xl p-6 hover:border-primary/40 transition-all group">
          <CreditCard className="text-primary mb-3" size={20} />
          <div className="text-sm font-black uppercase tracking-widest">BNPL Checkout</div>
          <p className="text-[11px] text-foreground/40 mt-1">Buy now, repay from yield. Build your ZK score.</p>
        </Link>
        <Link href="/faucet" className="bg-[#0d0f14] border border-border/30 rounded-3xl p-6 hover:border-primary/40 transition-all group">
          <Coins className="text-primary mb-3" size={20} />
          <div className="text-sm font-black uppercase tracking-widest">Get Test USDC</div>
          <p className="text-[11px] text-foreground/40 mt-1">Mint testnet USDC to try the flows.</p>
        </Link>
      </div>

      <p className="text-[10px] text-foreground/30 leading-relaxed max-w-2xl flex items-center gap-2">
        <ShieldCheck size={12} className="text-primary/50 flex-shrink-0" />
        Positions are read live from the Irion core contract on Stellar {NETWORK}. Loan ids are tracked locally at checkout and re-read on-chain.
      </p>
    </div>
  )
}
