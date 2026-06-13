'use client';

import ScrollReveal from './ScrollReveal';
import StaggerReveal from './animations/StaggerReveal';
import TiltCard from './animations/TiltCard';
import { STEPS } from '../data';

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-50/50 to-transparent" />
      <div className="max-w-7xl mx-auto px-6 relative">
        <ScrollReveal>
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/70 backdrop-blur-3xl border border-emerald-200/60 text-emerald-600 text-sm font-medium mb-6 shadow-2xl shadow-emerald-500/10">
              Three Simple Steps
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              From Wallet to Tax Savings{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">
                in 60 Seconds
              </span>
            </h2>
            <p className="text-gray-700 text-lg max-w-2xl mx-auto">
              No downloads, no subscriptions, no ETH required. Just connect,
              scan, and save.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-1/2 left-[16%] right-[16%] h-px bg-gradient-to-r from-emerald-500/0 via-emerald-500/30 to-emerald-500/0 -translate-y-1/2" />

          <StaggerReveal staggerDelay={0.15} className="grid md:grid-cols-3 gap-8 md:gap-0 col-span-3">
            {STEPS.map((step, i) => (
              <div key={i}>
                <TiltCard maxTilt={4} glare={false}>
                  <div className="relative group">
                    <div className="bg-white/70 backdrop-blur-2xl border border-white/50 rounded-[2.5rem] p-8 h-full relative shadow-xl shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-shadow">
                      <div className="text-6xl font-bold text-emerald-500/10 absolute top-4 right-6 select-none">
                        {step.number}
                      </div>
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-xl font-bold text-emerald-600 mb-6 group-hover:scale-110 transition-transform duration-500">
                        {step.number}
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-3 relative z-10">
                        {step.title}
                      </h3>
                      <p className="text-gray-600 leading-relaxed relative z-10">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </TiltCard>
              </div>
            ))}
          </StaggerReveal>
        </div>
      </div>
    </section>
  );
}
