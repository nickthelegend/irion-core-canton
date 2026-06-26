import { NextResponse } from "next/server";
import * as StellarSdk from "@stellar/stellar-sdk";

// Server-side USDC faucet: mints test USDC by invoking `mint` on the USDC SAC as
// the contract admin. The admin secret is read from FAUCET_SECRET so the browser
// never holds a signing key. If FAUCET_SECRET is absent we return a 501 with
// setup instructions instead of failing opaquely.
const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
  ? (process.env.NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL || "https://soroban.stellar.org")
  : "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
  ? StellarSdk.Networks.PUBLIC
  : StellarSdk.Networks.TESTNET;

const USDC_ID =
  process.env.NEXT_PUBLIC_USDC_ID ||
  "CA76PS5S6NRZRKPFU7GIOXPBMLI6WCXCMBH5XLCN423IIPGZS7TKCDNO";

const USDC_DECIMALS = 7;
const FAUCET_MAX_USDC = 10_000;
const toUnits = (usdc: number) => BigInt(Math.round(usdc * 10 ** USDC_DECIMALS));

export async function POST(req: Request) {
  const secret = process.env.FAUCET_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        error: "Faucet not configured",
        instructions:
          "Set FAUCET_SECRET in .env.local to the Stellar secret key (S...) of the USDC contract admin. " +
          "That account must be the SAC admin authorized to call mint(). Restart the server after setting it.",
      },
      { status: 501 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { to, amount } = body as { to?: string; amount?: number };

  if (!to || typeof to !== "string" || !StellarSdk.StrKey.isValidEd25519PublicKey(to)) {
    return NextResponse.json({ error: "Valid recipient address (G...) required" }, { status: 400 });
  }
  const amt = Number(amount);
  if (!(amt > 0)) {
    return NextResponse.json({ error: "amount must be greater than 0" }, { status: 400 });
  }
  if (amt > FAUCET_MAX_USDC) {
    return NextResponse.json({ error: `Max ${FAUCET_MAX_USDC} USDC per request` }, { status: 400 });
  }

  let admin: StellarSdk.Keypair;
  try {
    admin = StellarSdk.Keypair.fromSecret(secret);
  } catch {
    return NextResponse.json(
      { error: "FAUCET_SECRET is not a valid Stellar secret key (expected S...)" },
      { status: 500 }
    );
  }

  try {
    const rpc = new StellarSdk.rpc.Server(RPC_URL);
    const account = await rpc.getAccount(admin.publicKey());
    const contract = new StellarSdk.Contract(USDC_ID);

    let tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "mint",
          StellarSdk.Address.fromString(to).toScVal(),
          StellarSdk.nativeToScVal(toUnits(amt), { type: "i128" })
        )
      )
      .setTimeout(60)
      .build();

    const sim = await rpc.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      return NextResponse.json({ error: `Simulation failed: ${sim.error}` }, { status: 502 });
    }
    tx = StellarSdk.rpc.assembleTransaction(tx, sim).build();
    tx.sign(admin);

    const sent = await rpc.sendTransaction(tx);
    if (sent.status === "ERROR") {
      return NextResponse.json(
        { error: `Send failed: ${JSON.stringify(sent.errorResult)}` },
        { status: 502 }
      );
    }

    let got = await rpc.getTransaction(sent.hash);
    for (let i = 0; got.status === "NOT_FOUND" && i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      got = await rpc.getTransaction(sent.hash);
    }
    if (got.status !== "SUCCESS") {
      return NextResponse.json({ error: `Transaction ${sent.hash} failed: ${got.status}` }, { status: 502 });
    }

    return NextResponse.json({ success: true, hash: sent.hash, to, amount: amt });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Faucet mint failed" },
      { status: 500 }
    );
  }
}
