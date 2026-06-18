'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TextReveal from './animations/TextReveal';
import { fadeUpScale, springSnappy } from './animations/motion-variants';

const tabs = ['Portfolio', 'Harvest', 'Reports'];

const portfolioData = [
  { asset: 'ETH', amount: '2.45', value: '$4,396', cost: '$3,500', gl: '+$896', change: '+25.6%', up: true },
  { asset: 'BTC', amount: '0.12', value: '$7,897', cost: '$8,400', gl: '-$503', change: '-6.0%', up: false },
  { asset: 'UNI', amount: '1,250', value: '$12,875', cost: '$9,375', gl: '+$3,500', change: '+37.3%', up: true },
  { asset: 'SOL', amount: '45', value: '$6,390', cost: '$5,850', gl: '+$540', change: '+9.2%', up: true },
  { asset: 'AAVE', amount: '18', value: '$2,844', cost: '$3,600', gl: '-$756', change: '-21.0%', up: false },
];

const rowVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { ...springSnappy, delay: 0.5 + i * 0.06 },
  }),
};

const summaryCards = [
  { label: 'Total Value', value: '$34,402', change: '+$3,677', up: true },
  { label: 'Harvestable Losses', value: '$1,259', change: '-2 positions', up: false },
  { label: 'Est. Tax Savings', value: '$314', change: 'YTD', up: true },
];

export default function DashboardMockup() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/30 via-transparent to-transparent" />
      <div className="max-w-7xl mx-auto px-6 relative">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUpScale}
          className="text-center mb-12"
        >
          <TextReveal as="h2" className="text-4xl sm:text-5xl font-bold tracking-tight mb-6" stagger={0.03}>
            See Your Tax Position in Real Time
          </TextReveal>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            A live dashboard showing your portfolio, harvest opportunities, and estimated tax savings &mdash; updated continuously.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ ...springSnappy, delay: 0.3 }}
          className="max-w-4xl mx-auto"
        >
          <div className="bg-white/90 backdrop-blur-2xl border border-white/70 rounded-[2rem] overflow-hidden shadow-2xl shadow-emerald-500/10">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <span className="text-xs text-gray-400 font-mono">dashboard.taxfi.io</span>
              </div>
              <div className="flex items-center gap-2">
                <motion.span
                  className="w-2 h-2 rounded-full bg-emerald-500"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="text-xs text-emerald-600 font-medium">Live</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-4 flex gap-4 border-b border-gray-100">
              {tabs.map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(i)}
                  className={`pb-3 text-sm font-medium transition-colors relative ${
                    activeTab === i ? 'text-emerald-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab}
                  {activeTab === i && (
                    <motion.div
                      layoutId="tab-underline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                    />
                  )}
                </button>
              ))}
              <div className="flex-1" />
              <div className="pb-3 text-xs text-gray-400 font-mono">Last sync: 12s ago</div>
            </div>

            {/* Animated tab content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={springSnappy}
                className="p-6"
              >
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {summaryCards.map((card, i) => (
                    <motion.div
                      key={i}
                      variants={rowVariants}
                      custom={i}
                      initial="hidden"
                      animate="visible"
                      className="bg-gradient-to-br from-emerald-50/50 to-teal-50/30 rounded-xl p-4 border border-emerald-100/50"
                    >
                      <div className="text-xs text-gray-500 mb-1">{card.label}</div>
                      <div className="text-lg font-bold text-gray-900">{card.value}</div>
                      <div className={`text-xs ${card.up ? 'text-emerald-600' : 'text-red-500'}`}>{card.change}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Table */}
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-400 font-medium">
                      <th className="text-left pb-3 font-normal">Asset</th>
                      <th className="text-right pb-3 font-normal">Amount</th>
                      <th className="text-right pb-3 font-normal">Value</th>
                      <th className="text-right pb-3 font-normal">Cost Basis</th>
                      <th className="text-right pb-3 font-normal">G/L</th>
                      <th className="text-right pb-3 font-normal">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioData.map((row, i) => (
                      <motion.tr
                        key={row.asset}
                        variants={rowVariants}
                        custom={i}
                        initial="hidden"
                        animate="visible"
                        className="border-t border-gray-50 group hover:bg-emerald-50/30 transition-colors"
                      >
                        <td className="py-3"><span className="text-sm font-semibold text-gray-900">{row.asset}</span></td>
                        <td className="py-3 text-right text-sm text-gray-600">{row.amount}</td>
                        <td className="py-3 text-right text-sm font-medium text-gray-900">{row.value}</td>
                        <td className="py-3 text-right text-sm text-gray-600">{row.cost}</td>
                        <td className={`py-3 text-right text-sm font-medium ${row.up ? 'text-emerald-600' : 'text-red-500'}`}>{row.gl}</td>
                        <td className={`py-3 text-right text-sm ${row.up ? 'text-emerald-600' : 'text-red-500'}`}>{row.change}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <motion.span
                      className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <span className="text-xs text-gray-400">Auto-scanning every 60 minutes</span>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">6 harvest opportunities found</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
