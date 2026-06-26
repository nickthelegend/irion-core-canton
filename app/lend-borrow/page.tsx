"use client";

import { useCallback, useEffect, useState } from "react";
import { useStellarWallet } from "@/lib/stellar-wallet";
import { Loader2, Wallet, TrendingUp, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { irion, type Profile, type Loan } from "@/lib/irion";
import { NETWORK, fromUnits, explorerTx } from "@/lib/stellar";

const LS_LOANS = "irion_market_loans";
const MIN_SCORE = 600;
// Demo merchant (deployer) — receives the fronted purchase. Falls back to self.
const MERCHANT = process.env.NEXT_PUBLIC_IRION_MERCHANT_ADDRESS ?? "";
const TERM_LEDGERS = 518400; // ~30 days at 5s/ledger

type LoanRec = { id: string };

export default function LendBorrowPage() {
  const { address, connected, sign } = useStellarWallet();

  const [usdc, setUsdc] = useState(0);
  const [shares, setShares] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loans, setLoans] = useState<Record<string, Loan>>({});
  const [loanIds, setLoanIds] = useState<LoanRec[]>([]);
  const [supplyAmt, setSupplyAmt] = useState("100");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [borrowAmt, setBorrowAmt] = useState("50");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { setLoanIds(JSON.parse(localStorage.getItem(LS_LOANS) || "[]")); } catch { /* */ }
  }, []);

  const refresh = useCallback(async () => {
    if (!address) return;
    const [bal, sh, prof] = await Promise.all([
      irion.usdcBalance(address).catch(() => BigInt(0)),
      irion.sharesOf(address).catch(() => BigInt(0)),
      irion.getProfile(address).catch(() => null),
    ]);
    setUsdc(fromUnits(bal));
    setShares(fromUnits(sh));
    setProfile(prof);
    const stored: LoanRec[] = JSON.parse(localStorage.getItem(LS_LOANS) || "[]");
    const v: Record<string, Loan> = {};
    await Promise.all(stored.map(async (l) => { const lv = await irion.getLoan(BigInt(l.id)).catch(() => null); if (lv) v[l.id] = lv; }));
    setLoans(v);
  }, [address]);

  useEffect(() => { refresh(); }, [refresh]);

  const guard = async (label: string, fn: () => Promise<{ hash: string }>) => {
    if (!address || busy) return;
    setBusy(true);
    const toastId = toast.loading(`${label}…`);
    try {
      const { hash } = await fn();
      toast.success(label, { id: toastId, action: { label: "View", onClick: () => window.open(explorerTx(hash), "_blank", "noopener,noreferrer") } });
      await refresh();
    } catch (e) { toast.error(`${label} failed`, { id: toastId, description: e instanceof Error ? e.message : String(e) }); } finally { setBusy(false); }
  };

  const saveLoans = (next: LoanRec[]) => { localStorage.setItem(LS_LOANS, JSON.stringify(next)); setLoanIds(next); };

  const onSupply = () => guard(`Supply ${supplyAmt} USDC`, () => irion.supply(address!, Number(supplyAmt), sign));

  const onWithdraw = () => {
    const sh = Number(withdrawAmt);
    if (!(sh > 0)) return;
    // shares are i128 raw units; convert the human figure back to raw 7-dp units
    return guard(`Withdraw ${withdrawAmt} shares`, () => irion.withdraw(address!, BigInt(Math.round(sh * 1e7)), sign));
  };

  const onBorrow = () => {
    const amt = Number(borrowAmt);
    // Unsecured borrow against the credit line (lifted by a ZK credit proof) —
    // no collateral. New borrowers get the 50 USDC starter line.
    return guard(`Borrow ${amt} USDC (unsecured · ZK credit)`, async () => {
      const res = await irion.borrowUnsecured(address!, amt, TERM_LEDGERS, sign);
      const id = res.returnValue != null ? String(res.returnValue) : null;
      if (id) saveLoans([...loanIds, { id }]);
      return res;
    });
  };

  const onRepay = (id: string, lv: Loan) => guard(`Repay ${fromUnits(lv.outstanding)} USDC`, () => irion.repay(address!, BigInt(id), fromUnits(lv.outstanding), sign));
  const onRelease = (id: string) => guard("Release collateral", async () => {
    const res = await irion.releaseCollateral(address!, BigInt(id), sign);
    saveLoans(loanIds.filter((x) => x.id !== id));
    return res;
  });

  if (!connected || !address) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 font-mono text-white">
        <Wallet className="w-8 h-8 text-primary/60" />
        <p className="text-sm text-foreground/50 uppercase tracking-widest">Connect your Stellar wallet to lend &amp; borrow</p>
      </div>
    );
  }

  const score = profile?.score ?? 0;
  const creditLimit = profile ? fromUnits(profile.credit_limit) : 0;
  const outstanding = profile ? fromUnits(profile.outstanding) : 0;
  const available = Math.max(0, creditLimit - outstanding);
  const openLoans = loanIds.map((l) => ({ id: l.id, view: loans[l.id] })).filter((l) => l.view && l.view.status === 0 && fromUnits(l.view.outstanding) > 0);

  const Card = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className="bg-[#0d0f14] border border-border/30 rounded-3xl p-6 space-y-4 flex flex-col">
      <div className="flex items-center gap-2 text-primary/70 text-[10px] font-black uppercase tracking-widest">{icon}{title}</div>
      {children}
    </div>
  );
  const Field = ({ v, set, placeholder }: { v: string; set: (s: string) => void; placeholder?: string }) => (
    <input type="number" value={v} placeholder={placeholder} onChange={(e) => set(e.target.value)} className="w-full bg-[#05080f]/60 border border-border/20 rounded-xl px-3 py-2.5 text-lg font-light text-white focus:outline-none focus:border-primary/40" />
  );
  const Btn = ({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) => (
    <button onClick={onClick} disabled={disabled || busy}
      className="w-full h-11 rounded-xl bg-primary text-black text-[11px] font-black uppercase tracking-widest hover:scale-[1.01] disabled:opacity-40 disabled:bg-white/5 disabled:text-foreground/30 flex items-center justify-center gap-2 transition-all">
      {busy ? <Loader2 size={14} className="animate-spin" /> : null}{children}
    </button>
  );

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">IRION // Lend_Borrow_Market · stellar_{NETWORK}</span>
        <h1 className="text-3xl md:text-5xl tracking-tighter font-black uppercase">Money_Market</h1>
      </div>

      {/* top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[["USDC", usdc.toLocaleString()], ["Pool_Shares", shares.toLocaleString()], ["Available_Credit", profile ? `${available}` : "—"], ["ZK_Score", profile ? `${score}` : "—"]].map(([l, v]) => (
          <div key={l} className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-4 flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">{l}</span>
            <span className="text-2xl font-light tracking-tighter">{v}</span>
          </div>
        ))}
      </div>

      {!profile && (
        <button onClick={() => guard("Open credit profile", () => irion.openProfile(address, sign))} disabled={busy} className="self-start px-5 h-10 rounded-xl bg-primary/10 border border-primary/30 text-primary text-[11px] font-black uppercase tracking-widest hover:bg-primary/20 disabled:opacity-40">Open_Credit_Profile</button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Supply */}
        <Card icon={<TrendingUp size={14} />} title="Supply (earn yield)">
          <p className="text-[11px] text-foreground/40">Deposit USDC into the pool. Earns interest paid by borrowers.</p>
          <Field v={supplyAmt} set={setSupplyAmt} />
          <Btn onClick={onSupply} disabled={usdc < Number(supplyAmt)}>Supply_USDC</Btn>
        </Card>

        {/* Withdraw */}
        <Card icon={<TrendingUp size={14} />} title="Withdraw (redeem shares)">
          <p className="text-[11px] text-foreground/40">Burn pool shares to redeem principal + accrued yield. You hold {shares.toLocaleString()} shares.</p>
          <Field v={withdrawAmt} set={setWithdrawAmt} placeholder={String(shares)} />
          <Btn onClick={() => onWithdraw()} disabled={!(Number(withdrawAmt) > 0) || Number(withdrawAmt) > shares}>Withdraw</Btn>
        </Card>

        {/* Unsecured borrow against the ZK credit line */}
        <Card icon={<Lock size={14} />} title="Borrow — unsecured">
          <p className="text-[11px] text-foreground/40">Draw against your ZK-verified credit line — no collateral. Needs a score ≥ {MIN_SCORE}; carries a +5% premium over collateralized BNPL.</p>
          <Field v={borrowAmt} set={setBorrowAmt} />
          <p className="text-[10px] text-foreground/30">Available credit: {available.toLocaleString()} USDC · score {score}</p>
          <Btn onClick={() => onBorrow()} disabled={score < MIN_SCORE || !(Number(borrowAmt) > 0) || Number(borrowAmt) > available}>Borrow_Unsecured</Btn>
          {!!profile && score < MIN_SCORE && (
            <p className="text-[10px] text-amber-400/70">Unsecured borrowing needs a ZK score ≥ {MIN_SCORE} (prove one on /credit).</p>
          )}
        </Card>
      </div>

      {/* positions */}
      {openLoans.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Open_Loans</span>
          {openLoans.map(({ id, view }) => (
            <div key={id} className="bg-[#0d0f14] border border-border/30 rounded-2xl p-4 flex items-center justify-between gap-3">
              <span className="text-[11px] text-foreground/50 truncate flex items-center gap-2"><ShieldCheck size={12} className="text-primary/60" />Loan #{id} · {fromUnits(view!.outstanding).toLocaleString()} USDC due</span>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => onRepay(id, view!)} disabled={busy || usdc < fromUnits(view!.outstanding)} className="px-3 h-9 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase hover:bg-primary/20 disabled:opacity-40">Repay_{fromUnits(view!.outstanding)}</button>
                <button onClick={() => onRelease(id)} disabled={busy} className="px-3 h-9 rounded-lg bg-white/5 border border-border/40 text-[10px] font-black uppercase hover:border-primary/40 disabled:opacity-40">Reclaim</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
