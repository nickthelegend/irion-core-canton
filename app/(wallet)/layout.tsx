"use client"

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

// The wallet provider imports the Carpincho connect-kit (browser-only), so load it
// client-side only. This layout stays mounted across /borrow, /credit, /positions,
// /activity, /faucet — so the wallet connection persists when switching pages.
const WalletProvider = dynamic(() => import("./wallet-provider").then((m) => m.WalletProvider), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
      <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Loading wallet…</p>
    </div>
  ),
})

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>
}
