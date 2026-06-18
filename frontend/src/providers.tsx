'use client';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet, base, arbitrum, baseSepolia, sepolia } from 'wagmi/chains';
import {
  RainbowKitProvider,
  connectorsForWallets,
  getDefaultWallets,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import { coinbaseWallet } from '@rainbow-me/rainbowkit/wallets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaxFiProvider } from './hooks/useTaxFi';
import { ToastProvider } from './components/Toast';
import '@rainbow-me/rainbowkit/styles.css';

// WalletConnect Project ID — set NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID in your .env.local
// Get one free at https://cloud.walletconnect.com
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '';

// RPC URLs — public fallbacks (replace with Alchemy/Infura keys for production)
const RPC_URLS = {
  [mainnet.id]: 'https://eth.llamarpc.com',
  [base.id]: 'https://base.llamarpc.com',
  [arbitrum.id]: 'https://arbitrum.llamarpc.com',
  [baseSepolia.id]: 'https://base-sepolia.publicnode.com',
  [sepolia.id]: 'https://rpc.sepolia.org',
};

const supportedChains = [mainnet, base, arbitrum, baseSepolia, sepolia] as const;

const transports = {
  [mainnet.id]: http(RPC_URLS[mainnet.id]),
  [base.id]: http(RPC_URLS[base.id]),
  [arbitrum.id]: http(RPC_URLS[arbitrum.id]),
  [baseSepolia.id]: http(RPC_URLS[baseSepolia.id]),
  [sepolia.id]: http(RPC_URLS[sepolia.id]),
};

function buildWagmiConfig() {
  if (walletConnectProjectId) {
    // Full setup: RainbowKit default wallets (includes MetaMask, WalletConnect, Rainbow…)
    // plus Coinbase Wallet added separately.
    // NOTE: Do NOT also add walletConnectWallet() here — getDefaultWallets already includes it.
    const { wallets } = getDefaultWallets({
      appName: 'TaxFi',
      projectId: walletConnectProjectId,
    });

    const connectors = connectorsForWallets(
      [
        ...wallets,
        // Coinbase Wallet is not part of getDefaultWallets, so we add it explicitly
        { groupName: 'More', wallets: [coinbaseWallet] },
      ],
      {
        appName: 'TaxFi',
        projectId: walletConnectProjectId,
      },
    );

    return createConfig({ chains: supportedChains, connectors, transports, ssr: true });
  }

  // Fallback: injected connector only (MetaMask / any EIP-1193 browser wallet).
  // WalletConnect requires a valid project ID so we skip it entirely here.
  if (typeof window !== 'undefined') {
    console.warn(
      '[TaxFi] NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not set. ' +
        'Only injected wallets (MetaMask, Rabby, etc.) will be available. ' +
        'Set the env var for full WalletConnect + Coinbase Wallet support.',
    );
  }

  // Use getDefaultConfig for the simplest injected-only setup
  const { wallets } = getDefaultWallets({
    appName: 'TaxFi',
    projectId: 'dummy', // Required by type but won't be used — no WC connector fires
  });

  // Only keep non-WalletConnect wallets to avoid network errors
  const injectedOnly = wallets.filter(
    (group) => group.groupName !== 'Recommended' || !walletConnectProjectId,
  );

  const connectors = connectorsForWallets(injectedOnly, {
    appName: 'TaxFi',
    projectId: 'dummy',
  });

  return createConfig({ chains: supportedChains, connectors, transports, ssr: true });
}

const wagmiConfig = buildWagmiConfig();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#10b981',
            accentColorForeground: '#ffffff',
            borderRadius: 'large',
            fontStack: 'system',
            overlayBlur: 'small',
          })}
          coolMode
        >
          <ToastProvider>
            <TaxFiProvider>
              {children}
            </TaxFiProvider>
          </ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
