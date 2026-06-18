'use client';

import { motion } from 'framer-motion';
import TextReveal from './animations/TextReveal';
import { fadeUp, spring, staggerContainer } from './animations/motion-variants';

const ROWS = [
  { feature: 'Non-custodial', taxfi: true, cointracker: false, koinly: false },
  { feature: 'Agentic / Real-time', taxfi: true, cointracker: false, koinly: false },
  { feature: 'Gasless (no ETH needed)', taxfi: true, cointracker: false, koinly: false },
  { feature: 'AI Transaction Classification', taxfi: true, cointracker: 'Partial', koinly: false },
  { feature: 'Tax Loss Harvesting', taxfi: true, cointracker: false, koinly: false },
  { feature: 'Pay Only on Savings', taxfi: true, cointracker: false, koinly: false },
  { feature: 'Onchain Audit Trail', taxfi: true, cointracker: false, koinly: false },
  { feature: 'ERC-7715 Permissions', taxfi: true, cointracker: false, koinly: false },
];

const rowVariants = {
  hidden: { opacity: 0, x: -15 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { ...spring, delay: 0.4 + i * 0.06 },
  }),
};

export default function Comparison() {
  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-50/30 to-transparent" />
      <div className="max-w-7xl mx-auto px-6 relative">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUp}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/80 backdrop-blur-3xl border border-emerald-200/60 text-emerald-600 text-sm font-medium mb-6 shadow-2xl shadow-emerald-500/10">
            Why TaxFi
          </div>
          <TextReveal as="h2" className="text-4xl sm:text-5xl font-bold tracking-tight mb-6" stagger={0.03}>
            The Only Agentic Tax Platform
          </TextReveal>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Unlike tools that just file at year-end, TaxFi runs continuously, finds savings in real time, and executes them without you lifting a finger.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          className="max-w-4xl mx-auto"
        >
          <div className="bg-white/80 backdrop-blur-2xl border border-white/60 rounded-[2rem] overflow-hidden shadow-xl shadow-emerald-500/5">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-5 text-sm font-semibold text-gray-900">Feature</th>
                    <th className="text-center px-6 py-5"><span className="text-sm font-bold text-emerald-500 bg-emerald-50 px-3 py-1.5 rounded-full">TaxFi</span></th>
                    <th className="text-center px-6 py-5 text-sm font-medium text-gray-500">CoinTracker</th>
                    <th className="text-center px-6 py-5 text-sm font-medium text-gray-500">Koinly</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row, i) => (
                    <motion.tr
                      key={i}
                      custom={i}
                      variants={rowVariants}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true }}
                      className="border-b border-gray-50 last:border-0 transition-colors hover:bg-emerald-50/30"
                    >
                      <td className="px-6 py-4 text-sm text-gray-700 font-medium">{row.feature}</td>
                      <td className="text-center px-6 py-4">
                        {row.taxfi === true ? <span className="text-emerald-500 text-lg">✓</span> : <span className="text-emerald-500 text-sm font-medium">{row.taxfi}</span>}
                      </td>
                      <td className="text-center px-6 py-4">
                        {row.cointracker === true ? <span className="text-emerald-500/50 text-lg">✓</span> : row.cointracker === false ? <span className="text-gray-300">—</span> : <span className="text-xs text-gray-400">{row.cointracker}</span>}
                      </td>
                      <td className="text-center px-6 py-4">
                        {row.koinly === true ? <span className="text-emerald-500/50 text-lg">✓</span> : <span className="text-gray-300">—</span>}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
