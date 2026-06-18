'use client';

import { motion } from 'framer-motion';
import CountUp from './animations/CountUp';
import { staggerContainer, springGentle } from './animations/motion-variants';

const stats = [
  { value: 1247, label: 'Transactions Classified', suffix: '', color: 'from-emerald-500 to-teal-500' },
  { value: 2.4, label: 'Tax Savings Found', prefix: '$', suffix: 'M', decimals: 1, color: 'from-blue-500 to-cyan-500' },
  { value: 99.2, label: 'Classification Accuracy', suffix: '%', decimals: 1, color: 'from-purple-500 to-pink-500' },
  { value: 7, label: 'Supported Chains', suffix: '', color: 'from-emerald-500 to-teal-500' },
];

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: springGentle },
};

export default function Stats() {
  return (
    <section className="relative z-20 -mt-20 pb-24">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={staggerContainer}
          className="bg-white/80 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-10 grid grid-cols-2 md:grid-cols-4 gap-8 shadow-2xl shadow-emerald-500/10"
        >
          {stats.map((stat, i) => (
            <motion.div key={i} variants={itemVariants} className="text-center group">
              <div className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1 tabular-nums">
                <CountUp end={stat.value} prefix={stat.prefix || ''} suffix={stat.suffix || ''} decimals={stat.decimals || 0} duration={2.5} />
              </div>
              <div className="text-sm text-gray-500 font-medium">{stat.label}</div>
              {i < stats.length - 1 && (
                <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-12 bg-gradient-to-b from-transparent via-gray-200 to-transparent" />
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
