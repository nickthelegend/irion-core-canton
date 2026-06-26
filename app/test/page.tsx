"use client"

import { useCallback, useEffect, useState } from "react"
import { ShieldCheck, Loader2, FlaskConical, Wallet, RefreshCw } from "lucide-react"
import { useStellarWallet } from "@/lib/stellar-wallet"
import { irion, type Profile } from "@/lib/irion"
import { CONTRACTS, STELLAR, NETWORK, fromUnits } from "@/lib/stellar"

const LS_PROFILE = "irion_bnpl_profile"

const IDS: [string, string][] = [
  ["IrionCore", CONTRACTS.irionCore],
  ["USDC", CONTRACTS.usdc],
  ["Groth16 Verifier", CONTRACTS.groth16Verifier],
]

export default function DiagnosticsPage() {
  const { address, connected } = useStellarWallet()

  const [usdc, setUsdc] = useState<number | null>(null)
  const [totalAssets, setTotalAssets] = useState<number | null>(null)
  const [available, setAvailable] = useState<number | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const addLog = (m: string) => setLogs((p) => [`[${new Date().toLocaleTimeString()}] ${m}`, ...p].slice(0, 50))

  const refresh = useCallback(async () => {
    setLoading(true)
    addLog("Reading on-chain state from Stellar RPC…")
    try {
      const [ta, av] = await Promise.all([
        irion.totalAssets().catch(() => null),
        irion.availableLiquidity().catch(() => null),
      ])
      setTotalAssets(ta != null ? fromUnits(ta) : null)
      setAvailable(av != null ? fromUnits(av) : null)
      addLog(ta != null ? `Pool OK: total=${fromUnits(ta)} available=${av != null ? fromUnits(av) : "?"}` : "Core contract not reachable")
      if (address) {
        const bal = await irion.usdcBalance(address).catch(() => BigInt(0))
        setUsdc(fromUnits(bal))
        const id = typeof window !== "undefined" ? localStorage.getItem(LS_PROFILE) : null
        const prof = id ? await irion.getProfile(address).catch(() => null) : await irion.getProfile(address).catch(() => null)
        setProfile(prof)
        addLog(`Wallet OK: ${fromUnits(bal)} USDC, profile ${prof ? "found" : "none"}`)
      }
    } catch (e) {
      addLog(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => { refresh() }, [refresh])

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FlaskConical className="w-7 h-7 text-primary" />
          <div className="flex flex-col">
            <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">IRION // Diagnostics · stellar_{NETWORK}</span>
            <h1 className="text-2xl font-black uppercase tracking-tighter italic">Contract Pulse</h1>
          </div>
        </div>
        {connected && address ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-bold text-primary">{address.slice(0, 10)}…</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded text-[10px] uppercase font-bold text-white/40">
            <Wallet className="w-3 h-3" /> Not connected
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* Live metrics */}
          <div className="grid grid-cols-2 gap-4">
            {[
              ["USDC Balance", address ? (usdc != null ? usdc.toLocaleString() : "…") : "—"],
              ["TEE Score", profile ? `${profile.score}` : "—"],
              ["Pool Available", available != null ? available.toLocaleString() : "…"],
              ["Total Assets", totalAssets != null ? totalAssets.toLocaleString() : "…"],
            ].map(([label, value]) => (
              <div key={label} className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                <span className="text-[10px] text-white/40 uppercase font-bold block mb-2">{label}</span>
                <div className="text-2xl font-black text-primary">{value}</div>
              </div>
            ))}
          </div>

          <button onClick={refresh} disabled={loading}
            className="w-full bg-primary text-black py-4 rounded-xl font-black uppercase text-sm tracking-widest transition-all hover:scale-[1.01] disabled:opacity-40 flex items-center justify-center gap-3">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            Re-read On-Chain State
          </button>

          {/* Configured IDs */}
          <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-white/40 mb-2">Configured_Contracts</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] border-b border-white/5 pb-2">
                <span className="text-white/40 uppercase">RPC</span>
                <span className="text-white/70 truncate ml-3">{STELLAR.rpcUrl}</span>
              </div>
              {IDS.map(([label, value]) => (
                <div key={label} className="flex justify-between text-[10px] border-b border-white/5 pb-2 last:border-0">
                  <span className="text-white/40 uppercase whitespace-nowrap">{label}</span>
                  <span className={`truncate ml-3 ${value ? "text-primary/70" : "text-amber-400"}`}>{value || "NOT_SET"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="bg-black/50 border border-white/10 rounded-2xl overflow-hidden flex flex-col h-[560px] shadow-2xl">
          <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Read_Trace</span>
            <div className={`text-[10px] font-bold uppercase px-3 py-1 rounded-full ${loading ? "bg-primary text-black animate-pulse" : "bg-primary/20 text-primary"}`}>
              {loading ? "Reading" : "Idle"}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 font-mono text-[10px] space-y-2">
            {logs.map((log, i) => (
              <div key={i} className={`p-2 rounded border border-transparent ${log.includes("Error") ? "bg-red-500/10 text-red-400 border-red-500/20" : "text-white/40"}`}>{log}</div>
            ))}
            {logs.length === 0 && <div className="text-white/20 italic flex items-center justify-center h-full">Awaiting read…</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
