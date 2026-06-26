"use client"

import { useState } from "react"
import { Info, Loader2, AlertTriangle, ShieldCheck } from "lucide-react"
import { TokenIcon } from "@/components/token-icon"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useStellarWallet } from "@/lib/stellar-wallet"
import { USDC_DECIMALS, NETWORK, explorerTx, StrKey } from "@/lib/stellar"

const FAUCET_MAX_USDC = 10_000

const isValidStellarAddress = (addr: string) => {
  try { return StrKey.isValidEd25519PublicKey(addr) } catch { return false }
}

export default function FaucetPage() {
  const { address, connected } = useStellarWallet()

  const [amount, setAmount] = useState("")
  const [recipient, setRecipient] = useState("")
  const [busy, setBusy] = useState(false)

  const effectiveRecipient = (recipient.trim() || address) ?? ""
  const parsed = parseFloat(amount)
  const isOverMax = !isNaN(parsed) && parsed > FAUCET_MAX_USDC
  const isValidAmount = !isNaN(parsed) && parsed > 0 && !isOverMax
  const isValidRecipient = effectiveRecipient !== "" && isValidStellarAddress(effectiveRecipient)
  const canSubmit = isValidAmount && isValidRecipient && connected && !busy

  const handleDispense = async () => {
    if (!canSubmit) return
    setBusy(true)
    const toastId = toast.loading(`Minting ${parsed} USDC…`)
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: effectiveRecipient, amount: parsed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Faucet failed", { id: toastId, description: data.instructions })
        return
      }
      toast.dismiss(toastId)
      const url = data.hash ? explorerTx(data.hash) : null
      toast.success(`Minted ${parsed} USDC`, {
        description: url ? "View on Stellar.expert ↗" : undefined,
        action: url ? { label: "View", onClick: () => window.open(url, "_blank", "noopener,noreferrer") } : undefined,
      })
      setAmount("")
    } catch (e) {
      toast.error("Faucet request failed", { id: toastId, description: e instanceof Error ? e.message : String(e) })
    } finally { setBusy(false) }
  }
  const status = busy ? "loading" : "idle"

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-[0.4em] text-primary/60 uppercase">IRION_Faucet // stellar_{NETWORK}</span>
        <h1 className="text-white text-3xl md:text-5xl tracking-tighter font-black uppercase">Testnet_Resources</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 bg-[#0d0f14] border border-border/30 rounded-3xl overflow-hidden">
          <div className="p-8 space-y-5">
            <div className="space-y-1">
              <h3 className="text-xl font-black uppercase tracking-widest text-white">Mint_Test_USDC</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-foreground/30">
                Stellar_SAC_Faucet // Server_Signed
              </p>
            </div>

            {!connected && (
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                <Info size={14} className="text-primary/40 flex-shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-tighter text-primary/40">Connect_your_Stellar_wallet_to_mint</span>
              </div>
            )}

            {/* Recipient */}
            <div className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-5 space-y-2 group focus-within:border-primary/40 transition-all">
              <label className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Recipient_Address (defaults to you)</label>
              <input type="text" value={recipient} onChange={e => setRecipient(e.target.value.trim())}
                placeholder={address ?? "G... stellar address"}
                className={`w-full bg-transparent text-sm font-mono placeholder:text-foreground/20 focus:outline-none ${effectiveRecipient && !isValidRecipient ? "text-red-400" : "text-foreground/70"}`} />
              {effectiveRecipient !== "" && !isValidRecipient && <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">INVALID_STELLAR_ADDRESS</p>}
            </div>

            {/* Amount */}
            <div className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-5 space-y-3 group focus-within:border-primary/40 transition-all">
              <label className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Amount_To_Mint</label>
              <div className="flex items-center gap-3">
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  className={`flex-1 bg-transparent text-4xl font-light tracking-tighter placeholder:text-foreground/20 focus:outline-none min-w-0 ${isOverMax ? "text-red-400" : "text-foreground/60"}`} />
                <div className="flex items-center gap-2 bg-[#1a1d24] border border-border/40 rounded-xl px-3 py-2.5 min-w-[110px]">
                  <TokenIcon symbol="USDC" size={20} className="flex-shrink-0" />
                  <span className="text-sm font-semibold text-white">USDC</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-foreground/30">Max_Per_Request</span>
                <button type="button" onClick={() => setAmount(FAUCET_MAX_USDC.toString())}
                  className="text-primary/70 hover:text-primary font-black transition-colors">
                  {FAUCET_MAX_USDC.toLocaleString()} USDC
                </button>
              </div>
              {isOverMax && (
                <div className="flex items-center gap-2 text-red-400 text-[11px]">
                  <AlertTriangle size={12} />
                  Max is {FAUCET_MAX_USDC.toLocaleString()} USDC per request
                </div>
              )}
            </div>

            <button
              onClick={handleDispense}
              disabled={status === "loading" || !canSubmit}
              className={cn(
                "w-full py-5 rounded-2xl font-black text-sm uppercase tracking-tighter transition-all flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(166,242,74,0.1)]",
                status === "loading" || !canSubmit ? "bg-white/5 text-foreground/20" : "bg-primary text-black"
              )}
            >
              {status === "loading"
                ? <><Loader2 size={16} className="animate-spin" /> MINTING_RESOURCES...</>
                : `MINT_${amount ? Number(amount).toLocaleString() : "—"}_USDC`}
            </button>

          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#05080f]/40 border border-border/40 rounded-3xl p-8 backdrop-blur-md space-y-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/50">How_It_Works</span>
            </div>
            <div className="space-y-2 text-[11px] text-foreground/40 leading-relaxed font-mono">
              <p className="text-foreground/60">Mints test USDC via the contract admin, server-side.</p>
              <p>No wallet signature needed — the faucet route signs with the deployer key (FAUCET_SECRET).</p>
              <p className="mt-3">Network: <span className="text-primary/60">Stellar {NETWORK}</span></p>
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">DISPENSE_POLICY</h3>
            <div className="space-y-3 font-mono text-[10px]">
              <div className="flex justify-between border-b border-primary/10 pb-2">
                <span className="text-foreground/40">Asset</span>
                <span className="text-white font-bold">USDC (test)</span>
              </div>
              <div className="flex justify-between border-b border-primary/10 pb-2">
                <span className="text-foreground/40">Decimals</span>
                <span className="text-foreground/60">{USDC_DECIMALS}</span>
              </div>
              <div className="flex justify-between border-b border-primary/10 pb-2 last:border-0">
                <span className="text-foreground/40">Max per request</span>
                <span className="text-primary font-bold">{FAUCET_MAX_USDC.toLocaleString()} USDC</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
