"use client"

// Stellar wallet shim. The live wallet provider is StellarWalletProvider
// (lib/stellar-wallet.tsx), mounted in components/providers.tsx. This module
// re-exports it under the legacy WalletProvider / useWallet names and maps the
// Stellar wallet shape onto the old { isConnected } contract so any remaining
// consumers keep working.
import { StellarWalletProvider, useStellarWallet } from "@/lib/stellar-wallet"

export { StellarWalletProvider as WalletProvider }

export function useWallet() {
  const { address, connected, connecting, connect, disconnect } = useStellarWallet()
  return {
    address: address ?? null,
    isConnected: connected,
    connecting,
    connect,
    disconnect: async () => disconnect(),
  }
}
