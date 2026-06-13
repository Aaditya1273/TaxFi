'use client';

import { useRef, useState, useEffect } from 'react';

interface LiquidButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function LiquidButton({ children, className = '', onClick }: LiquidButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);
  const [transform, setTransform] = useState({ scaleX: 1, scaleY: 1 });
  const [gradientPhase, setGradientPhase] = useState(0);
  const animationRef = useRef<number>();

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;
    
    const scaleX = 1 + (mouseX / centerX) * 0.1;
    const scaleY = 1 - (mouseY / centerY) * 0.1;
    
    setTransform({ scaleX, scaleY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTransform({ scaleX: 1, scaleY: 1 });
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const rippleX = e.clientX - rect.left;
    const rippleY = e.clientY - rect.top;
    
    setRipple({ x: rippleX, y: rippleY, id: Date.now() });
    
    setTimeout(() => setRipple(null), 600);
    
    onClick?.();
  };

  // Animate gradient
  useEffect(() => {
    const animateGradient = () => {
      setGradientPhase(prev => (prev + 2) % 200);
      animationRef.current = requestAnimationFrame(animateGradient);
    };
    
    if (isHovered) {
      animationRef.current = requestAnimationFrame(animateGradient);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isHovered]);

  return (
    <button
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      style={{
        transform: `scale(${transform.scaleX}, ${transform.scaleY})`,
        transition: 'transform 0.1s ease-out',
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Liquid gradient background */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-accent-cobalt-dark via-accent-cobalt to-accent-orchid"
        style={{
          backgroundSize: '200% 200%',
          backgroundPosition: `${gradientPhase}% 50%`,
        }}
      />
      
      {/* Ripple effect */}
      {ripple && (
        <div
          className="absolute rounded-full bg-white/30"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 0,
            height: 0,
            animation: 'ripple 0.6s ease-out forwards',
          }}
        />
      )}
      
      {/* Content */}
      <span
        className="relative z-10 transition-transform duration-300"
        style={{ transform: isHovered ? 'scale(1.05)' : 'scale(1)' }}
      >
        {children}
      </span>
      
      {/* Shine effect */}
      <div
        className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent"
        style={{
          animation: isHovered ? 'shine 0.6s linear infinite' : 'none',
        }}
      />
      
      <style jsx>{`
        @keyframes ripple {
          to {
            width: 300px;
            height: 300px;
            transform: translate(-150px, -150px);
            opacity: 0;
          }
        }
        @keyframes shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </button>
  );
}
