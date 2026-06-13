'use client';

import ScrollReveal from './ScrollReveal';
import { SECURITY_ITEMS } from '../data';

export default function Security() {
  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-50/50 to-transparent" />
      <div className="max-w-7xl mx-auto px-6 relative">
        <ScrollReveal>
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/70 backdrop-blur-3xl border border-emerald-200/60 text-emerald-600 text-sm font-medium mb-6 shadow-2xl shadow-emerald-500/10">
              Security First
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              Non-Custodial by{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">
                Design
              </span>
            </h2>
            <p className="text-gray-700 text-lg max-w-2xl mx-auto">
              Your keys, your control. TaxFi never holds your funds, never
              requests your seed phrase, and never compromises on security.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {SECURITY_ITEMS.map((item, i) => (
            <ScrollReveal key={i} delay={0.1 * i}>
              <div className="bg-white/70 backdrop-blur-2xl border border-white/50 rounded-[2rem] p-6 text-center shadow-xl shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-shadow">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-sm font-bold text-emerald-600 mx-auto mb-4">
                  {i + 1}
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
