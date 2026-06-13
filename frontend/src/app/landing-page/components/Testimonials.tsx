'use client';

import ScrollReveal from './ScrollReveal';

export default function Testimonials() {
  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-50/50 to-transparent" />
      <div className="max-w-7xl mx-auto px-6 relative">
        <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              Share Your{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">
                Experience
              </span>
            </h2>
            <p className="text-gray-700 text-lg max-w-2xl mx-auto">
              Connect your wallet and start saving on taxes today.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <div className="bg-white/70 backdrop-blur-2xl border border-white/50 rounded-[2.5rem] p-12 text-center shadow-xl shadow-emerald-500/10">
            <div className="text-gray-400 text-lg mb-4">No testimonials yet</div>
            <div className="text-gray-500 text-sm">Be the first to share your experience with TaxFi</div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
