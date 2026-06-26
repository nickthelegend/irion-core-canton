// Mongo query helpers extracted out of the route handlers. Next.js route modules
// may only export the known HTTP-method handlers (GET/POST/...), so any shared
// helper must live outside `app/api/**/route.ts` or `tsc` rejects the module.
import type { Db } from "mongodb";

export async function getPoolsFromDb(db: Db) {
  return db.collection("pools").find({}).toArray();
}

export async function getPoolBySymbol(db: Db, symbol: string) {
  return db.collection("pools").findOne({ symbol: symbol.toUpperCase() });
}

export async function getPositionsFromDb(db: Db, wallet: string) {
  return db
    .collection("positions")
    .find({ walletAddress: wallet.toLowerCase(), status: "active" })
    .toArray();
}

export async function upsertPosition(
  db: Db,
  payload: {
    walletAddress: string;
    type: "SUPPLY" | "BORROW";
    symbol: string;
    entryAmount: number;
    txHash: string;
  }
) {
  const now = new Date();
  const status = payload.entryAmount === 0 ? "closed" : "active";

  return db.collection("positions").updateOne(
    { txHash: payload.txHash },
    {
      $set: {
        walletAddress: payload.walletAddress.toLowerCase(),
        type: payload.type,
        symbol: payload.symbol,
        entryAmount: payload.entryAmount,
        status,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );
}
