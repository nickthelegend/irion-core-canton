import { redirect } from "next/navigation"

// /pools is now split into /lend (supply + Blend yield) and /borrow.
export default function PoolsPage() {
  redirect("/lend")
}
