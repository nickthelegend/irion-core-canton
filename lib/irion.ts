// High-level Irion contract client (replaces the old lib/bnpl.ts Sui builders).
// Every write takes the caller address + a `sign` function from useStellarWallet().
import * as StellarSdk from "@stellar/stellar-sdk";
import { CONTRACTS, invoke, simulateRead, sv, toUnits, type SignFn } from "./stellar";
import type { SorobanProof } from "./prover";

const CORE = CONTRACTS.irionCore;
const USDC = CONTRACTS.usdc;

// Build the Proof struct (a,b,c = BN254 points as bytes) and the Vec<Fr>
// public-signals ScVals that IrionCore::apply_zk_score expects.
const { xdr, nativeToScVal } = StellarSdk;
const bnBytes = (hex: string) => xdr.ScVal.scvBytes(Buffer.from(hex, "hex"));
function proofScVal(p: SorobanProof) {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("a"), val: bnBytes(p.a) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("b"), val: bnBytes(p.b) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("c"), val: bnBytes(p.c) }),
  ]);
}
const pubSignalsScVal = (sigs: string[]) =>
  xdr.ScVal.scvVec(sigs.map((s) => nativeToScVal(BigInt(s), { type: "u256" })));

export type Profile = {
  borrower: string;
  credit_limit: bigint;
  outstanding: bigint;
  repaid_total: bigint;
  repayments: number;
  score: number;
  nonce: bigint;
};

export type Loan = {
  id: bigint;
  borrower: string;
  merchant: string;
  principal: bigint;
  principal_repaid: bigint;
  outstanding: bigint;
  collateral: bigint;
  opened_ledger: number;
  due_ledger: number;
  status: number; // 0 active, 1 repaid, 2 defaulted
};

export const irion = {
  // ---- writes (BNPL + credit + pool) ----
  openProfile: (addr: string, sign: SignFn) =>
    invoke(addr, CORE, "open_profile", [sv.addr(addr)], sign),

  applyZkScore: (addr: string, proof: SorobanProof, pubSignals: string[], sign: SignFn) =>
    invoke(addr, CORE, "apply_zk_score", [sv.addr(addr), proofScVal(proof), pubSignalsScVal(pubSignals)], sign),

  supply: (addr: string, usdc: number, sign: SignFn) =>
    invoke(addr, CORE, "supply", [sv.addr(addr), sv.i128(toUnits(usdc))], sign),

  withdraw: (addr: string, shares: bigint, sign: SignFn) =>
    invoke(addr, CORE, "withdraw", [sv.addr(addr), sv.i128(shares)], sign),

  // Unsecured borrow against the (ZK-lifted) credit line — no collateral.
  borrowUnsecured: (addr: string, usdc: number, termLedgers: number, sign: SignFn) =>
    invoke(addr, CORE, "borrow_unsecured", [sv.addr(addr), sv.i128(toUnits(usdc)), sv.u32(termLedgers)], sign),

  openPurchase: (
    addr: string,
    merchant: string,
    amountUsdc: number,
    collateralUsdc: number,
    termLedgers: number,
    sign: SignFn
  ) =>
    invoke(
      addr,
      CORE,
      "open_purchase",
      [
        sv.addr(addr),
        sv.addr(merchant),
        sv.i128(toUnits(amountUsdc)),
        sv.i128(toUnits(collateralUsdc)),
        sv.u32(termLedgers),
      ],
      sign
    ),

  repay: (addr: string, loanId: bigint | number, amountUsdc: number, sign: SignFn) =>
    invoke(addr, CORE, "repay", [sv.u64(loanId), sv.addr(addr), sv.i128(toUnits(amountUsdc))], sign),

  releaseCollateral: (addr: string, loanId: bigint | number, sign: SignFn) =>
    invoke(addr, CORE, "release_collateral", [sv.u64(loanId)], sign),

  merchantWithdraw: (addr: string, sign: SignFn) =>
    invoke(addr, CORE, "merchant_withdraw", [sv.addr(addr)], sign),

  // ---- test USDC (admin-mint faucet) ----
  usdcMint: (admin: string, to: string, usdc: number, sign: SignFn) =>
    invoke(admin, USDC, "mint", [sv.addr(to), sv.i128(toUnits(usdc))], sign),

  // Transfer USDC directly from the caller to `to` (SEP-41 token transfer).
  usdcTransfer: (from: string, to: string, usdc: number, sign: SignFn) =>
    invoke(from, USDC, "transfer", [sv.addr(from), sv.addr(to), sv.i128(toUnits(usdc))], sign),

  // ---- reads ----
  getProfile: (addr: string) => simulateRead(CORE, "get_profile", [sv.addr(addr)]) as Promise<Profile>,
  getLoan: (loanId: bigint | number) => simulateRead(CORE, "get_loan", [sv.u64(loanId)]) as Promise<Loan>,
  totalAssets: () => simulateRead(CORE, "total_assets") as Promise<bigint>,
  availableLiquidity: () => simulateRead(CORE, "available_liquidity") as Promise<bigint>,
  sharesOf: (addr: string) => simulateRead(CORE, "shares_of", [sv.addr(addr)]) as Promise<bigint>,
  escrowOf: (addr: string) => simulateRead(CORE, "escrow_of", [sv.addr(addr)]) as Promise<bigint>,
  usdcBalance: (addr: string) => simulateRead(USDC, "balance", [sv.addr(addr)]) as Promise<bigint>,
};
