'use client';

import { useRef, useEffect, type ReactNode } from 'react';

interface ParallaxSectionProps {
  children: ReactNode;
  speed?: number;
  className?: string;
}

export default function ParallaxSection({
  children,
  speed = 0.15,
  className = '',
}: ParallaxSectionProps) {
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bgRef.current;
    if (!el) return;

    const handleScroll = () => {
      const rect = el.getBoundingClientRect();
      const windowH = window.innerHeight;
      const offset = rect.top;
      const progress = (windowH - offset) / (windowH + rect.height);
      const y = (progress - 0.5) * speed * 100;
      el.style.transform = `translateY(${y}px)`;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={bgRef} className="absolute inset-0 will-change-transform" style={{ zIndex: -1 }}>
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-teal-500/5" />
      </div>
      {children}
    </div>
  );
}
