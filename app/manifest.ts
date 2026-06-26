import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IRION Finance",
    short_name: "IRION",
    description: "Private consumer credit on Stellar — BNPL, lend/borrow, and a zero-knowledge credit score.",
    start_url: "/",
    display: "standalone",
    background_color: "#05080f",
    theme_color: "#a6f24a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
