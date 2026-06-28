import { redirect } from "next/navigation"

// The wallet is now split into separate routes (/borrow, /credit, /positions,
// /activity, /faucet) under the (wallet) group. Keep /app working by redirecting
// to the default wallet page.
export default function AppPage() {
  redirect("/borrow")
}
