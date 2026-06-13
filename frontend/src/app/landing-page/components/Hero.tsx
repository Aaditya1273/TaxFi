'use client';

import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import ScrollReveal from './ScrollReveal';

export default function Hero() {
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
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-teal-50" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.08),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(20,184,166,0.08),transparent_50%)]" />

      {/* Floating glass orbs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-400/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-teal-400/10 rounded-full blur-3xl animate-pulse delay-1000" />

      {/* Gradient Fade at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-white to-transparent z-10" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-24">
        <div className="max-w-4xl mx-auto text-center">
          {/* Eyebrow */}
          <ScrollReveal delay={0}>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/70 backdrop-blur-3xl border border-emerald-200/60 text-emerald-600 text-sm font-medium mb-8 shadow-2xl shadow-emerald-500/10">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Now live on Ethereum, Base &amp; Arbitrum
            </div>
          </ScrollReveal>

          {/* Headline */}
          <ScrollReveal delay={0.15}>
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[1.05] tracking-tight mb-8">
              Your Crypto Tax Agent{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500">
                That Pays for Itself
              </span>
            </h1>
          </ScrollReveal>

          {/* Subheadline */}
          <ScrollReveal delay={0.3}>
            <p className="text-lg sm:text-xl text-gray-700 max-w-2xl mx-auto leading-relaxed mb-12">
              Non-custodial AI that scans every wallet across every chain,
              classifies every transaction with privacy-first Venice AI, finds
              tax loss harvesting opportunities you didn&apos;t know existed, and
              generates IRS-ready forms &mdash; all without you needing ETH.
            </p>
          </ScrollReveal>

          {/* CTAs */}
          <ScrollReveal delay={0.45}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleCta}
                className="px-10 py-4.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-full hover:shadow-2xl hover:shadow-emerald-500/40 transition-all active:scale-[0.97] text-lg backdrop-blur-sm hover:scale-105"
              >
                {isConnected ? 'Go to Dashboard \u2192' : 'Connect Wallet \u2014 It\u2019s Free'}
              </button>
              <a
                href="#how-it-works"
                className="px-10 py-4.5 bg-white/70 backdrop-blur-3xl border border-gray-200/60 text-gray-700 font-semibold rounded-full hover:bg-white/90 hover:border-gray-300/60 transition-all active:scale-[0.97] text-lg shadow-xl hover:scale-105"
              >
                How It Works
              </a>
            </div>
          </ScrollReveal>

          {/* Trust bar */}
          <ScrollReveal delay={0.6}>
            <p className="text-sm text-gray-600 mt-8">
              No subscription. No ETH required. No hidden fees.{' '}
              <span className="text-emerald-600 font-semibold">5% of what we save you.</span>
            </p>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
