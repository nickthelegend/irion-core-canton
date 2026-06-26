"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  ShieldCheck, Lock, Loader2, Wallet, CreditCard, TrendingUp, RefreshCw, ArrowUpRight,
} from "lucide-react"
import { toast } from "sonner"
import { useStellarWallet } from "@/lib/stellar-wallet"
import { irion, type Profile, type Loan } from "@/lib/irion"
import { generateCreditProof } from "@/lib/prover"
import { NETWORK, fromUnits, explorerTx } from "@/lib/stellar"

const LS_LOANS = "irion_bnpl_loans"
const MIN_SCORE = 600

type CreditLine = { id: string; view: Loan }

export default function CreditPage() {
  const { address, connected, sign } = useStellarWallet()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [lines, setLines] = useState<CreditLine[]>([])
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState(false)
  const [repaying, setRepaying] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!address) return
    setLoading(true)
    try {
      const prof = await irion.getProfile(address).catch(() => null)
      setProfile(prof)
      // Loans are tracked by id at checkout, then read on-chain by id.
      const stored: { id: string }[] = JSON.parse(localStorage.getItem(LS_LOANS) || "[]")
      const views = await Promise.all(stored.map(async (l) => {
        const v = await irion.getLoan(BigInt(l.id)).catch(() => null)
        return v ? { id: l.id, view: v } : null
      }))
      setLines(views.filter((c): c is CreditLine => !!c && c.view.status === 0 && fromUnits(c.view.outstanding) > 0))
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => { refresh() }, [refresh])

  const onRepay = async (line: CreditLine) => {
    if (!address) return
    const amt = fromUnits(line.view.outstanding)
    setRepaying(line.id)
    try {
      await irion.repay(address, BigInt(line.id), amt, sign)
      toast.success(`Repaid ${amt} USDC`)
      await refresh()
    } catch (e) { toast.error("Repay failed", { description: e instanceof Error ? e.message : String(e) }) } finally { setRepaying(null) }
  }

  // Open a CreditProfile for the connected wallet.
  const openProfile = async () => {
    if (!address) return
    setWorking(true)
    try {
      await irion.openProfile(address, sign)
      toast.success("Credit profile opened")
      await refresh()
    } catch (e) { toast.error("Open profile failed", { description: e instanceof Error ? e.message : String(e) }) } finally { setWorking(false) }
  }

  // Generate the credit proof IN THE BROWSER (snarkjs), then verify + apply it
  // on-chain. The borrower's financials never leave the device.
  const requestZkScore = async () => {
    if (!address) return
    setWorking(true)
    try {
      // Demo figures — wire a form here to collect the borrower's real private numbers.
      const inputs = {
        monthlyIncome: 6000, monthlyDebt: 800, onTimePayments: 36,
        missedPayments: 1, utilizationBps: 2200, creditAgeMonths: 60,
      }
      const nonce = Number(profile?.nonce ?? BigInt(0)) + 1
      toast.info("Generating a zero-knowledge proof in your browser…")
      const { proof, pubSignals, approvedLimit } = await generateCreditProof(inputs, address, nonce)
      const { hash } = await irion.applyZkScore(address, proof, pubSignals, sign)
      toast.success(`Score verified on-chain — limit raised to ${approvedLimit} USDC`, {
        description:
          "Proven with a Groth16 proof generated on your device and checked by the BN254 verifier. Your financial data never left your browser.",
        action: { label: "View", onClick: () => window.open(explorerTx(hash), "_blank", "noopener,noreferrer") },
      })
      await refresh()
    } catch (e) { toast.error("ZK score failed", { description: e instanceof Error ? e.message : String(e) }) } finally { setWorking(false) }
  }

  if (!connected || !address) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-6 font-mono">
        <div className="glass-card rounded-lg border border-primary/20 p-10 flex flex-col items-center gap-6 shadow-[0_0_30px_rgba(166,242,74,0.08)]">
          <div className="size-16 bg-primary/10 rounded-full flex items-center justify-center border border-primary/30"><Wallet className="size-7 text-primary" /></div>
          <div className="text-center">
            <h1 className="text-xl font-black uppercase tracking-tighter text-white mb-2">Connect_Wallet</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.15em] max-w-[240px] leading-relaxed">Connect your Stellar wallet to view your Irion credit profile.</p>
          </div>
        </div>
      </div>
    )
  }

  const score = profile?.score ?? 0
  const scorePct = Math.min(100, (score / 850) * 100)
  const creditLimit = profile ? fromUnits(profile.credit_limit) : 0
  const outstanding = profile ? fromUnits(profile.outstanding) : 0
  const repaidTotal = profile ? fromUnits(profile.repaid_total) : 0
  const available = Math.max(0, creditLimit - outstanding)

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">IRION // Private_Credit · stellar_{NETWORK}</span>
          <h1 className="text-3xl tracking-tighter font-black uppercase">Credit Dashboard</h1>
        </div>
        <button onClick={refresh} disabled={loading}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-5 py-2.5 text-[10px] uppercase tracking-widest font-bold transition-all disabled:opacity-40">
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Sync
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          ["Credit_Limit", profile ? `${creditLimit} USDC` : "—"],
          ["Available", profile ? `${available} USDC` : "—"],
          ["Outstanding", profile ? `${outstanding} USDC` : "—"],
          ["Repaid_Total", profile ? `${repaidTotal} USDC` : "—"],
        ].map(([l, v]) => (
          <div key={l} className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-5 flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">{l}</span>
            <span className="text-2xl font-light tracking-tighter">{v}</span>
          </div>
        ))}
      </div>

      {/* ZK score */}
      <div className="glass-card rounded-lg border border-purple-500/20 overflow-hidden shadow-[0_0_20px_rgba(168,85,247,0.05)]">
        <div className="bg-purple-500/5 px-5 py-2.5 border-b border-purple-500/10 flex justify-between items-center">
          <div className="flex items-center gap-2"><Lock className="size-3.5 text-purple-400" /><span className="text-[10px] text-purple-400/80 uppercase tracking-widest font-bold">Zero_Knowledge_Credit_Score</span></div>
          <span className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-green-400 bg-green-500/10 border border-green-500/30 rounded-full px-2 py-1">
            <ShieldCheck className="size-3" /> Groth16 Verified · On-chain
          </span>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-[10px] text-white/40 leading-relaxed max-w-2xl">
            Your Irion credit score is proven with a zero-knowledge proof and verified on-chain against your
            <span className="text-purple-400 font-bold"> CreditProfile</span>. A score of at least {MIN_SCORE} unlocks
            unsecured (collateral-free) borrowing in the money market.
          </p>
          {profile ? (
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-2">
                <ShieldCheck className="size-3.5 text-purple-400" />
                <span className="text-purple-400 text-xl font-black tracking-tighter">{score}</span>
                <span className="text-[9px] text-purple-400/50 ml-1">/ 850</span>
              </div>
              <div className="flex-1 min-w-[120px]">
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-400 transition-all duration-700" style={{ width: `${scorePct}%` }} />
                </div>
              </div>
              <span className={`text-[10px] uppercase font-bold ${score >= MIN_SCORE ? "text-green-400" : "text-amber-400"}`}>
                {score >= MIN_SCORE ? "Unsecured borrowing unlocked" : `Needs ≥ ${MIN_SCORE} for unsecured`}
              </span>
              <button onClick={requestZkScore} disabled={working}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-200 text-[10px] font-black uppercase tracking-widest hover:bg-purple-500/30 disabled:opacity-40 transition-all">
                {working ? <Loader2 className="size-3 animate-spin" /> : <Lock className="size-3" />}
                {working ? "Proving…" : score > 0 ? "Refresh ZK Score" : "Request ZK Score"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-[11px] text-amber-400/80">No credit profile yet — open one to start building your ZK-verified score.</p>
              <button onClick={openProfile} disabled={working}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-200 text-[10px] font-black uppercase tracking-widest hover:bg-purple-500/30 disabled:opacity-40 transition-all">
                {working ? <Loader2 className="size-3 animate-spin" /> : <ShieldCheck className="size-3" />}
                {working ? "Opening…" : "Open Credit Profile"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Open credit lines */}
      <div className="glass-card rounded-lg border border-white/10 overflow-hidden">
        <div className="bg-white/5 px-5 py-2.5 border-b border-white/10 flex justify-between items-center">
          <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Open_Credit_Lines</span>
          <span className="text-[9px] text-primary/50 font-bold">{lines.length} active</span>
        </div>
        {lines.length === 0 ? (
          <div className="p-8 text-center"><p className="text-[10px] text-white/20 uppercase tracking-widest">No active credit lines</p></div>
        ) : (
          <div className="divide-y divide-white/5">
            {lines.map((l) => (
              <div key={l.id} className="px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <CreditCard size={14} className="text-primary/70" />
                  <div className="flex flex-col">
                    <span className="text-xs text-white font-bold">BNPL Loan #{l.id}</span>
                    <span className="text-[9px] text-primary/50 font-mono">Due ledger {l.view.due_ledger}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-white tabular-nums">{fromUnits(l.view.outstanding).toLocaleString()} USDC</span>
                  <button onClick={() => onRepay(l)} disabled={!!repaying}
                    className="px-4 h-9 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 disabled:opacity-40 flex items-center gap-1.5">
                    {repaying === l.id ? <Loader2 size={12} className="animate-spin" /> : null} Repay
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/bnpl" className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex items-center justify-between hover:bg-primary/10 transition-colors group">
          <div className="flex items-center gap-4">
            <CreditCard className="text-primary" size={22} />
            <div>
              <div className="text-sm font-black uppercase tracking-widest text-primary">Buy Now, Pay Never</div>
              <p className="text-[11px] text-foreground/50 mt-1">Checkout with credit and auto-repay from yield.</p>
            </div>
          </div>
          <ArrowUpRight className="text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" size={18} />
        </Link>
        <Link href="/borrow" className="bg-white/5 border border-border/40 rounded-3xl p-6 flex items-center justify-between hover:border-primary/40 transition-colors group">
          <div className="flex items-center gap-4">
            <TrendingUp className="text-primary" size={22} />
            <div>
              <div className="text-sm font-black uppercase tracking-widest">Lend / Borrow</div>
              <p className="text-[11px] text-foreground/50 mt-1">Supply, borrow, repay & manage your credit line.</p>
            </div>
          </div>
          <ArrowUpRight className="text-foreground/40 group-hover:text-primary transition-colors" size={18} />
        </Link>
      </div>
    </div>
  )
}
