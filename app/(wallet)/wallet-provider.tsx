"use client"

// Carpincho-backed wallet provider. Imports the connect-kit (browser-only), so the
// layout loads this with dynamic(ssr:false). Manages shared wallet state + the
// chrome (connect gate, KPI cards, sub-nav) and feeds the context defined in wallet.tsx.
import { useEffect, useState } from "react"
import { Wallet, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ConnectKitProvider, useConnect, useExecute, useParty } from "@/lib/canton-connect-kit"
import type { ConnectKitConfig } from "@/lib/canton-connect-kit"
import {
  fetchOperatorParty, buildBnplCommand, completeBorrow, faucet, getPositions,
  repayContext, buildRepayCommand, type Positions, type ConsumerLoan,
  lendContext, lendEscrow, lendComplete, buildSupplyEscrowCommand, buildSupplyRequestCommand,
  withdrawContext, buildWithdrawRequestCommand, withdrawComplete, simulateYield,
} from "@/lib/canton-pay"
import { Ctx, Warn, type Flow, type WalletCtx } from "./wallet"

const CONNECT_CONFIG: ConnectKitConfig = {
  appName: "Irion Wallet",
  appDescription: "Private lending & credit on Canton",
  network: "canton:irion-sandbox",
}

function errMsg(e: unknown): string {
  if (e == null) return "Unknown error"
  if (typeof e === "string") return e
  if (e instanceof Error) return typeof e.message === "string" ? e.message : JSON.stringify(e.message)
  if (typeof e === "object") {
    const o = e as Record<string, unknown>
    const m = o.message ?? o.error ?? o.reason ?? o.detail
    if (typeof m === "string") return m
    try { return JSON.stringify(e) } catch { return String(e) }
  }
  return String(e)
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConnectKitProvider config={CONNECT_CONFIG}>
      <Inner>{children}</Inner>
    </ConnectKitProvider>
  )
}

