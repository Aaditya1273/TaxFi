'use client';

import { WagmiProvider, createConfig, http, injected } from 'wagmi';
import { mainnet, base, arbitrum, baseSepolia, sepolia } from 'wagmi/chains';
import { RainbowKitProvider, darkTheme, connectorsForWallets, getDefaultWallets } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaxFiProvider } from './hooks/useTaxFi';
import { ToastProvider } from './components/Toast';
import '@rainbow-me/rainbowkit/styles.css';

// WalletConnect Project ID — set NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID in your .env
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID;

const supportedChains = [mainnet, base, arbitrum, baseSepolia, sepolia] as const;

let wagmiConfig: ReturnType<typeof createConfig>;

if (walletConnectProjectId) {
  // Full RainbowKit with WalletConnect, Coinbase Wallet, and injected wallets
  const { wallets } = getDefaultWallets({
    appName: 'TaxFi',
    projectId: walletConnectProjectId,
  });

  const connectors = connectorsForWallets(wallets, {
    appName: 'TaxFi',
    projectId: walletConnectProjectId,
  });

  wagmiConfig = createConfig({
    chains: supportedChains,
    connectors,
    transports: {
      [mainnet.id]: http(),
      [base.id]: http(),
      [arbitrum.id]: http(),
      [baseSepolia.id]: http(),
      [sepolia.id]: http(),
    },
    ssr: true,
  });
} else {
  // Fallback: injected (MetaMask / browser wallet) only — no WalletConnect
  if (typeof window !== 'undefined') {
    console.info(
      '[TaxFi] NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID not set — using injected (MetaMask) connector only. ' +
      'For WalletConnect + Coinbase Wallet support, set NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID in .env.local ' +
      '(get one free at https://cloud.walletconnect.com).',
    );
  }
  wagmiConfig = createConfig({
    chains: supportedChains,
    connectors: [injected()],
    transports: {
      [mainnet.id]: http(),
      [base.id]: http(),
      [arbitrum.id]: http(),
      [baseSepolia.id]: http(),
      [sepolia.id]: http(),
    },
    ssr: true,
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider coolMode theme={darkTheme({
    accentColor: '#2F57EF',
    accentColorForeground: '#FFFFFF',
    borderRadius: 'large',
    fontStack: 'system',
    overlayBlur: 'small',
  })}>
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
