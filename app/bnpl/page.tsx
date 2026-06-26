"use client";

import { useCallback, useEffect, useState } from "react";
import { useStellarWallet } from "@/lib/stellar-wallet";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Wallet, CreditCard, CalendarClock, CheckCircle2 } from "lucide-react";
import { irion, type Profile, type Loan } from "@/lib/irion";
import { NETWORK, fromUnits, explorerTx } from "@/lib/stellar";

const LS_LOANS = "irion_bnpl_loans";
const MERCHANT = process.env.NEXT_PUBLIC_IRION_MERCHANT_ADDRESS ?? "";
const TERM_LEDGERS = 518400; // ~30 days at 5s/ledger

// A loan we opened, plus its (optional) EMI plan. n=1 => pay-in-full.
type LoanRec = { id: string; n: number; perAmount: number; startMs: number; paid: number };

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function BnplPage() {
  const { address, connected, sign } = useStellarWallet();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loans, setLoans] = useState<LoanRec[]>([]);
  const [views, setViews] = useState<Record<string, Loan>>({});
  const [usdc, setUsdc] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const [amount, setAmount] = useState("120");
  const [emiN, setEmiN] = useState(3);
  const [repayInput, setRepayInput] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_LOANS) || "[]");
      setLoans(raw.map((x: unknown) => (typeof x === "string" ? { id: x, n: 1, perAmount: 0, startMs: 0, paid: 0 } : x)));
    } catch { /* noop */ }
  }, []);

  const persist = (next: LoanRec[]) => { setLoans(next); localStorage.setItem(LS_LOANS, JSON.stringify(next)); };

  const refresh = useCallback(async () => {
    if (!address) return;
    const [bal, prof] = await Promise.all([
      irion.usdcBalance(address).catch(() => BigInt(0)),
      irion.getProfile(address).catch(() => null),
    ]);
    setUsdc(fromUnits(bal));
    setProfile(prof);
    const stored: LoanRec[] = JSON.parse(localStorage.getItem(LS_LOANS) || "[]");
    const v: Record<string, Loan> = {};
    await Promise.all(stored.map(async (l) => { const lv = await irion.getLoan(BigInt(l.id)).catch(() => null); if (lv) v[l.id] = lv; }));
    setViews(v);
  }, [address]);

  useEffect(() => { refresh(); }, [refresh]);

  const run = async (label: string, fn: () => Promise<{ hash: string }>, after?: () => void) => {
    if (!address) return;
    setBusy(label);
    const toastId = toast.loading(`${label}…`);
    try {
      const res = await fn();
      after?.();
      toast.success(label, { id: toastId, action: { label: "View", onClick: () => window.open(explorerTx(res.hash), "_blank", "noopener,noreferrer") } });
      await refresh();
    } catch (e) { toast.error(`${label} failed`, { id: toastId, description: e instanceof Error ? e.message : String(e) }); } finally { setBusy(null); }
  };

  const onCreateProfile = () => run("Open credit profile", () => irion.openProfile(address!, sign));

  const onBuy = () => {
    const amt = Number(amount);
    if (!(amt > 0)) return;
    const merchant = MERCHANT || address!;
    run(`Buy ${fmt(amt)} USDC${emiN > 1 ? ` · split ${emiN}` : ""}`,
      async () => {
        const res = await irion.openPurchase(address!, merchant, amt, amt, TERM_LEDGERS, sign);
        const id = res.returnValue != null ? String(res.returnValue) : null;
        if (id) {
          const rec: LoanRec = { id, n: emiN, perAmount: Math.ceil((amt / emiN) * 100) / 100, startMs: Date.now(), paid: 0 };
          persist([...loans, rec]);
        }
        return res;
      });
  };

  const onRepay = (l: LoanRec, amt: number, label: string) => {
    if (!address || !(amt > 0)) return;
    run(label, () => irion.repay(address, BigInt(l.id), amt, sign), () => {
      persist(loans.map((x) => (x.id === l.id ? { ...x, paid: Math.min(x.n, x.paid + 1) } : x)));
    });
  };

  if (!connected || !address) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 font-mono text-white">
        <Wallet className="w-8 h-8 text-primary/60" />
        <p className="text-sm text-foreground/50 uppercase tracking-widest">Connect your Stellar wallet to use Buy Now, Pay Never</p>
      </div>
    );
  }

  const hasProfile = !!profile;
  const creditLimit = profile ? fromUnits(profile.credit_limit) : 0;
  const outstanding = profile ? fromUnits(profile.outstanding) : 0;

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-4 flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">{label}</span>
      <span className="text-2xl font-light tracking-tighter text-white">{value}</span>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">IRION // Buy_Now_Pay_Never · stellar_{NETWORK}</span>
        <h1 className="text-3xl md:text-5xl tracking-tighter font-black uppercase">Credit &amp; Repayment</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="USDC_Balance" value={fmt(usdc)} />
        <Stat label="Credit_Limit" value={profile ? fmt(creditLimit) : "—"} />
        <Stat label="Outstanding" value={profile ? fmt(outstanding) : "—"} />
        <Stat label="ZK_Score" value={profile ? `${profile.score}` : "—"} />
      </div>

      {/* Setup + buy */}
      <div className="bg-[#0d0f14] border border-border/30 rounded-3xl p-6 flex flex-col gap-5">
        <div className="flex flex-wrap gap-3">
          {!hasProfile && (
            <button onClick={onCreateProfile} disabled={!!busy} className="px-5 h-11 rounded-xl bg-primary/10 border border-primary/30 text-primary text-[11px] font-black uppercase tracking-widest hover:bg-primary/20 disabled:opacity-40 flex items-center gap-2">
              {busy === "Open credit profile" ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />} Open_Credit_Profile
            </button>
          )}
        </div>

        {hasProfile && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Purchase_Amount (USDC)</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-40 bg-[#05080f]/60 border border-border/30 rounded-xl px-4 h-11 text-lg focus:border-primary/40 focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Repayment_Plan</label>
                <div className="flex gap-2">
                  {[1, 3, 4].map((n) => (
                    <button key={n} onClick={() => setEmiN(n)} className={`px-3 h-11 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all ${emiN === n ? "bg-primary text-black border-primary" : "bg-white/5 border-border/40 hover:border-primary/40"}`}>
                      {n === 1 ? "Full" : `Split ${n}`}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={onBuy} disabled={!!busy || usdc < Number(amount)} className="px-6 h-11 rounded-xl bg-primary text-black text-[11px] font-black uppercase tracking-widest hover:scale-[1.02] disabled:opacity-40 disabled:bg-white/5 disabled:text-foreground/30 flex items-center gap-2">
                {busy?.startsWith("Buy ") ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />} Buy_Now
              </button>
            </div>
            <p className="text-[10px] text-foreground/30">Locks {fmt(Number(amount) || 0)} USDC collateral; the pool fronts the merchant now. {emiN > 1 ? `Repay in ${emiN} installments` : "Repay anytime"}, then reclaim collateral on Lend/Borrow.</p>
            {usdc < Number(amount) && <p className="text-[11px] text-amber-400/80 flex items-center gap-2"><AlertTriangle size={12} /> Need ≥ {fmt(Number(amount) || 0)} USDC — mint some from the faucet first.</p>}
          </div>
        )}
      </div>

      {/* Active loans */}
      {loans.length > 0 && (
        <div className="flex flex-col gap-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Active_Loans</span>
          {loans.map((l) => {
            const lv = views[l.id];
            const out = lv ? fromUnits(lv.outstanding) : 0;
            const repaid = lv ? lv.status === 1 || out <= 0.0001 : false;
            const ri = repayInput[l.id] ?? "";
            return (
              <div key={l.id} className="bg-[#0d0f14] border border-border/30 rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <span className="text-[11px] text-primary/70 font-mono">Loan #{l.id}</span>
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="flex items-center gap-1.5 text-foreground/60"><CalendarClock size={13} className="text-primary/60" /> {lv ? `Due ledger ${lv.due_ledger}` : "—"}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${repaid ? "text-green-400 border-green-500/30 bg-green-500/10" : "text-amber-400 border-amber-500/30 bg-amber-500/10"}`}>
                      {repaid ? "Repaid" : `${lv ? fmt(out) : "…"} USDC due`}
                    </span>
                  </div>
                </div>

                {/* EMI schedule */}
                {l.n > 1 && !repaid && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-foreground/40">
                      <span>EMI · {l.paid}/{l.n} paid · {fmt(l.perAmount)} USDC each</span>
                      <span>{Math.round((l.paid / l.n) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden flex gap-0.5">
                      {Array.from({ length: l.n }).map((_, i) => (
                        <div key={i} className={`flex-1 rounded-sm ${i < l.paid ? "bg-primary" : "bg-white/10"}`} />
                      ))}
                    </div>
                  </div>
                )}

                {!repaid && (
                  <div className="flex flex-wrap items-center gap-2">
                    {l.n > 1 && l.paid < l.n && (
                      <button onClick={() => onRepay(l, l.perAmount, `Pay EMI ${l.paid + 1}/${l.n}`)} disabled={!!busy || usdc < l.perAmount}
                        className="px-4 h-9 rounded-lg bg-primary text-black text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] disabled:opacity-40 flex items-center gap-2">
                        {busy === `Pay EMI ${l.paid + 1}/${l.n}` ? <Loader2 size={12} className="animate-spin" /> : <CalendarClock size={12} />} Pay EMI {l.paid + 1}/{l.n} ({fmt(l.perAmount)})
                      </button>
                    )}
                    <button onClick={() => onRepay(l, out, "Repay in full")} disabled={!!busy || !lv || usdc < out}
                      className="px-4 h-9 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 disabled:opacity-40">
                      Repay in full
                    </button>
                    <div className="flex items-center gap-1">
                      <input type="number" value={ri} onChange={(e) => setRepayInput({ ...repayInput, [l.id]: e.target.value })} placeholder="amt"
                        className="w-20 bg-[#05080f]/60 border border-border/30 rounded-lg px-2 h-9 text-[11px] focus:border-primary/40 focus:outline-none" />
                      <button onClick={() => onRepay(l, Number(ri), `Repay ${fmt(Number(ri))} USDC`)} disabled={!!busy || !(Number(ri) > 0) || usdc < Number(ri)}
                        className="px-3 h-9 rounded-lg bg-white/5 border border-border/40 text-[10px] font-black uppercase tracking-widest hover:border-primary/40 disabled:opacity-40">
                        Repay
                      </button>
                    </div>
                  </div>
                )}
                {repaid && (
                  <div className="flex items-center gap-2 text-[11px] text-green-400 font-bold uppercase tracking-widest">
                    <CheckCircle2 size={14} /> Loan fully repaid — credit limit grew
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-foreground/30 leading-relaxed max-w-2xl">
        Over-collateralized BNPL: lock collateral, the pool fronts the merchant now, and each repayment grows your
        credit limit. Repay in EMIs or all at once, then reclaim your collateral. Credit scoring runs privately with a
        zero-knowledge proof verified on-chain.
      </p>
    </div>
  );
}
