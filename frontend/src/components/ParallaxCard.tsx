'use client';

import { useRef, useState } from 'react';

interface ParallaxCardProps {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}

export function ParallaxCard({ children, className = '', intensity = 20 }: ParallaxCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [transform, setTransform] = useState({ rotateX: 0, rotateY: 0, scale: 1, translateZ: 0 });
  const animationRef = useRef<number>();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;
    
    const rotateX = (mouseY / centerY) * intensity;
    const rotateY = -(mouseX / centerX) * intensity;
    const scale = 1 + (Math.abs(mouseX) + Math.abs(mouseY)) / (rect.width + rect.height) * 0.05;
    
    setTransform({ rotateX, rotateY, scale, translateZ: 50 });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    
    // Spring back animation
    const animateBack = () => {
      setTransform(prev => {
        const newRotateX = prev.rotateX * 0.85;
        const newRotateY = prev.rotateY * 0.85;
        const newScale = 1 + (prev.scale - 1) * 0.85;
        const newTranslateZ = prev.translateZ * 0.85;
        
        if (Math.abs(newRotateX) < 0.1 && Math.abs(newRotateY) < 0.1) {
          return { rotateX: 0, rotateY: 0, scale: 1, translateZ: 0 };
        }
        
        animationRef.current = requestAnimationFrame(animateBack);
        return { rotateX: newRotateX, rotateY: newRotateY, scale: newScale, translateZ: newTranslateZ };
      });
    };
    
    animateBack();
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{
        transform: `perspective(1000px) rotateX(${transform.rotateX}deg) rotateY(${transform.rotateY}deg) scale(${transform.scale}) translateZ(${transform.translateZ}px)`,
        transformStyle: 'preserve-3d',
        transition: 'transform 0.1s ease-out',
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div 
        className="relative"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {children}
        
        {/* Depth layers */}
        <div 
          className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-3xl transition-opacity duration-300"
          style={{ 
            transform: 'translateZ(20px)',
            opacity: isHovered ? 1 : 0 
          }}
        />
        
        <div 
          className="absolute inset-0 bg-gradient-to-tl from-emerald-500/10 to-transparent rounded-3xl transition-opacity duration-300"
          style={{ 
            transform: 'translateZ(40px)',
            opacity: isHovered ? 1 : 0 
          }}
        />
      </div>
    </div>
  );
}
