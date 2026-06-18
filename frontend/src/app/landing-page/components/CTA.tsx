'use client';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { motion } from 'framer-motion';
import Lightfall from './Lightfall';
import TextReveal from './animations/TextReveal';
import { fadeUp, springSnappy } from './animations/motion-variants';

export default function CTA() {
  const { openConnectModal } = useConnectModal();
  const handleCta = () => {
    if (openConnectModal) {
      openConnectModal();
    }
  };

  return (
    <section className="py-40 relative overflow-hidden bg-[#052E16]">
      {/* Lightfall WebGL background */}
      <div className="absolute inset-0 w-full h-full">
        <Lightfall
          colors={['#10B981', '#34D399', '#14B8A6', '#047857']}
          backgroundColor="#052E16"
          speed={0.6}
          streakCount={3}
          streakWidth={1.2}
          streakLength={0.8}
          glow={1.2}
          density={0.5}
          twinkle={0.8}
          zoom={2.5}
          backgroundGlow={0.4}
          opacity={0.85}
          mouseInteraction={true}
          mouseStrength={0.4}
          mouseRadius={1.2}
        />
      </div>

      {/* Frost overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#052E16]/60 via-transparent to-[#052E16]/60 z-[1]" />

      <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUp}
        >
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 backdrop-blur-3xl border border-white/20 text-white text-sm font-medium mb-8 shadow-2xl">
            Start Saving Today
          </div>
        </motion.div>

        <TextReveal as="h2" className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 text-white" stagger={0.04}>
          Your Tax Agent Is One Click Away
        </TextReveal>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-emerald-100/80 text-lg max-w-2xl mx-auto mb-12"
        >
          Connect your wallet. Grant read-only permission. Let the agents find savings you didn&apos;t know existed. Free if you don&apos;t save anything.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ ...springSnappy, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <motion.button
            onClick={handleCta}
            whileHover={{ scale: 1.05, boxShadow: '0 20px 40px rgba(16,185,129,0.3)' }}
            whileTap={{ scale: 0.97 }}
            transition={springSnappy}
            className="group relative px-12 py-5 bg-white text-emerald-900 font-semibold rounded-full text-lg shadow-2xl"
          >
            <span className="relative z-10">
              Connect Wallet — It's Free
            </span>
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-50 to-teal-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </motion.button>
          <motion.a
            href="#how-it-works"
            whileHover={{ scale: 1.05, x: 4 }}
            whileTap={{ scale: 0.97 }}
            transition={springSnappy}
            className="group px-12 py-5 bg-white/10 backdrop-blur-3xl border border-white/20 text-white font-semibold rounded-full hover:bg-white/20 transition-all text-lg shadow-xl cursor-pointer"
          >
            Learn More
            <span className="inline-block ml-1 transition-transform group-hover:translate-x-1">→</span>
          </motion.a>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
          className="text-emerald-200/60 text-sm mt-8"
        >
          No ETH required. No subscription. 5% of what we save you.
        </motion.p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent z-[2]" />
    </section>
  );
}
