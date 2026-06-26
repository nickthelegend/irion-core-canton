"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/app", label: "Wallet" },
  { href: "/docs", label: "Docs" },
]

export function AppHeader() {
  const pathname = usePathname()

  // /pay (checkout) + /app (wallet) are Canton — they have their own Carpincho connect.
  if (pathname?.startsWith("/pay") || pathname?.startsWith("/app")) return null

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

        {/* Center: nav */}
        <nav className="hidden sm:flex items-center justify-center gap-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-xl px-3 py-1 text-sm transition-colors",
                pathname === n.href
                  ? "bg-primary text-black"
                  : "text-foreground/80 hover:text-foreground hover:bg-primary/15",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {/* Right: open the Canton wallet */}
        <div className="flex items-center justify-end gap-3 min-w-0">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black uppercase tracking-widest text-black transition-transform hover:scale-[1.03]"
          >
            <Wallet size={15} /> Open Wallet
          </Link>
        </div>
      </div>
    </header>
  )
}
