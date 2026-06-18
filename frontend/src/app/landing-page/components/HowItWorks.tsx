'use client';

import { motion } from 'framer-motion';
import TextReveal from './animations/TextReveal';
import { fadeUp, spring } from './animations/motion-variants';

const STEPS = [
  {
    number: '01',
    title: 'Connect Your Wallet',
    description: 'Grant read-only ERC-7715 permission. Your wallet stays under your control. TaxFi can only read your transaction history, never move funds.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'AI Scans Everything',
    description: 'Our multi-agent pipeline ingests every transaction across Ethereum, Base, and Arbitrum, classifies each one with Venice AI, and builds your cost basis ledger in real time.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Save on Taxes Automatically',
    description: 'TaxFi identifies harvestable losses, optimizes your cost basis method (HIFO), and generates IRS-ready forms. You pay only 5% of what we save you.',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { ...spring, delay: 0.2 + i * 0.15 },
  }),
};

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-50/40 to-transparent" />
      <div className="max-w-7xl mx-auto px-6 relative">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUp}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/80 backdrop-blur-3xl border border-emerald-200/60 text-emerald-600 text-sm font-medium mb-6 shadow-2xl shadow-emerald-500/10">
            Three Simple Steps
          </div>
          <TextReveal as="h2" className="text-4xl sm:text-5xl font-bold tracking-tight mb-6" stagger={0.03}>
            From Wallet to Tax Savings in 60 Seconds
          </TextReveal>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            No downloads, no subscriptions, no ETH required. Just connect, scan, and save.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((step, i) => (
            <motion.div
              key={i}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={cardVariants}
              whileHover={{ y: -6, transition: { type: 'spring', stiffness: 120, damping: 15 } }}
            >
              <div className="bg-white/80 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-8 h-full relative shadow-xl shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-shadow duration-300">
                <div className="absolute top-4 right-6 text-7xl font-bold text-emerald-500/5 select-none leading-none">
                  {step.number}
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-emerald-600 mb-6">
                  {step.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 relative z-10">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed relative z-10 text-sm">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
