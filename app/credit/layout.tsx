import type { Metadata } from "next";
import JsonLd from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Zero-Knowledge Credit Score",
  description: "A private credit score proven with a zero-knowledge proof and verified on-chain — your financial data never leaves your device.",
  alternates: {
    canonical: "/credit",
  },
};

export default function CreditLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd type="faq" />
      {children}
    </>
  );
}
