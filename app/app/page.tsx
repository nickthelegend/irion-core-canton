"use client"

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

// The wallet dashboard drives the Canton wallet SDK (Carpincho) — strictly client-side.
const ConsumerApp = dynamic(() => import("./ConsumerApp"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
      <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Loading wallet…</p>
    </div>
  ),
})

export default function AppPage() {
  return <ConsumerApp />
}
