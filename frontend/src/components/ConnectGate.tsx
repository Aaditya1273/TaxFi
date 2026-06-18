'use client';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 20, delay: i * 0.12 },
  }),
};

export default function ConnectGate() {
  const { openConnectModal } = useConnectModal();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-[120px]"
        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.18, 0.1] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-teal-400/10 rounded-full blur-[120px]"
        animate={{ scale: [1, 1.3, 1], opacity: [0.08, 0.15, 0.08] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />

      <div className="relative z-10 w-full max-w-md mx-auto text-center">
        {/* Logo */}
        <motion.div
          custom={0}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mb-10"
        >
          <div className="inline-flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center text-2xl font-bold text-white shadow-2xl shadow-emerald-500/30">
                T
              </div>
              <motion.div
                className="absolute -inset-2 rounded-2xl border border-emerald-400/30"
                animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-bold text-white tracking-tight">
                Tax<span className="text-emerald-400">Fi</span>
              </h1>
              <p className="text-sm text-emerald-200/60 mt-0.5">AI Tax Agent</p>
            </div>
          </div>
        </motion.div>

        {/* Tagline */}
        <motion.h2
          custom={1}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight"
        >
          Connect Your Wallet
        </motion.h2>

        <motion.p
          custom={2}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="text-emerald-200/70 text-sm sm:text-base leading-relaxed mb-10 max-w-sm mx-auto"
        >
          Connect your wallet to scan your portfolio for tax loss harvesting opportunities and generate IRS-compliant reports.
        </motion.p>

        {/* Connect Button */}
        <motion.div
          custom={3}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <button
            onClick={() => openConnectModal?.()}
            className="group relative w-full max-w-xs mx-auto px-10 py-4 bg-white text-emerald-900 font-semibold rounded-2xl text-base shadow-2xl hover:shadow-emerald-500/20 transition-all"
          >
            <span className="relative z-10 flex items-center justify-center gap-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Connect Wallet
            </span>
            <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>
        </motion.div>

        {/* Footer */}
        <motion.p
          custom={4}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="text-emerald-200/40 text-xs mt-8"
        >
          No personal data is stored. Read-only access only.
        </motion.p>

        {/* Back link */}
        <motion.div
          custom={5}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mt-8"
        >
          <button
            onClick={() => router.push('/')}
            className="text-emerald-200/50 hover:text-emerald-200/80 text-xs transition-colors inline-flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </button>
        </motion.div>
      </div>
    </div>
  );
}
