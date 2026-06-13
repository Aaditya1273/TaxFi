'use client';

import { useEffect, useRef, useState, Children, isValidElement } from 'react';

interface StaggerRevealProps {
  children: React.ReactNode;
  staggerDelay?: number;
  initialDelay?: number;
  className?: string;
}

/**
 * StaggerReveal — wraps a list of children and assigns stagger animation
 * delays via inline styles so each child fades in sequentially as the
 * group scrolls into view. Works with any layout (grid, flex, etc).
 *
 * IMPORTANT: For grid/flex layouts, pass className with the grid classes
 * directly to StaggerReveal, and pass each item as a direct child:
 *
 *   <StaggerReveal staggerDelay={0.08} className="grid sm:grid-cols-2 gap-6">
 *     <div key={1}><YourCard /></div>
 *     <div key={2}><YourCard /></div>
 *   </StaggerReveal>
 */
export default function StaggerReveal({
  children,
  staggerDelay = 0.07,
  initialDelay = 0,
  className = '',
}: StaggerRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), initialDelay * 1000);
          observer.disconnect();
        }
      },
      { threshold: 0.05 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [initialDelay]);

  return (
    <div ref={ref} className={className}>
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child;
        return (
          <div
            style={{
              transitionDelay: visible ? `${i * staggerDelay}s` : '0s',
            }}
            className={
              'transition-all duration-[0.7s] ease-out ' +
              (visible
                ? 'translate-y-0 opacity-100 scale-100'
                : 'translate-y-8 opacity-0 scale-[0.97]')
            }
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
