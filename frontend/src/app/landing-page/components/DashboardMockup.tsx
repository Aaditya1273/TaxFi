'use client';

import ScrollReveal from './ScrollReveal';
import { MOCKUP_CARDS, MOCKUP_ROWS } from '../data';

export default function DashboardMockup() {
  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/50 via-transparent to-transparent" />
      <div className="max-w-7xl mx-auto px-6 relative">
        <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              See Your Tax Position{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">
                in Real Time
              </span>
            </h2>
            <p className="text-gray-700 text-lg max-w-2xl mx-auto">
              A live dashboard showing your portfolio, harvest opportunities, and
              estimated tax savings &mdash; updated continuously.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <div className="bg-white/70 backdrop-blur-2xl border border-white/50 rounded-[2.5rem] overflow-hidden p-8 sm:p-12 shadow-xl shadow-emerald-500/10">
            <div className="text-center py-12">
              <div className="text-gray-400 text-lg mb-4">Dashboard Preview</div>
              <div className="text-gray-500 text-sm">Connect your wallet to see your tax position</div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
