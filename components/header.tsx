"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

// The wallet is split into separate routes (like xorr-core). They share one
// Carpincho connection via the (wallet) route-group layout, so switching between
// them never drops the wallet.
const NAV = [
  { href: "/borrow", label: "Borrow" },
  { href: "/lend", label: "Lend" },
  { href: "/credit", label: "Credit" },
  { href: "/positions", label: "Positions" },
  { href: "/activity", label: "Activity" },
  { href: "/faucet", label: "Faucet" },
]

export function AppHeader() {
  const pathname = usePathname()

  // Only the /pay checkout is chrome-free.
  if (pathname?.startsWith("/pay")) return null

  return (
    <header className="sticky top-0 z-40 w-full pt-3 pb-2 ">
      <div
        className="grid grid-cols-[auto_1fr_auto] items-center rounded-none sm:rounded-2xl bg-[#05080f]/75 border-x-0 sm:border-x border-y border-primary/20 backdrop-blur-2xl px-4 py-3 min-h-[60px] shadow-[inset_0_0_20px_rgba(166,242,74,0.05)]"
        role="navigation"
        aria-label="Main"
      >
        {/* Left: logo */}
        <div className="flex items-center gap-2">
          <Link href="/" className="font-semibold tracking-wide">
            <span className="inline-flex items-center gap-2">
              <Image src="/logo.png" alt="Irion" width={32} height={32} className="h-8 w-8" priority />
              <span className="text-lg font-black tracking-tight text-white">Irion</span>
            </span>
          </Link>
        </div>

        {/* Center: wallet routes (Borrow · Credit · Positions · Activity · Faucet) */}
        <nav className="hidden md:flex items-center justify-center gap-1">
          {NAV.map((n) => {
            const active = pathname === n.href
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-sm font-bold transition-colors",
                  active ? "bg-primary text-black" : "text-foreground/75 hover:text-foreground hover:bg-primary/15",
                )}
              >
                {n.label}
              </Link>
            )
          })}
        </nav>

        {/* Right: Docs + open the Canton wallet */}
        <div className="flex items-center justify-end gap-3 min-w-0">
          <Link href="/docs" className="hidden lg:inline text-sm text-foreground/55 hover:text-foreground transition-colors">Docs</Link>
          <Link
            href="/borrow"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black uppercase tracking-widest text-black transition-transform hover:scale-[1.03]"
          >
            <Wallet size={15} /> Open Wallet
          </Link>
        </div>
      </div>
    </header>
  )
}
