import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hash: string }>;
}): Promise<Metadata> {
  const { hash } = await params;
  const shortHash = hash ? `${hash.slice(0, 8)}...` : "";
  return {
    title: `Payment Invoice ${shortHash}`,
    description: `Pay this invoice securely using IRION Finance on Canton.`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
