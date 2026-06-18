'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { wordReveal } from './motion-variants';

interface TextRevealProps {
  children: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';
  stagger?: number;
}

export default function TextReveal({
  children,
  className = '',
  as: Tag = 'span',
  stagger = 0.04,
}: TextRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  const words = children.split(' ');

  const MotionTag = motion[Tag as keyof typeof motion] as React.ElementType;

  return (
    <div ref={ref} className={className}>
      <MotionTag className="inline-block">
        {words.map((word, i) => (
          <motion.span
            key={i}
            className="inline-block"
            custom={i}
            variants={wordReveal}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
          >
            {word}
            {i < words.length - 1 && '\u00A0'}
          </motion.span>
        ))}
      </MotionTag>
    </div>
  );
}
