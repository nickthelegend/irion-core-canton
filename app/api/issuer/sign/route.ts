import { NextRequest, NextResponse } from "next/server";
import { buildEddsa, buildPoseidon } from "circomlibjs";
import { StrKey } from "@stellar/stellar-sdk";

// The trusted credit ISSUER (bank / bureau). In production this runs inside the
// issuer's own infrastructure after it has verified the borrower's real
// financials (KYC / open-banking); here it simulates that party. It signs
// Poseidon(financials, borrower) with the issuer EdDSA key whose PUBLIC key is
// pinned on-chain (set_trusted_issuer), so the borrower can later prove in ZK
// that their financials are genuine without revealing them. The private key
// never leaves the server.
export const runtime = "nodejs";

// 7-dp USDC scaling, identical to the circuit / prover.
const u = (x: number) => String(Math.round(Number(x) * 1e7));

function hiLo(address: string) {
  const key = StrKey.decodeEd25519PublicKey(address); // 32 bytes
  const hex = Array.from(key, (b) => b.toString(16).padStart(2, "0")).join("");
  return {
    hi: BigInt("0x" + hex.slice(0, 32)).toString(),
    lo: BigInt("0x" + hex.slice(32, 64)).toString(),
  };
}

export async function POST(req: NextRequest) {
  const prvHex = process.env.ISSUER_PRIV;
  if (!prvHex) {
    return NextResponse.json(
      { error: "issuer signing key not configured (set ISSUER_PRIV)" },
      { status: 501 }
    );
  }
  try {
    const b = await req.json();
    if (!b?.address || typeof b.address !== "string") {
      return NextResponse.json({ error: "address required" }, { status: 400 });
    }
    // The exact field values the circuit will see (so the signature matches).
    const fin = {
      income: u(b.monthlyIncome),
      debt: u(b.monthlyDebt),
      onTime: String(Math.round(Number(b.onTimePayments))),
      missed: String(Math.round(Number(b.missedPayments))),
      utilBps: String(Math.round(Number(b.utilizationBps))),
      ageMonths: String(Math.round(Number(b.creditAgeMonths))),
    };
    const { hi, lo } = hiLo(b.address);

    const eddsa = await buildEddsa();
    const poseidon = await buildPoseidon();
    const F = poseidon.F;
    const prv = Buffer.from(prvHex, "hex");

    const preimage = [
      fin.income, fin.debt, fin.onTime, fin.missed, fin.utilBps, fin.ageMonths, hi, lo,
    ].map((x) => BigInt(x));
    const M = F.toObject(poseidon(preimage));
    const sig = eddsa.signPoseidon(prv, F.e(M));
    const pub = eddsa.prv2pub(prv);

    return NextResponse.json({
      ...fin,
      borrowerHi: hi,
      borrowerLo: lo,
      issuerAx: F.toObject(pub[0]).toString(),
      issuerAy: F.toObject(pub[1]).toString(),
      sigR8x: F.toObject(sig.R8[0]).toString(),
      sigR8y: F.toObject(sig.R8[1]).toString(),
      sigS: sig.S.toString(),
    });
  } catch (err) {
    console.error("[POST /api/issuer/sign] error:", err);
    return NextResponse.json({ error: "issuer signing failed" }, { status: 500 });
  }
}
