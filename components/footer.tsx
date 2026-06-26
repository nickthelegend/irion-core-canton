"use client"

import { Shield } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function AppFooter() {
    const pathname = usePathname()

    // /pay (checkout) + /app (wallet) are Canton surfaces with their own chrome.
    if (pathname?.startsWith("/pay") || pathname?.startsWith("/app")) return null

    return (
        <footer className="w-full flex flex-col md:flex-row justify-between items-center py-6 px-6 md:px-12 border-t border-white/5 gap-6 opacity-40 font-mono">
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]">
                    <span className="w-1 h-1 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(166,242,74,0.8)]"></span>
                    IRION_PROTOCOL: ACTIVE
                </div>
                <div className="text-[10px] flex items-center gap-1 font-bold uppercase tracking-[0.2em]">
                    <Shield className="w-3 h-3" />
                    CANTON_PRIVATE
                </div>
            </div>
            <div className="flex gap-6">
                <Link href="/support" className="hover:text-primary transition-colors text-[10px] font-bold uppercase tracking-widest">Support</Link>
                <Link href="/terms" className="hover:text-primary transition-colors text-[10px] font-bold uppercase tracking-widest">Terms</Link>
                <Link href="/privacy" className="hover:text-primary transition-colors text-[10px] font-bold uppercase tracking-widest">Privacy</Link>
            </div>
        </footer>
    )
}
