"use client";
// Browser-side credit-proof generation (snarkjs Groth16 / BN254).
//
// The borrower's financials are turned into a zero-knowledge proof ENTIRELY in
// the browser — they never leave the device and never touch the chain. They are
// first attested by the trusted ISSUER (a bank / bureau): the borrower fetches an
// EdDSA-Poseidon signature over their financials from /api/issuer/sign, and the
// circuit verifies that signature in-zk. So the inputs are genuine, not
// self-asserted. Only the proof + public signals
// [approvedLimit, borrowerHi, borrowerLo, nonce, issuerAx, issuerAy] are sent
// on-chain to IrionCore::apply_zk_score, where the BN254 verifier checks them and
// the contract pins issuerAx/Ay to the trusted issuer.
import * as snarkjs from "snarkjs";
import { StrKey } from "@stellar/stellar-sdk";

const WASM_URL = "/circuits/credit.wasm";
const ZKEY_URL = "/circuits/credit.zkey";

export type CreditInputs = {
  monthlyIncome: number; // USDC
  monthlyDebt: number; // USDC
  onTimePayments: number;
  missedPayments: number;
  utilizationBps: number; // 0..10000
  creditAgeMonths: number;
};

export type SorobanProof = { a: string; b: string; c: string };

/** Split a Stellar G-address into the two 128-bit halves the circuit binds to. */
export function addressHiLo(address: string): { hi: string; lo: string } {
  const key = StrKey.decodeEd25519PublicKey(address); // 32 bytes
  const hex = Array.from(key, (b) => b.toString(16).padStart(2, "0")).join("");
  const hi = BigInt("0x" + hex.slice(0, 32)).toString();
  const lo = BigInt("0x" + hex.slice(32, 64)).toString();
  return { hi, lo };
}

// snarkjs proof point -> Soroban BN254 hex encoding (matches export-vk.mjs).
const FP = 32;
const fp = (dec: string) => {
  const h = BigInt(dec).toString(16);
  if (h.length > FP * 2) throw new Error("Fp overflows 32 bytes");
  return h.padStart(FP * 2, "0");
};
const g1 = (p: string[]) => fp(p[0]) + fp(p[1]);
const g2 = (p: string[][]) => fp(p[0][1]) + fp(p[0][0]) + fp(p[1][1]) + fp(p[1][0]);

/** Attestation returned by the issuer: the exact signed financial field values
 * plus the EdDSA signature and the issuer's public key. */
type Attestation = {
  income: string; debt: string; onTime: string; missed: string;
  utilBps: string; ageMonths: string;
  borrowerHi: string; borrowerLo: string;
  issuerAx: string; issuerAy: string;
  sigR8x: string; sigR8y: string; sigS: string;
};

/**
 * Generate a credit proof in the browser. First obtains the issuer's signature
 * over the borrower's financials (so they can't be faked), then proves it in ZK.
 * `nonce` must be strictly greater than the borrower's current on-chain profile
 * nonce (replay protection).
 */
export async function generateCreditProof(
  inputs: CreditInputs,
  borrower: string,
  nonce: number
): Promise<{ proof: SorobanProof; pubSignals: string[]; approvedLimit: number }> {
  // 1. Issuer attests the financials (the bank signs them after KYC/open-banking).
  const res = await fetch("/api/issuer/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: borrower, ...inputs }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `issuer signing failed (${res.status})`);
  }
  const att = (await res.json()) as Attestation;

  // 2. Prove: the circuit re-checks the issuer signature and the score, all in
  //    zero knowledge. The financials (att.income, …) are private witness inputs.
  const input = {
    income: att.income, debt: att.debt, onTime: att.onTime, missed: att.missed,
    utilBps: att.utilBps, ageMonths: att.ageMonths,
    sigR8x: att.sigR8x, sigR8y: att.sigR8y, sigS: att.sigS,
    borrowerHi: att.borrowerHi, borrowerLo: att.borrowerLo, nonce: String(nonce),
    issuerAx: att.issuerAx, issuerAy: att.issuerAy,
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM_URL, ZKEY_URL);

  return {
    proof: { a: g1(proof.pi_a), b: g2(proof.pi_b), c: g1(proof.pi_c) },
    // [approvedLimit, borrowerHi, borrowerLo, nonce, issuerAx, issuerAy]
    pubSignals: publicSignals as string[],
    approvedLimit: Number(BigInt(publicSignals[0])) / 1e7,
  };
}
