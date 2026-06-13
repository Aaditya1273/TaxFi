'use client';

import ScrollReveal from './ScrollReveal';
import { COMPETITIVE_ADVANTAGES } from '../data';

export default function Comparison() {
  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-50/50 to-transparent" />
      <div className="max-w-7xl mx-auto px-6 relative">
        <ScrollReveal>
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/70 backdrop-blur-3xl border border-emerald-200/60 text-emerald-600 text-sm font-medium mb-6 shadow-2xl shadow-emerald-500/10">
              Why TaxFi
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              The Only{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">
                Agentic Tax Platform
              </span>
            </h2>
            <p className="text-gray-700 text-lg max-w-2xl mx-auto">
              Unlike tools that just file at year-end, TaxFi runs continuously,
              finds savings in real time, and executes them without you lifting a finger.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <div className="bg-white/70 backdrop-blur-2xl border border-white/50 rounded-[2.5rem] overflow-hidden shadow-xl shadow-emerald-500/10">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-6 py-5 text-sm font-semibold text-gray-900">Feature</th>
                    <th className="text-center px-6 py-5 text-sm font-bold text-emerald-500">TaxFi</th>
                    <th className="text-center px-6 py-5 text-sm font-medium text-gray-500">CoinTracker</th>
                    <th className="text-center px-6 py-5 text-sm font-medium text-gray-500">Koinly</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPETITIVE_ADVANTAGES.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="px-6 py-5 text-sm text-gray-600">{row.feature}</td>
                      <td className="text-center px-6 py-5">
                        {row.taxfi === true ? (
                          <span className="text-emerald-500 text-lg">✓</span>
                        ) : (
                          <span className="text-emerald-500 text-sm font-medium">{row.taxfi}</span>
                        )}
                      </td>
                      <td className="text-center px-6 py-5">
                        {row.cointracker === true ? (
                          <span className="text-emerald-500/50 text-lg">✓</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="text-center px-6 py-5">
                        {row.koinly === true ? (
                          <span className="text-emerald-500/50 text-lg">✓</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
