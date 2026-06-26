"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Database, ShieldCheck, ExternalLink, History, Loader2, RefreshCw,
  ArrowUpRight, CheckCircle2, XCircle, Wallet,
} from "lucide-react"
import { useStellarWallet } from "@/lib/stellar-wallet"
import { STELLAR, NETWORK, explorerTx, explorerAccount } from "@/lib/stellar"

type TxRow = {
  hash: string
  createdAt: string | null
  status: "success" | "failure"
  operations: number
  feeCharged: number | null
}

const short = (h: string) => `${h.slice(0, 8)}…${h.slice(-6)}`

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "—"
  const ms = new Date(iso).getTime()
  const seconds = Math.floor((Date.now() - ms) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function TransactionsPage() {
  const { address, connected } = useStellarWallet()

  const [txns, setTxns] = useState<TxRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!address) return
    setLoading(true)
    setError(null)
    try {
      // Horizon account transactions (newest first).
      const url = `${STELLAR.horizonUrl}/accounts/${address}/transactions?order=desc&limit=30&include_failed=true`
      const res = await fetch(url)
      if (!res.ok) {
        if (res.status === 404) { setTxns([]); return } // account not yet on-chain
        throw new Error(`Horizon returned ${res.status}`)
      }
      const json = await res.json()
      const records: any[] = json?._embedded?.records ?? []
      setTxns(records.map((t) => ({
        hash: t.hash,
        createdAt: t.created_at ?? null,
        status: t.successful ? "success" : "failure",
        operations: Number(t.operation_count ?? 0),
        feeCharged: t.fee_charged != null ? Number(t.fee_charged) / 1e7 : null,
      })))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to query transactions")
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => { refresh() }, [refresh])

  return (
    <div className="flex flex-col gap-8 py-8 font-mono text-white">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] tracking-[0.4em] text-primary/60 uppercase">IRION // Activity · stellar_{NETWORK}</span>
          <h1 className="text-white text-3xl tracking-tighter font-black uppercase">Transaction History</h1>
        </div>
        <button onClick={refresh} disabled={loading || !connected}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-5 py-2.5 text-[10px] uppercase tracking-widest font-bold transition-all disabled:opacity-40">
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-8 flex flex-col gap-4">
          <div className="space-y-4">
            {!connected && (
              <div className="bg-card/20 border border-border/40 rounded-2xl p-12 text-center">
                <Wallet size={48} className="mx-auto text-foreground/20 mb-4" />
                <p className="text-sm text-foreground/40">Connect your Stellar wallet to view transaction history</p>
              </div>
            )}
            {connected && loading && (
              <div className="bg-card/20 border border-border/40 rounded-2xl p-12 text-center">
                <Loader2 size={28} className="mx-auto text-primary animate-spin mb-4" />
                <p className="text-sm text-foreground/40">Querying Horizon…</p>
              </div>
            )}
            {connected && !loading && error && (
              <div className="bg-card/20 border border-border/40 rounded-2xl p-12 text-center"><p className="text-sm text-red-400">{error}</p></div>
            )}
            {connected && !loading && !error && txns.length === 0 && (
              <div className="bg-card/20 border border-border/40 rounded-2xl p-12 text-center">
                <History size={48} className="mx-auto text-foreground/20 mb-4" />
                <p className="text-sm text-foreground/40">No transactions found</p>
                <p className="text-xs text-foreground/30 mt-2">Your Stellar activity will appear here once you transact.</p>
              </div>
            )}
            {connected && !loading && !error && txns.map((t) => (
              <a key={t.hash} href={explorerTx(t.hash)} target="_blank" rel="noopener noreferrer"
                className="bg-card/20 border border-border/40 rounded-2xl p-6 flex items-center justify-between hover:bg-white/[0.04] transition-all group backdrop-blur-sm shadow-xl">
                <div className="flex items-center gap-6">
                  <div className="size-14 rounded-2xl bg-white/5 border border-border/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {t.status === "success" ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <XCircle className="w-5 h-5 text-red-400" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-bold text-lg tracking-tight">{t.operations} op{t.operations === 1 ? "" : "s"}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded border font-black tracking-widest uppercase ${t.status === "success" ? "bg-primary/10 text-primary border-primary/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                        {t.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 font-mono">
                      <span className="text-[10px] text-foreground/40 uppercase font-black">{formatTimeAgo(t.createdAt)}</span>
                      <span className="text-[10px] text-foreground/20">|</span>
                      <span className="text-[10px] text-primary/60 group-hover:text-primary flex items-center gap-1 font-bold underline">
                        {short(t.hash)} <ExternalLink size={10} />
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-foreground/40 uppercase font-black">Fee (XLM)</div>
                  <div className="text-white font-black text-lg tabular-nums tracking-tighter">
                    {t.feeCharged != null ? t.feeCharged.toFixed(5) : "—"}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="lg:col-span-4 space-y-6">
          <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <ShieldCheck size={16} /> On_Chain_Ledger
            </h3>
            <p className="text-[10px] text-foreground/60 leading-relaxed font-mono">
              Every action settles on Stellar {NETWORK}. This view queries Horizon directly for transactions on your connected account — tap any row to inspect it on Stellar.expert.
            </p>
            <div className="pt-4 border-t border-primary/10 space-y-3">
              <div className="flex justify-between text-[10px]">
                <span className="text-foreground/40">NETWORK</span>
                <span className="text-white font-bold uppercase">Stellar {NETWORK}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-foreground/40">SHOWING</span>
                <span className="text-primary font-bold">{txns.length} most recent</span>
              </div>
            </div>
          </div>

          <a href={address ? explorerAccount(address) : "#"}
            target="_blank" rel="noopener noreferrer"
            className={`block bg-[#05080f]/40 border border-border/40 rounded-3xl p-6 ${address ? "hover:border-primary/40" : "opacity-50 pointer-events-none"} transition-all`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-foreground/50">View full account</span>
              <ArrowUpRight size={16} className="text-primary" />
            </div>
          </a>
        </section>
      </div>
    </div>
  )
}
