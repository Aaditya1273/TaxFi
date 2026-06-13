'use client';

import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import ScrollReveal from './ScrollReveal';

export default function CTA() {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const handleCta = () => {
    if (isConnected) {
      window.location.href = '/dashboard';
    } else if (openConnectModal) {
      openConnectModal();
    }
  };

  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-50/50 to-emerald-100/50" />
      <div className="max-w-4xl mx-auto px-6 text-center relative">
        <ScrollReveal>
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/70 backdrop-blur-3xl border border-emerald-200/60 text-emerald-600 text-sm font-medium mb-8 shadow-2xl shadow-emerald-500/10">
            Start Saving Today
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Your Tax Agent Is{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500">
              One Click Away
            </span>
          </h2>
          <p className="text-gray-700 text-lg max-w-2xl mx-auto mb-12">
            Connect your wallet. Grant read-only permission. Let the agents find
            savings you didn&apos;t know existed. Free if you don&apos;t save anything.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleCta}
              className="px-12 py-5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-full hover:shadow-2xl hover:shadow-emerald-500/40 transition-all active:scale-[0.97] text-lg backdrop-blur-sm hover:scale-105"
            >
              {isConnected ? 'Open Dashboard \u2192' : 'Connect Wallet \u2014 It\u2019s Free'}
            </button>
            <a
              href="#how-it-works"
              className="px-12 py-5 bg-white/70 backdrop-blur-3xl border border-gray-200/60 text-gray-700 font-semibold rounded-full hover:bg-white/90 hover:border-gray-300/60 transition-all text-lg shadow-xl hover:scale-105"
            >
              Learn More
            </a>
          </div>
          <p className="text-sm text-gray-600 mt-6">
            No ETH required. No subscription. 5% of what we save you.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
