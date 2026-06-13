'use client';

import { useEffect, useState } from 'react';

/**
 * ScrollProgress — renders a thin gradient progress bar at the top of the
 * viewport that fills as the user scrolls down the page.
 */
export default function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setProgress(Math.min(scrollPercent, 100));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[3px]">
      <div
        className="h-full rounded-full transition-[width] duration-150 ease-out"
        style={{
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #34d399, #06b6d4, #8b5cf6)',
          boxShadow: '0 0 12px rgba(52, 211, 153, 0.5)',
        }}
      />
    </div>
  );
}
