import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Space_Grotesk, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { AppHeader } from "@/components/header"
import { AppFooter } from "@/components/footer"
import { Providers } from "@/components/providers"
import { Suspense } from "react"
import { ErrorBoundary } from "@/components/error-boundary"
import JsonLd from "@/components/seo/json-ld"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
})

const SITE = "https://app.irion.finance"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#a6f24a",
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "IRION Finance — Buy Now, Pay Never · Private Credit on Canton",
    template: "%s | IRION Finance",
  },
  description:
    "IRION Finance is private consumer credit on Canton: Buy Now Pay Never (BNPL), lend/borrow USDC, and borrow against a private credit line. Built on Daml — your balances and credit are visible only to you and the operator, never the network.",
  applicationName: "IRION Finance",
  keywords: [
    "IRION", "IRION Finance", "Buy Now Pay Never", "BNPL", "on-chain BNPL",
    "Canton", "Canton Network", "Daml", "Canton lending", "Canton borrowing", "private credit",
    "confidential DeFi", "decentralized credit", "under-collateralized loans",
    "yield-backed loans", "USDC", "pay later crypto",
  ],
  authors: [{ name: "IRION Finance", url: SITE }],
  creator: "IRION Finance",
  publisher: "IRION Finance",
  category: "finance",
  alternates: { canonical: "/" },
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  openGraph: {
    type: "website",
    siteName: "IRION Finance",
    url: SITE,
    title: "IRION Finance — Buy Now, Pay Never · Private Credit on Canton",
    description:
      "BNPL, lend/borrow, and a private credit line on Canton. Checkout with credit, repay from yield.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "IRION Finance — Buy Now, Pay Never",
    description: "Private consumer credit on Canton: BNPL, lend/borrow, and a private credit line.",
    site: "@IrionFinance",
    creator: "@IrionFinance",
  },
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/logo.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png" }],
  },
  manifest: "/manifest.webmanifest",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark h-full">
      <body className={`font-mono ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${GeistSans.variable} ${GeistMono.variable} antialiased min-h-dvh bg-background`}>
        <JsonLd type="organization" />
        <Suspense fallback={<div>Loading...</div>}>
          <Providers>
            <ErrorBoundary>
              <div className="mx-auto w-full flex flex-col min-h-screen px-4 md:px-8 lg:px-12">
                <AppHeader />
                <main className="pb-24 flex-grow">{children}</main>
                <AppFooter />
              </div>
            </ErrorBoundary>
          </Providers>
        </Suspense>
        <Analytics />
      </body>
    </html>
  )
}
