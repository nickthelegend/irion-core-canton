"use client"

import { useState } from "react"
import { Info, Loader2, AlertTriangle, ShieldCheck } from "lucide-react"
import { TokenIcon } from "@/components/token-icon"
import { cn } from "@/lib/utils"
import { useWallet, sameFlow, short } from "../wallet"

const FAUCET_MAX = 10_000
const DECIMALS = 6

export default function FaucetPage() {
  const { party, busy, onFaucet } = useWallet()
  const [amount, setAmount] = useState("")

  const parsed = parseFloat(amount)
  const isOverMax = !isNaN(parsed) && parsed > FAUCET_MAX
  const isValidAmount = !isNaN(parsed) && parsed > 0 && !isOverMax
  const minting = sameFlow(busy, "faucet")
  const canSubmit = isValidAmount && !!party && !minting

  const handleDispense = async () => {
    if (!canSubmit) return
    await onFaucet(parsed)
    setAmount("")
  }

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-[0.4em] text-primary/60 uppercase animate-pulse">IRION_Faucet // canton_sandbox</span>
        <h1 className="text-white text-3xl md:text-5xl tracking-tighter font-black uppercase">Testnet_Resources</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 bg-[#0d0f14] border border-border/30 rounded-3xl overflow-hidden">
          <div className="p-8 space-y-5">
            <div className="space-y-1">
              <h3 className="text-xl font-black uppercase tracking-widest text-white">Mint_Test_USDC</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-foreground/30">Canton_Daml_Faucet // Operator_Signed</p>
            </div>

            {!party && (
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                <Info size={14} className="text-primary/40 flex-shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-tighter text-primary/40">Connect_Carpincho_to_mint</span>
              </div>
            )}

            {/* Recipient (your connected Canton party) */}
            <div className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-5 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Recipient (your Canton party)</label>
              <p className="text-sm font-mono text-foreground/70 break-all">{party ? short(party, 16, 12) : "—"}</p>
            </div>

            {/* Amount */}
            <div className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-5 space-y-3 group focus-within:border-primary/40 transition-all">
              <label className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Amount_To_Mint</label>
              <div className="flex items-center gap-3">
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
                  className={`flex-1 bg-transparent text-4xl font-light tracking-tighter placeholder:text-foreground/20 focus:outline-none min-w-0 ${isOverMax ? "text-red-400" : "text-foreground/60"}`} />
                <div className="flex items-center gap-2 bg-[#1a1d24] border border-border/40 rounded-xl px-3 py-2.5 min-w-[110px]">
                  <TokenIcon symbol="USDC" size={20} className="flex-shrink-0" />
                  <span className="text-sm font-semibold text-white">USDC</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-foreground/30">Max_Per_Request</span>
                <button type="button" onClick={() => setAmount(FAUCET_MAX.toString())} className="text-primary/70 hover:text-primary font-black transition-colors">{FAUCET_MAX.toLocaleString()} USDC</button>
              </div>
              {isOverMax && <div className="flex items-center gap-2 text-red-400 text-[11px]"><AlertTriangle size={12} /> Max is {FAUCET_MAX.toLocaleString()} USDC per request</div>}
            </div>

            <button onClick={handleDispense} disabled={!canSubmit}
              className={cn("w-full py-5 rounded-2xl font-black text-sm uppercase tracking-tighter transition-all flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(166,242,74,0.1)]", !canSubmit ? "bg-white/5 text-foreground/20" : "bg-primary text-black")}>
              {minting ? <><Loader2 size={16} className="animate-spin" /> MINTING_RESOURCES...</> : `MINT_${amount ? Number(amount).toLocaleString() : "—"}_USDC`}
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#05080f]/40 border border-border/40 rounded-3xl p-8 backdrop-blur-md space-y-6">
            <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/50">How_It_Works</span></div>
            <div className="space-y-2 text-[11px] text-foreground/40 leading-relaxed font-mono">
              <p className="text-foreground/60">The Irion operator mints test USDC straight to your Canton party on the Daml ledger.</p>
              <p>No gas, no signature needed — it&apos;s an issuer mint, the same on-ledger effect a real on-ramp produces.</p>
              <p className="mt-3">Network: <span className="text-primary/60">Canton sandbox</span></p>
              <p>Status: <span className="text-primary/60">LIVE</span></p>
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">DISPENSE_POLICY</h3>
            <div className="space-y-3 font-mono text-[10px]">
              <div className="flex justify-between border-b border-primary/10 pb-2"><span className="text-foreground/40">Asset</span><span className="text-white font-bold">USDC (test)</span></div>
              <div className="flex justify-between border-b border-primary/10 pb-2"><span className="text-foreground/40">Decimals</span><span className="text-foreground/60">{DECIMALS}</span></div>
              <div className="flex justify-between pb-2"><span className="text-foreground/40">Max per request</span><span className="text-primary font-bold">{FAUCET_MAX.toLocaleString()} USDC</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
