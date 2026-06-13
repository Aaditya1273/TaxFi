'use client';

import ScrollReveal from './ScrollReveal';
import StaggerReveal from './animations/StaggerReveal';
import TiltCard from './animations/TiltCard';
import { FEATURES } from '../data';

export default function Features() {
  return (
    <section id="features" className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-50/50 to-transparent" />
      <div className="max-w-7xl mx-auto px-6 relative">
        <ScrollReveal>
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/70 backdrop-blur-3xl border border-emerald-200/60 text-emerald-600 text-sm font-medium mb-6 shadow-2xl shadow-emerald-500/10">
              Platform Features
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              Everything You Need to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">
                Minimize Your Taxes
              </span>
            </h2>
            <p className="text-gray-700 text-lg max-w-2xl mx-auto">
              A complete multi-agent pipeline working 24/7 to find and execute
              tax savings you didn&apos;t know existed.
            </p>
          </div>
        </ScrollReveal>

        <StaggerReveal staggerDelay={0.08} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, i) => (
            <div key={i}>
              <TiltCard maxTilt={5} glare={false}>
                <div className="group bg-white/70 backdrop-blur-2xl border border-white/50 rounded-[2.5rem] p-8 h-full shadow-xl shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-shadow">
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity`}
                  />
                  <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
                    <div
                      className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-sm font-bold text-emerald-600 group-hover:scale-110 transition-all duration-500`}
                    >
                      {i + 1}
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed text-sm">
                    {feature.description}
                  </p>
                  <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-emerald-500/0 to-transparent group-hover:via-emerald-500/30 transition-all duration-700" />
                </div>
              </TiltCard>
            </div>
          ))}
        </StaggerReveal>
      </div>
    </section>
  );
}
