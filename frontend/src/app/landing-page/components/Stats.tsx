'use client';

import CountUp from './CountUp';
import ScrollReveal from './ScrollReveal';
import { STATS } from '../data';

export default function Stats() {
  return (
    <section className="relative z-20 -mt-32 pb-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="bg-white/70 backdrop-blur-2xl border border-white/50 rounded-[2.5rem] px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 shadow-xl shadow-emerald-500/10">
          {STATS.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">
                {stat.value === 0 ? (
                  <span className="text-gray-400">--</span>
                ) : (
                  <CountUp end={stat.value} prefix={stat.prefix || ''} suffix={stat.suffix || ''} />
                )}
              </div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
