'use client';

import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { ReactNode } from 'react';

const SPRING_ENTER = { type: 'spring' as const, stiffness: 120, damping: 18, mass: 1 };
const SPRING_EXIT = { type: 'spring' as const, stiffness: 150, damping: 20, mass: 0.8 };

const pageVariants: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  enter: { opacity: 1, y: 0, scale: 1, transition: SPRING_ENTER },
  exit: { opacity: 0, y: -8, scale: 0.97, filter: 'blur(2px)', transition: SPRING_EXIT },
};

/**
 * Returns a route group key from the pathname.
 * - `/` → `'home'`
 * - `/dashboard`, `/portfolio`, etc. → `'app'`
 *
 * This is used as the `key` for AnimatePresence so transitions only fire
 * when crossing route-group boundaries (e.g. landing → app), not between
 * pages within the same group (where the inner PageTransition handles it).
 */
function getRouteGroup(pathname: string): string {
  const segment = pathname.split('/')[1];
  if (!segment) return 'home';
  return 'app';
}

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
  /**
   * Whether to animate on initial mount.
   * Set `false` when nested inside another PageTransition to avoid double-animation
   * (the outer transition handles the entrance; the inner only animates on subsequent changes).
   */
  animateFirstMount?: boolean;
  /**
   * Key strategy for AnimatePresence.
   * - `'group'` (default): uses the first path segment so transitions only fire between
   *   major route groups (e.g. landing → app), not within the same group.
   * - `'full'`: uses the full pathname so every route change triggers a transition.
   */
  transitionKey?: 'group' | 'full';
}

export default function PageTransition({ children, className, animateFirstMount = true, transitionKey = 'group' }: PageTransitionProps) {
  const pathname = usePathname();

  const animKey = transitionKey === 'full' ? pathname : getRouteGroup(pathname);

  return (
    <AnimatePresence mode="wait" initial={animateFirstMount}>
      <motion.div
        key={animKey}
        variants={pageVariants}
        initial="initial"
        animate="enter"
        exit="exit"
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
