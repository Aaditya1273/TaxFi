'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TextReveal from './animations/TextReveal';
import { fadeUp, springSnappy } from './animations/motion-variants';

const FAQS = [
  { q: 'Is TaxFi non-custodial?', a: 'Yes. TaxFi uses ERC-7715 Advanced Permissions \ you grant read-only access to your transaction history. We never have access to your private keys and cannot move your funds. Revoke access anytime from your wallet.' },
  { q: 'How does the 5% fee work?', a: 'You only pay when TaxFi saves you money. If we identify and execute a tax loss harvest that saves you $1,000, our fee is $50 (5%). If there are no savings, you pay nothing. No subscriptions, no hidden fees.' },
  { q: 'What chains do you support?', a: 'Ethereum, Base, and Arbitrum are supported at launch. We use Covalent and Alchemy as data sources with automatic fallback \ if one provider is down, the other takes over seamlessly.' },
  { q: 'How do you classify transactions?', a: 'Every transaction is analyzed by Venice AI \ a privacy-first inference API that runs in TEE environments. Your transaction data never trains public models and prompts are never stored. We support 20+ categories including swaps, airdrops, staking, LP events, and more.' },
  { q: 'Do I need ETH for gas?', a: 'No. TaxFi uses the 1Shot permissionless relayer. Gas is paid in USDC from the harvested proceeds. You never need to hold ETH, bridge tokens, or think about gas fees at any point.' },
  { q: 'Is this tax advice?', a: 'No. TaxFi generates reports based on your transaction data using the cost basis method you select. We are not a CPA or tax attorney. Always consult a qualified tax professional before filing. Our onchain attestation creates an immutable audit trail your CPA can verify.' },
];

function AccordionItem({ faq, isOpen, onClick }: { faq: typeof FAQS[0]; isOpen: boolean; onClick: () => void }) {
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button onClick={onClick} className="w-full flex items-center justify-between py-5 text-left group">
        <span className={`text-sm font-medium pr-8 transition-colors duration-300 ${isOpen ? 'text-emerald-600' : 'text-gray-900 group-hover:text-emerald-600'}`}>{faq.q}</span>
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={springSnappy}
          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isOpen ? 'bg-emerald-100' : 'bg-gray-100'}`}
        >
          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ ...springSnappy, duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="text-sm text-gray-600 pb-5 pr-12 leading-relaxed">{faq.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  return (
    <section id="faq" className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-50/30 to-transparent" />
      <div className="max-w-3xl mx-auto px-6 relative">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUp}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/80 backdrop-blur-3xl border border-emerald-200/60 text-emerald-600 text-sm font-medium mb-6 shadow-2xl shadow-emerald-500/10">
            FAQ
          </div>
          <TextReveal as="h2" className="text-4xl sm:text-5xl font-bold tracking-tight mb-6" stagger={0.03}>
            Frequently Asked Questions
          </TextReveal>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ ...springSnappy, delay: 0.3 }}
          className="bg-white/80 backdrop-blur-2xl border border-white/60 rounded-[2rem] px-8 py-2 shadow-xl shadow-emerald-500/5"
        >
          {FAQS.map((faq, i) => (
            <AccordionItem key={i} faq={faq} isOpen={activeFaq === i} onClick={() => setActiveFaq(activeFaq === i ? null : i)} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
