'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useRouter } from 'next/navigation';
import TextReveal from './animations/TextReveal';
import { fadeUp, spring, springSnappy, staggerContainer } from './animations/motion-variants';

const PLANS = [
  {
    name: 'Free',
    price: { monthly: '$0', yearly: '$0' },
    period: { monthly: '/ month', yearly: '/ year' },
    description: 'For light users exploring crypto tax',
    features: ['1,000 transactions/year', 'US jurisdiction only', 'Basic Form 8949', 'FIFO basis method', 'Community support'],
    cta: 'Get Started',
  },
  {
    name: 'Trader',
    price: { monthly: '5%', yearly: '4%' },
    period: { monthly: ' of savings', yearly: ' of savings' },
    description: 'Only when you save \ no savings, no fee',
    features: ['Unlimited transactions', 'All jurisdictions', 'Full Form 8949 + Schedule D', 'HIFO / FIFO / LIFO / SpecID', 'Real-time loss detection', 'One-tap harvest execution', 'Priority support'],
    cta: 'Start Saving',
    popular: true,
  },
  {
    name: 'Pro',
    price: { monthly: '$299', yearly: '$239' },
    period: { monthly: '/ year', yearly: '/ year' },
    description: 'For power users and CPAs',
    features: ['Everything in Trader', 'CPA review portal', 'Audit insurance', 'Multi-year ledger history', 'API access', 'Slack / Discord alerts', 'White-label exports'],
    cta: 'Go Pro',
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: PLANS[i].popular ? 1.05 : 1,
    transition: { ...spring, delay: 0.1 + i * 0.1 },
  }),
};

export default function Pricing() {
  const [yearly, setYearly] = useState(false);
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const router = useRouter();

  const handleCta = (href: string) => {
    if (isConnected) {
      router.push(href);
    } else if (openConnectModal) {
      openConnectModal();
    }
  };

  return (
    <section id="pricing" className="py-32 relative">
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
            Pricing
          </div>
          <TextReveal as="h2" className="text-4xl sm:text-5xl font-bold tracking-tight mb-6" stagger={0.03}>
            Pay Only When You Save
          </TextReveal>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto mb-8">
            No subscriptions. No hidden fees. No upfront costs. The free
            tier covers light users; the Trader tier takes 5% of what we save you.
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-2xl border border-gray-200/60 rounded-full p-1.5 shadow-lg">
            <motion.button
              onClick={() => setYearly(false)}
              whileTap={{ scale: 0.97 }}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${!yearly ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Monthly
            </motion.button>
            <motion.button
              onClick={() => setYearly(true)}
              whileTap={{ scale: 0.97 }}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${yearly ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Yearly
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">-20%</span>
            </motion.button>
          </div>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={staggerContainer}
          className="grid md:grid-cols-3 gap-8 items-start max-w-5xl mx-auto"
        >
          {PLANS.map((plan, i) => {
            const price = yearly ? plan.price.yearly : plan.price.monthly;
            const period = yearly ? plan.period.yearly : plan.period.monthly;

            return (
              <motion.div
                key={i}
                custom={i}
                variants={cardVariants}
                whileHover={plan.popular ? { y: -8, transition: springSnappy } : { y: -4, transition: springSnappy }}
                className={`relative bg-white/80 backdrop-blur-2xl border rounded-[2rem] p-8 shadow-xl ${
                  plan.popular ? 'border-emerald-200/80 shadow-emerald-500/15 z-10' : 'border-white/60 shadow-emerald-500/5'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold rounded-full shadow-lg whitespace-nowrap">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h3>
                  <p className="text-sm text-gray-500">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">{price}</span>
                  <span className="text-sm text-gray-500 ml-1">{period}</span>
                </div>

                <motion.button
                  onClick={() => handleCta('/dashboard')}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={springSnappy}
                  className={`w-full py-3 rounded-full text-sm font-semibold mb-6 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {plan.cta}
                </motion.button>

                <ul className="space-y-3">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
