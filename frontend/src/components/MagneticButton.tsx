'use client';

import { useRef, useState, useEffect } from 'react';

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  strength?: number;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
}

export function MagneticButton({ children, className = '', strength = 30, onClick, disabled }: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [transform, setTransform] = useState({ rotateX: 0, rotateY: 0, scale: 1 });
  const animationRef = useRef<number>();

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;
    
    const rotateX = (mouseY / centerY) * strength;
    const rotateY = -(mouseX / centerX) * strength;
    
    setTransform({ rotateX, rotateY, scale: 1.05 });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    
    // Spring back animation
    const animateBack = () => {
      setTransform(prev => {
        const newRotateX = prev.rotateX * 0.8;
        const newRotateY = prev.rotateY * 0.8;
        const newScale = 1 + (prev.scale - 1) * 0.8;
        
        if (Math.abs(newRotateX) < 0.1 && Math.abs(newRotateY) < 0.1) {
          return { rotateX: 0, rotateY: 0, scale: 1 };
        }
        
        animationRef.current = requestAnimationFrame(animateBack);
        return { rotateX: newRotateX, rotateY: newRotateY, scale: newScale };
      });
    };
    
    animateBack();
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  return (
    <button
      ref={ref}
      className={`relative ${className}`}
      style={{
        transform: `perspective(1000px) rotateX(${transform.rotateX}deg) rotateY(${transform.rotateY}deg) scale(${transform.scale})`,
        transformStyle: 'preserve-3d',
        transition: 'transform 0.1s ease-out',
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      disabled={disabled}
    >
      <div 
        className="relative z-10 transition-transform duration-300"
        style={{ transform: isHovered ? 'scale(1.1)' : 'scale(1)' }}
      >
        {children}
      </div>
      
      {/* Glow effect */}
      <div 
        className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 blur-xl transition-all duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          transform: isHovered ? 'scale(1.2)' : 'scale(1)',
        }}
      />
    </button>
  );
}
