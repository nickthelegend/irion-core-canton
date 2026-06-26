import Link from "next/link"
import {
  CreditCard, TrendingUp, Lock, ArrowUpRight, Wallet, ShieldCheck,
} from "lucide-react"

// Static Canton landing. The live wallet (balances, lend/borrow/repay, private
// credit) lives at /app, which mounts its own Carpincho ConnectKit client-side.
export default function Page() {
  return (
    <div className="font-mono relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/4 h-80 w-80 rounded-full bg-primary/20 blur-[130px]" />
        <div className="absolute top-32 right-0 h-72 w-72 rounded-full bg-purple-500/15 blur-[130px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(166,242,74,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(166,242,74,0.045)_1px,transparent_1px)] bg-[size:46px_46px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]" />
      </div>

      <div className="relative grid lg:grid-cols-2 gap-12 lg:gap-16 items-center min-h-[72dvh] py-10">
        {/* Pitch + connect CTA */}
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-[10px] text-primary font-bold tracking-widest uppercase backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> IRION // Canton · Live
          </div>

          <div className="space-y-5">
            <h1 className="text-6xl md:text-8xl font-black tracking-[-0.04em] uppercase leading-[0.88] text-foreground">
              Buy Now,<br />
              <span className="bg-gradient-to-r from-primary via-primary to-emerald-300 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(166,242,74,0.35)]">Pay Never.</span>
            </h1>
            <p className="text-sm md:text-base text-foreground/50 leading-relaxed max-w-md">
              Private consumer credit on{" "}
              <span className="text-primary font-bold">Canton</span>. Check out with credit and
              repay from yield, lend &amp; borrow USDC, or borrow against a credit line that lives in a
              private Daml contract — visible only to you and the operator, never the network.
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href="/app"
              className="inline-flex h-14 items-center gap-3 rounded-2xl bg-primary px-8 text-sm font-black uppercase tracking-widest text-black shadow-[0_0_40px_-4px_rgba(166,242,74,0.55)] transition-transform hover:scale-[1.03]"
            >
              <Wallet size={16} /> Open Wallet
            </Link>
            <p className="flex items-center gap-2 text-[10px] text-foreground/35 uppercase tracking-[0.15em]">
              <Wallet size={12} className="text-primary/50" /> No email · no credit check · just your Carpincho wallet
            </p>
          </div>

          {/* Public, wallet-less highlights */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border/30 max-w-md">
            <div>
              <div className="text-[9px] text-foreground/30 uppercase tracking-widest mb-1">Settlement</div>
              <div className="text-lg font-black text-foreground">Atomic <span className="text-[10px] text-foreground/40">Daml</span></div>
            </div>
            <div>
              <div className="text-[9px] text-foreground/30 uppercase tracking-widest mb-1">Privacy</div>
              <div className="text-lg font-black text-primary">Per-party</div>
            </div>
            <div>
              <div className="text-[9px] text-foreground/30 uppercase tracking-widest mb-1">Network</div>
              <div className="text-lg font-black text-foreground uppercase">Canton</div>
            </div>
          </div>
        </div>

        {/* Feature pillars */}
        <div className="space-y-4">
          {[
            { icon: CreditCard, title: "Buy Now, Pay Never", tag: "BNPL", desc: "Check out with on-chain credit. Collateral earns yield that auto-repays your loan." },
            { icon: TrendingUp, title: "Lend & Borrow", tag: "Markets", desc: "Supply USDC to the pool to earn borrower interest, or borrow against your credit line." },
            { icon: Lock, title: "Private Credit", tag: "Private", desc: "Your credit profile is a private Daml contract — visible only to you and the operator. No ZK required; privacy is built into Canton." },
          ].map((f) => (
            <Link key={f.title} href="/app" className="group relative flex items-start gap-4 bg-[#0d0f14]/70 border border-border/40 rounded-2xl p-5 hover:border-primary/40 hover:bg-[#0d0f14] transition-all backdrop-blur-sm overflow-hidden">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary flex-shrink-0 group-hover:scale-105 transition-transform"><f.icon size={20} /></div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">{f.title}</h3>
                  <span className="text-[8px] text-primary/70 uppercase tracking-widest border border-primary/20 rounded px-1.5 py-0.5">{f.tag}</span>
                </div>
                <p className="text-[11px] text-foreground/45 leading-relaxed">{f.desc}</p>
              </div>
              <ArrowUpRight size={14} className="text-foreground/20 group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
            </Link>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/20 my-16" />

      {/* How It Works */}
      <div className="space-y-12 pb-16">
        <div className="text-center space-y-2">
          <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">IRION // WORKFLOW</span>
          <h2 className="text-3xl md:text-4xl tracking-tighter font-black uppercase">How It Works</h2>
          <p className="text-xs text-foreground/40 max-w-md mx-auto">Three steps to unlock private, decentralized consumer credit on Canton.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { step: "01", title: "Connect Carpincho", desc: "Link your self-custody Carpincho wallet to initialize your private Canton party. No email or personal identity required." },
            { step: "02", title: "Get a Private Credit Line", desc: "The operator issues a credit attestation as a Daml contract that only you and the operator can see. Your financial data never becomes public." },
            { step: "03", title: "Buy Now, Pay Never", desc: "Check out with credit. Collateral is supplied into the lending pool to earn yield, which auto-repays your BNPL credit line." },
          ].map((s) => (
            <div key={s.step} className="bg-[#0d0f14]/60 border border-border/30 rounded-2xl p-6 relative overflow-hidden group hover:border-primary/20 transition-all">
              <span className="absolute top-2 right-4 text-7xl font-black text-primary/5 font-mono select-none">{s.step}</span>
              <div className="space-y-3 relative z-10">
                <span className="text-[10px] font-bold text-primary tracking-widest uppercase font-mono">{s.step} // STEP</span>
                <h3 className="text-base font-bold text-white uppercase">{s.title}</h3>
                <p className="text-xs text-foreground/50 leading-relaxed font-mono">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="space-y-12 pb-24 border-t border-border/20 pt-16">
        <div className="text-center space-y-2">
          <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">IRION // FAQ</span>
          <h2 className="text-3xl md:text-4xl tracking-tighter font-black uppercase">Frequently Asked Questions</h2>
          <p className="text-xs text-foreground/40 max-w-md mx-auto">Common questions about the Irion protocol on Canton.</p>
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          {[
            {
              q: "What is Buy Now, Pay Never?",
              a: "Buy Now, Pay Never (BNPL) lets you purchase on credit by locking USDC collateral. The collateral is supplied to the Irion lending pool to generate yield, and the earned yield pays off the outstanding credit over time.",
            },
            {
              q: "How is my credit kept private on Canton?",
              a: "Privacy is built into Canton. A Daml contract is only visible to its signatory and observer parties — so your credit profile and loans are seen only by you and the operator, never by the wider network. The synchronizer that orders transactions sees only encrypted commitments, not your data. This replaces zero-knowledge proofs with privacy-by-construction.",
            },
            {
              q: "Is my financial data private?",
              a: "Yes. Your balances, credit line, and loans live in Daml contracts whose only informees are you and the operator. No other participant — not even other Irion users — can inspect them.",
            },
            {
              q: "What is Irion built on?",
              a: "Irion is built on the Canton Network using Daml smart contracts, leveraging sub-transaction privacy and atomic, multi-party settlement to handle collateral, lending pools, and BNPL checkouts.",
            },
          ].map((faq, index) => (
            <div key={index} className="bg-[#05080f]/50 border border-border/20 rounded-2xl p-6 hover:border-primary/10 transition-all">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-2 font-mono">
                <span className="text-primary text-xs font-black">&gt;</span> {faq.q}
              </h4>
              <p className="text-xs text-foreground/50 leading-relaxed pl-4 border-l border-primary/20 font-mono">
                {faq.a}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-6 py-3 text-[11px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all"
          >
            <ShieldCheck size={14} /> Open your private wallet
          </Link>
        </div>
      </div>
    </div>
  )
}
