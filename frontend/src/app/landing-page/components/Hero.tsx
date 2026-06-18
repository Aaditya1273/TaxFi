'use client';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import ParticleField from './animations/ParticleField';
import TextReveal from './animations/TextReveal';
import { fadeUp, springSnappy } from './animations/motion-variants';

export default function Hero() {
  const { openConnectModal } = useConnectModal();
  const { isConnected } = useAccount();
  const router = useRouter();

  const handleCta = () => {
    if (isConnected) {
      router.push('/dashboard');
    } else if (openConnectModal) {
      openConnectModal();
    }
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <ParticleField />

      {/* Gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-teal-50" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(16,185,129,0.06),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(20,184,166,0.06),transparent_50%)]" />

      {/* Animated morphing orbs */}
      <motion.div
        className="absolute top-20 left-[15%] w-[500px] h-[500px] opacity-20 bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-400 blur-[100px]"
        animate={{ borderRadius: ['60% 40% 30% 70% / 60% 30% 70% 40%', '30% 60% 70% 40% / 50% 60% 30% 60%', '60% 40% 30% 70% / 60% 30% 70% 40%'] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-20 right-[15%] w-[400px] h-[400px] opacity-15 bg-gradient-to-br from-teal-400 via-cyan-400 to-emerald-400 blur-[100px]"
        animate={{ borderRadius: ['30% 60% 70% 40% / 50% 60% 30% 60%', '60% 40% 30% 70% / 60% 30% 70% 40%', '30% 60% 70% 40% / 50% 60% 30% 60%'] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
      />

      {/* Floating orbs */}
      <motion.div
        className="absolute top-[15%] right-[10%] w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-2xl shadow-emerald-500/30 hidden lg:block"
        animate={{ y: [0, -15, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-[30%] left-[8%] w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 shadow-2xl shadow-cyan-500/30 hidden lg:block"
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />
      <motion.div
        className="absolute bottom-[25%] right-[20%] w-20 h-20 rounded-full bg-gradient-to-br from-teal-300 to-emerald-500 shadow-2xl shadow-teal-500/30 hidden lg:block"
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />

      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(16,185,129,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.1) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-white to-transparent z-10" />

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="text-xs text-gray-400 font-medium tracking-widest uppercase">Scroll</span>
        <div className="w-5 h-8 rounded-full border-2 border-gray-300 flex items-start justify-center p-1">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-emerald-500"
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-36 pb-24">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={springSnappy}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/80 backdrop-blur-3xl border border-emerald-200/60 text-emerald-600 text-sm font-medium mb-8 shadow-2xl shadow-emerald-500/10"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Now live on Ethereum, Base &amp; Arbitrum
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold ml-1">NEW</span>
          </motion.div>

          {/* Headline */}
          <div className="mb-8">
            <TextReveal
              as="h1"
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[1.05] tracking-tight"
              stagger={0.04}
              
            >
              TaxFi
            </TextReveal>
          </div>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSnappy, delay: 1.2 }}
            className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-12"
          >
            Your Crypto Tax Agent That Pays for Itself
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSnappy, delay: 1.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-5"
          >
            {/* Primary CTA — transforms after wallet connect */}
            <motion.button
              onClick={handleCta}
              whileHover={{ scale: 1.03, y: -1.5 }}
              whileTap={{ scale: 0.97 }}
              transition={springSnappy}
              className="group relative inline-flex items-center justify-center gap-2 px-7 py-3 rounded-2xl text-white font-semibold text-[15px] tracking-tight overflow-hidden"
              style={{
                background: 'linear-gradient(160deg, #34d399 0%, #10b981 40%, #0d9488 100%)',
                boxShadow: '0 4px 24px rgba(16,185,129,0.30), 0 1px 4px rgba(16,185,129,0.15), inset 0 1px 0 rgba(255,255,255,0.22)',
              }}
            >
              {/* Top gloss */}
              <span className="absolute inset-x-0 top-0 h-1/2 rounded-t-2xl bg-gradient-to-b from-white/[0.16] to-transparent pointer-events-none" />
              {/* Hover shimmer */}
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.14),transparent_60%)] pointer-events-none" />

              <AnimatePresence mode="wait">
                {isConnected ? (
                  <motion.span
                    key="dashboard"
                    className="relative z-10 flex items-center gap-2"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Go to Dashboard
                    <svg className="w-3.5 h-3.5 opacity-70 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </motion.span>
                ) : (
                  <motion.span
                    key="connect"
                    className="relative z-10 flex items-center gap-2"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M9 14h.01M13 14h.01M17 14h.01M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Connect Wallet
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Secondary CTA */}
            <motion.a
              href="#how-it-works"
              whileHover={{ scale: 1.03, y: -1.5 }}
              whileTap={{ scale: 0.97 }}
              transition={springSnappy}
              className="group relative inline-flex items-center justify-center gap-2 px-7 py-3 rounded-2xl text-gray-600 font-semibold text-[15px] tracking-tight overflow-hidden cursor-pointer"
              style={{
                background: 'linear-gradient(160deg, rgba(255,255,255,0.95) 0%, rgba(246,248,250,0.92) 100%)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,1), 0 0 0 1px rgba(16,185,129,0.1)',
                backdropFilter: 'blur(20px)',
              }}
            >
              {/* Top gloss */}
              <span className="absolute inset-x-0 top-0 h-1/2 rounded-t-2xl bg-gradient-to-b from-white/50 to-transparent pointer-events-none" />
              {/* Hover tint */}
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 pointer-events-none rounded-2xl" />

              <span className="relative z-10 flex items-center gap-1.5 group-hover:text-emerald-600 transition-colors duration-200">
                How It Works
                <svg className="w-3.5 h-3.5 opacity-40 group-hover:opacity-80 group-hover:translate-x-0.5 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </motion.a>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSnappy, delay: 1.8 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-8"
          >
            <div className="flex -space-x-2">
              {['U','B','A','E'].map((letter, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white">
                  {letter}
                </div>
              ))}
              <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-500 shadow-lg">
                +5
              </div>
            </div>
            <div className="text-xs text-gray-500">
              <span className="text-emerald-600 font-semibold">1,200+</span> wallets connected
            </div>
            <div className="text-xs text-gray-500">
              <span className="text-emerald-600 font-semibold">$2.4M</span> tax savings found
            </div>
          </motion.div>

          {/* Trust bar */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="text-sm text-gray-500 mt-8"
          >
            No subscription. No ETH required. No hidden fees.{' '}
            <span className="text-emerald-600 font-semibold">5% of what we save you.</span>
          </motion.p>
        </div>
      </div>
    </section>
  );
}
