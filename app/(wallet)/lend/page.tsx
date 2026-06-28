"use client"

import { useState } from "react"
import Link from "next/link"
import { Sprout, ArrowUpFromLine, Loader2, TrendingUp, Coins, Sparkles } from "lucide-react"
import { useWallet, sameFlow, fmt } from "../wallet"

export default function LendPage() {
  const { positions, busy, onLend, onRedeem, onSimulateYield } = useWallet()
  const [amount, setAmount] = useState("")
  const bal = positions?.balance ?? 0
  const yShares = positions?.yield.shares ?? 0
  const yValue = positions?.yield.value ?? 0
  const amt = Number(amount)

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">IRION // Lend · canton</span>
        <h1 className="text-white text-3xl md:text-5xl tracking-tighter font-black uppercase">Lend</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[["USDC_Balance", fmt(bal)], ["Supplied", fmt(yValue)], ["Pool_Shares", fmt(yShares)], ["Earning", yShares > 0 ? "YES" : "—"]].map(([l, v]) => (
          <div key={l} className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-5 flex flex-col gap-1"><span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">{l}</span><span className="text-2xl font-light tracking-tighter">{v}</span></div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* supply card */}
        <div className="lg:col-span-7 bg-[#0d0f14] border border-primary/20 rounded-3xl p-8 space-y-5">
          <div className="space-y-1">
            <h3 className="text-xl font-black uppercase tracking-widest text-white">Supply_USDC</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-foreground/30">Earn borrower interest · real PoolShare on Canton</p>
          </div>
          <div className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-5 focus-within:border-primary/40 flex items-center gap-3">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="flex-1 bg-transparent text-4xl font-light tracking-tighter placeholder:text-foreground/20 focus:outline-none min-w-0" />
            <span className="text-sm font-semibold text-white/60">USDC</span>
          </div>
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
            <span className="text-foreground/30">Balance</span>
            <button onClick={() => setAmount(String(bal))} className="text-primary/70 hover:text-primary">{fmt(bal)} USDC</button>
          </div>
          <button onClick={() => { if (amt > 0) void onLend(amt).then(() => setAmount("")) }} disabled={busy !== null || !(amt > 0) || amt > bal}
            className="w-full py-5 rounded-2xl bg-primary text-black font-black text-sm uppercase tracking-tighter hover:scale-[1.02] disabled:opacity-40 disabled:bg-white/5 disabled:text-foreground/30 transition-all flex items-center justify-center gap-2">
            {sameFlow(busy, "supply") ? <Loader2 size={16} className="animate-spin" /> : <Sprout size={16} />} Lend &amp; Earn
          </button>
          <p className="text-[10px] text-foreground/40 leading-relaxed">Two quick approvals in Carpincho: you transfer the USDC to the pool custodian, then sign the supply request — a real on-ledger PoolShare. Withdraw anytime.</p>
        </div>

        {/* position + withdraw */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#05080f]/40 border border-border/40 rounded-3xl p-8 space-y-5">
            <div className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/50">Your_Position</span></div>
            {yShares > 0 ? (
              <>
                <div><div className="text-3xl font-light tracking-tighter">{fmt(yValue)} <span className="text-sm text-foreground/40">USDC</span></div><div className="text-[10px] text-foreground/40 uppercase tracking-widest mt-1">{fmt(yShares)} pool shares</div></div>
                <button onClick={() => void onSimulateYield()} disabled={busy !== null} className="w-full py-3 rounded-xl bg-primary/10 border border-primary/30 text-primary font-black text-[11px] uppercase tracking-widest hover:bg-primary/20 disabled:opacity-40 flex items-center justify-center gap-2">
                  {sameFlow(busy, "yield") ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Simulate Yield
                </button>
                <button onClick={() => void onRedeem()} disabled={busy !== null} className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white font-black text-[11px] uppercase tracking-widest hover:bg-white/10 disabled:opacity-40 flex items-center justify-center gap-2">
                  {sameFlow(busy, "redeem") ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpFromLine size={14} />} Withdraw all
                </button>
              </>
            ) : <p className="text-[11px] text-foreground/40">No supply yet. Lend USDC to start earning yield from borrower interest.</p>}
          </div>
          <Link href="/faucet" className="block bg-[#0d0f14] border border-border/30 rounded-3xl p-6 hover:border-primary/40 transition-all"><Coins className="text-primary mb-3" size={20} /><div className="text-sm font-black uppercase tracking-widest">Get Test USDC</div><p className="text-[11px] text-foreground/40 mt-1">Mint testnet USDC to lend.</p></Link>
        </div>
      </div>
    </div>
  )
}
