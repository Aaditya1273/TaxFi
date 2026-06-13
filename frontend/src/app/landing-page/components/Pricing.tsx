'use client';

import ScrollReveal from './ScrollReveal';
import StaggerReveal from './animations/StaggerReveal';
import TiltCard from './animations/TiltCard';
import { PricingNew } from './PricingNew';
import { PRICING } from '../data';

export default function Pricing() {
  const pricingPlans = PRICING.map(plan => ({
    name: plan.name,
    price: plan.price,
    yearlyPrice: plan.yearlyPrice,
    period: plan.period,
    features: plan.features,
    description: plan.description,
    buttonText: plan.cta,
    href: plan.href,
    isPopular: plan.featured || false,
  }));

  return (
    <section id="pricing" className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-50/50 to-transparent" />
      <div className="max-w-7xl mx-auto px-6 relative">
        <ScrollReveal>
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/70 backdrop-blur-3xl border border-emerald-200/60 text-emerald-600 text-sm font-medium mb-6 shadow-2xl shadow-emerald-500/10">
              Pricing
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              Pay Only{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">
                When You Save
              </span>
            </h2>
            <p className="text-gray-700 text-lg max-w-2xl mx-auto">
              No subscriptions. No hidden fees. No upfront costs. The free
              tier covers light users; the Trader tier takes 5% of what we save you.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <PricingNew 
            plans={pricingPlans}
            title="Simple, Transparent Pricing"
            description="Choose the plan that works for you. All plans include access to our platform, lead generation tools, and dedicated support."
          />
        </ScrollReveal>
      </div>
    </section>
  );
}
