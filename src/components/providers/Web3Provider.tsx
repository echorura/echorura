'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { coinbaseWallet, injected } from 'wagmi/connectors';
import { botChain } from '@/contracts/config';

export const wagmiConfig = createConfig({
  chains: [baseSepolia, botChain],
  connectors: [
    coinbaseWallet({
      appName: 'ECHORURA',
      preference: { options: 'smartWalletOnly' },
    }),
    injected(),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [botChain.id]: http(),
  },
  ssr: true,
});

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