function Inner({ children }: { children: React.ReactNode }) {
  const { connect, isConnecting, isConnected, connectError } = useConnect()
  const { party } = useParty()
  const { execute } = useExecute()

  const [operator, setOperator] = useState<string | undefined>(undefined)
  const [setupError, setSetupError] = useState<string | undefined>(undefined)
  const [positions, setPositions] = useState<Positions | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<Flow | null>(null)

  useEffect(() => {
    void fetchOperatorParty().then((op) => { setOperator(op); setSetupError(undefined) }).catch((e: unknown) => setSetupError(errMsg(e)))
  }, [])
  useEffect(() => { if (isConnected && party) toast.success("Carpincho connected") /* eslint-disable-next-line */ }, [isConnected])
  useEffect(() => { if (connectError && !isConnected) toast.error(errMsg(connectError)) /* eslint-disable-next-line */ }, [connectError])
  useEffect(() => { if (party) void reload(); else setPositions(null) /* eslint-disable-next-line */ }, [party?.partyId])

  async function reload(): Promise<void> {
    if (!party) return
    setLoading(true)
    try { setPositions(await getPositions(party.partyId)) } catch (e) { toast.error(errMsg(e)) } finally { setLoading(false) }
  }
  const onFaucet = async (amount = 100) => { if (!party) return; setBusy("faucet"); try { await faucet(party.partyId, amount); toast.success(`Minted ${amount} USDC`); await reload() } catch (e) { toast.error(errMsg(e)) } finally { setBusy(null) } }
  const onBorrow = async (amount: number) => { if (!party || operator === undefined || amount <= 0) return; setBusy("borrow"); try { toast.info("Approve in Carpincho…"); await execute({ commands: [buildBnplCommand({ operator, borrower: party.partyId, amount })] }); await completeBorrow(party.partyId); toast.success(`Borrowed ${amount} USDC`); await reload() } catch (e) { toast.error(errMsg(e)) } finally { setBusy(null) } }
  // Self-custody lend: wallet transfers a token whole (sign 1) → operator carves the
  // exact escrow + refunds change → wallet signs the SupplyRequest (sign 2) → operator accepts.
  const onLend = async (amount: number) => {
    if (!party || amount <= 0) return; setBusy("supply")
    try {
      const ctx = await lendContext(party.partyId, amount)
      toast.info("Approve the deposit in Carpincho…")
      await execute({ commands: [buildSupplyEscrowCommand(ctx.sourceTokenCid, ctx.operator)] })
      const esc = await lendEscrow(party.partyId, amount, ctx.sourceAmount)
      toast.info("Confirm the supply in Carpincho…")
      await execute({ commands: [buildSupplyRequestCommand({ operator: ctx.operator, supplier: party.partyId, usdcIssuer: ctx.usdcIssuer, amount, escrowCid: esc.escrowCid })] })
      await lendComplete(party.partyId)
      toast.success(`Lent ${amount} USDC`); await reload()
    } catch (e) { toast.error(errMsg(e)) } finally { setBusy(null) }
  }
  const onRedeem = async () => {
    if (!party) return; setBusy("redeem")
    try {
      const ctx = await withdrawContext(party.partyId)
      toast.info("Approve the withdrawal in Carpincho…")
      await execute({ commands: [buildWithdrawRequestCommand({ operator: ctx.operator, supplier: party.partyId, shareCid: ctx.shareCid })] })
      await withdrawComplete(party.partyId)
      toast.success("Redeemed yield to USDC"); await reload()
    } catch (e) { toast.error(errMsg(e)) } finally { setBusy(null) }
  }
  const onRepay = async (loan: ConsumerLoan) => { if (!party) return; setBusy({ repay: loan.id }); try { const ctx = await repayContext(party.partyId, loan.id, loan.outstanding); toast.info("Approve repayment in Carpincho…"); await execute({ commands: [buildRepayCommand(party.partyId, ctx, loan.outstanding)], disclosedContracts: ctx.disclosed }); toast.success("Repaid ✓"); await reload() } catch (e) { toast.error(errMsg(e)) } finally { setBusy(null) } }

  const onSimulateYield = async () => {
    if (!party) return; setBusy("yield")
    try { await simulateYield(party.partyId); toast.success("Yield simulated ✓ — your supplied value grew"); await reload() }
    catch (e) { toast.error(errMsg(e)) } finally { setBusy(null) }
  }

  const doConnect = () => void connect("extension").catch((e) => toast.error(errMsg(e)))
  const value: WalletCtx = { party: party?.partyId, operator, positions, loading, busy, reload, isConnected: !!isConnected && !!party, connect: doConnect, onFaucet, onBorrow, onRepay, onLend, onRedeem, onSimulateYield }

  // Minimal chrome: a connect-gate. Each wallet page (/borrow, /credit, …) renders
  // its own full layout; the header provides nav. Carpincho persists across pages.
  return (
    <div className="mx-auto w-full max-w-6xl text-white">
      {setupError !== undefined && <div className="mt-6"><Warn icon={<AlertCircle size={14} />}>Operator unavailable: {setupError}</Warn></div>}
      {!(isConnected && party) ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-6 font-mono">
          <div className="glass-card rounded-lg border border-primary/20 p-10 flex flex-col items-center gap-6 shadow-[0_0_30px_rgba(166,242,74,0.08)] max-w-md">
            <div className="size-16 bg-primary/10 rounded-full flex items-center justify-center border border-primary/30"><Wallet className="size-7 text-primary" /></div>
            <div className="text-center flex flex-col gap-1">
              <h1 className="text-xl font-black uppercase tracking-tighter text-white">Connect Carpincho</h1>
              <p className="text-[10px] text-white/40 uppercase tracking-[0.15em] leading-relaxed">Private lending & credit on Canton — connect your self-custody wallet to continue.</p>
            </div>
            <button onClick={doConnect} disabled={isConnecting} className="w-full py-4 rounded-xl bg-primary text-black font-black text-xs uppercase tracking-[0.2em] hover:scale-[1.02] disabled:opacity-40 transition-all flex items-center justify-center gap-2">
              {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />} {isConnecting ? "Connecting…" : "Connect Carpincho"}
            </button>
            <p className="text-[9px] text-white/30 uppercase tracking-widest text-center">Set Carpincho&apos;s <code>walletServiceRpcUrl</code> to the Irion gateway first.</p>
            {connectError !== undefined && <Warn icon={<AlertCircle size={14} />}>{errMsg(connectError)}</Warn>}
          </div>
        </div>
      ) : (
        <Ctx.Provider value={value}>{children}</Ctx.Provider>
      )}
    </div>
  )
}
