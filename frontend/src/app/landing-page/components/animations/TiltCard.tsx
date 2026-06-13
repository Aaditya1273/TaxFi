'use client';

import { useRef, useCallback, useState } from 'react';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;      // max rotation in degrees (default 6)
  perspective?: number;   // CSS perspective value (default 1000)
  scale?: number;         // hover scale (default 1.02)
  speed?: number;         // transition speed in ms (default 400)
  glare?: boolean;        // show glare effect (default true)
}

/**
 * TiltCard — wraps any card element and applies a 3D perspective tilt
 * that follows the mouse cursor. Includes an optional glare effect.
 *
 * Usage:
 *   <TiltCard>
 *     <div className="card-premium">
 *       ...
 *     </div>
 *   </TiltCard>
 */
export default function TiltCard({
  children,
  className = '',
  maxTilt = 6,
  perspective = 1000,
  scale = 1.02,
  speed = 400,
  glare = true,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [glareStyle, setGlareStyle] = useState<React.CSSProperties>({});
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!ref.current) return;

      const rect = ref.current.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Calculate rotation — map mouse position to tilt angle
      const rotateX = ((y - height / 2) / height) * -maxTilt;
      const rotateY = ((x - width / 2) / width) * maxTilt;

      setStyle({
        transform: `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`,
        transition: 'transform 0.1s ease-out',
      });

      if (glare) {
        // Glare follows the mouse — inverse of the tilt direction
        const glareX = (x / width) * 100;
        const glareY = (y / height) * 100;
        setGlareStyle({
          background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.12) 0%, transparent 60%)`,
        });
      }
    },
    [maxTilt, perspective, scale, glare],
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setStyle({
      transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`,
      transition: `transform ${speed}ms ease-out`,
    });
    setGlareStyle({});
  }, [perspective, speed]);

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{
        perspective: `${perspective}px`,
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Main content */}
      <div
        style={{
          ...style,
          transformStyle: 'preserve-3d',
          willChange: isHovered ? 'transform' : 'auto',
        }}
      >
        {children}
      </div>

      {/* Glare overlay */}
      {glare && (
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none transition-opacity duration-300"
          style={{
            ...glareStyle,
            opacity: isHovered ? 1 : 0,
          }}
        />
      )}
    </div>
  );
}
