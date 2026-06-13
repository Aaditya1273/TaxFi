'use client';

import { useState } from 'react';
import ScrollReveal from './ScrollReveal';
import FAQAccordion from './FAQAccordion';
import { FAQS } from '../data';

export default function FAQ() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  return (
    <section id="faq" className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-50/50 to-transparent" />
      <div className="max-w-3xl mx-auto px-6 relative">
        <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              Frequently Asked{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">
                Questions
              </span>
            </h2>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <div className="bg-white/70 backdrop-blur-2xl border border-white/50 rounded-[2.5rem] px-8 py-2 shadow-xl shadow-emerald-500/10">
            {FAQS.map((faq, i) => (
              <FAQAccordion
                key={i}
                item={faq}
                isOpen={activeFaq === i}
                onClick={() => setActiveFaq(activeFaq === i ? null : i)}
              />
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
