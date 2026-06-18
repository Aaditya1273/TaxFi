/**
 * Shared framer-motion spring animation variants.
 *
 * Provides consistent physics-based entrances, hover gestures,
 * and stagger animations across all landing page components.
 *
 * Spring defaults: stiffness=80, damping=15, mass=0.5 → snappy, bouncy
 * but not cartoonish.
 */

import type { Variants, Transition } from 'framer-motion';

// ── Spring transition presets ───────────────────────────────────────────

export const spring: Transition = {
  type: 'spring',
  stiffness: 80,
  damping: 15,
  mass: 0.5,
};

export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 120,
  damping: 18,
  mass: 0.4,
};

export const springGentle: Transition = {
  type: 'spring',
  stiffness: 60,
  damping: 20,
  mass: 0.6,
};

export const springBouncy: Transition = {
  type: 'spring',
  stiffness: 150,
  damping: 10,
  mass: 0.3,
};

// ── Scroll-reveal entrance variants ─────────────────────────────────────

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: spring,
  },
};

export const fadeUpScale: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: spring,
  },
};

export const fadeLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: spring,
  },
};

export const fadeRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: spring,
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springSnappy,
  },
};

// ── Stagger parent (wrap around a list of motion children) ──────────────

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

export const staggerContainerSlow: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.15,
    },
  },
};

// ── Text word-reveal variants ──────────────────────────────────────────

export const wordReveal: Variants = {
  hidden: { y: 40, rotateX: 40, opacity: 0 },
  visible: (i: number) => ({
    y: 0,
    rotateX: 0,
    opacity: 1,
    transition: {
      ...spring,
      delay: i * 0.04,
    },
  }),
};

// ── Hover gesture variants (for cards / buttons) ────────────────────────

export const hoverLift = {
  whileHover: {
    y: -4,
    transition: springSnappy,
  },
  whileTap: { scale: 0.98 },
};

export const hoverScale = {
  whileHover: { scale: 1.05, transition: springSnappy },
  whileTap: { scale: 0.95 },
};

export const hoverGlow = {
  whileHover: {
    boxShadow: '0 8px 32px rgba(16,185,129,0.15)',
    transition: springSnappy,
  },
};

// ── Section header variant (eyebrow + title + subtitle) ─────────────────

export const sectionHeader: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springGentle,
  },
};
