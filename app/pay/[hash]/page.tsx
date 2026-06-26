"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import dynamic from "next/dynamic"
import { Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"
import type { CantonBill } from "./CantonCheckout"
import type { CheckoutMode } from "@/lib/canton-pay"

// The checkout drives the Canton wallet SDK (Carpincho) — strictly client-side.
const CantonCheckout = dynamic(() => import("./CantonCheckout"), {
  ssr: false,
  loading: () => (
    <Centered>
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
      <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Loading checkout…</p>
    </Centered>
  ),
})

export default function PayPage() {
  const params = useParams()
  const hash = params?.hash as string | undefined
  const [bill, setBill] = useState<CantonBill | null>(null)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!hash) { setFetching(false); return }
    let active = true
    const sp = (k: string) => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get(k) : null)

    // DB-free fallback: a payment link can carry the bill in the query string
    // (?amount=&merchant=&desc=), exactly as the shopping app / merchant build it.
    const qMethods = (): CheckoutMode[] | undefined => {
      const m = sp("methods")
      if (!m) return undefined
      const list = m.split(",").map((x) => x.trim())
      const valid = list.filter((x): x is CheckoutMode => x === "direct" || x === "bnpl" || x === "credit")
      return valid.length ? valid : undefined
    }
    const fromQuery = (): CantonBill | null => {
      const amt = sp("amount")
      if (!amt) return null
      return {
        amount: Number(amt),
        merchant: sp("merchant") || "Merchant",
        description: sp("desc") || "Purchase via Irion on Canton",
        hash,
        party: sp("party") || undefined,
        methods: qMethods(),
      }
    }
    const toBill = (d: any): CantonBill | null => {
      if (!d || d.error) return fromQuery()
      return {
        amount: Number(d.amount) || 0,
        merchant: d.merchant?.name || sp("merchant") || "Merchant",
        description: d.description,
        hash,
        party: sp("party") || undefined,
        methods: qMethods(),
      }
    }

    fetch(`/api/bills/${hash}`).then((r) => r.json())
      .then((d) => { if (active) setBill(toBill(d)) })
      .catch(() => { if (active) setBill(fromQuery()) })
      .finally(() => { if (active) setFetching(false) })
    return () => { active = false }
  }, [hash])

  if (fetching) {
    return (
      <Centered>
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Loading bill…</p>
      </Centered>
    )
  }
  if (!bill || !bill.amount) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center text-white">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-black uppercase tracking-tighter">Bill Not Found</h1>
          <p className="text-[10px] text-white/40 uppercase">This payment link may be expired or invalid.</p>
        </div>
        <Link href="/" className="bg-white/5 px-6 py-2 rounded border border-white/10 text-[10px] font-bold uppercase hover:bg-white/10 transition-all">Return to Irion</Link>
      </div>
    )
  }
  return <CantonCheckout bill={bill} />
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">{children}</div>
}
