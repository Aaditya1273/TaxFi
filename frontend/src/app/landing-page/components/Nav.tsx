'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { NAV_LINKS } from '../data';

export default function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);

      // Detect active section
      const sections = ['how-it-works', 'features', 'pricing', 'faq'];
      for (const id of sections.reverse()) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 200) {
          setActiveSection(id);
          return;
        }
      }
      setActiveSection('');
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navClass = scrolled
    ? 'bg-white/85 backdrop-blur-3xl border border-white/60 shadow-2xl shadow-emerald-500/8 scale-[0.96]'
    : 'bg-white/60 backdrop-blur-2xl border border-white/40 shadow-xl shadow-emerald-500/5';

  return (
    <nav
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-700 ${navClass} rounded-full`}
    >
      <div className="max-w-7xl mx-auto px-12 lg:px-16 h-20 flex items-center justify-between gap-8">
        {/* Logo */}
        <a href="#" className="flex items-center group flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 opacity-20 blur-md group-hover:opacity-30 transition-opacity" />
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-sm font-bold text-white shadow-lg">
                T
              </div>
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">
              Tax<span className="text-emerald-500">Fi</span>
            </span>
          </div>
        </a>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-10 lg:gap-14">
          {NAV_LINKS.map((link) => {
            const isActive = activeSection === link.href.replace('#', '');
            return (
              <a
                key={link.href}
                href={link.href}
                className={`group relative text-base font-medium transition-colors duration-300 ${
                  isActive ? 'text-emerald-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {link.label}
                <span className={`absolute -bottom-1 left-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300 ${
                  isActive ? 'w-full' : 'w-0 group-hover:w-full'
                }`} />
              </a>
            );
          })}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <ConnectButton />
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden w-12 h-12 flex items-center justify-center rounded-full hover:bg-gray-100/50 transition-colors"
          aria-label="Toggle menu"
        >
          <div className="w-5 flex flex-col gap-1.5">
            <span className={`block h-0.5 bg-gray-400 rounded-full transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-[5px] bg-emerald-500' : ''}`} />
            <span className={`block h-0.5 bg-gray-400 rounded-full transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 bg-gray-400 rounded-full transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-[5px] bg-emerald-500' : ''}`} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-8 pb-8 flex flex-col gap-2 bg-white/90 backdrop-blur-3xl border-t border-white/60 rounded-b-3xl mt-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="py-3.5 text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium border-b border-gray-100/50 last:border-0"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-2" onClick={() => setMobileOpen(false)}>
            <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
