'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { NAV_LINKS } from '../data';

export default function Nav() {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCta = () => {
    if (isConnected) {
      window.location.href = '/dashboard';
    } else if (openConnectModal) {
      openConnectModal();
    }
  };

  return (
    <nav
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-700 ${
        scrolled
          ? 'bg-white/80 backdrop-blur-3xl border border-white/60 shadow-2xl shadow-emerald-500/10 scale-95'
          : 'bg-white/60 backdrop-blur-2xl border border-white/40 shadow-xl shadow-emerald-500/5 scale-100'
      } rounded-full`}
    >
      <div className="max-w-7xl mx-auto px-12 h-20 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-sm font-bold text-white shadow-lg">
              T
            </div>
            <span className="text-xl font-bold text-gray-900">
              Tax<span className="text-emerald-500">Fi</span>
            </span>
          </div>
        </a>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-12">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-base text-gray-600 hover:text-gray-900 transition-colors font-medium relative group"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 group-hover:w-full transition-all duration-300 rounded-full" />
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={handleCta}
            className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-base font-semibold rounded-full hover:shadow-xl hover:shadow-emerald-500/30 transition-all active:scale-[0.97] hover:scale-105"
          >
            {isConnected ? 'Dashboard \u2192' : 'Connect Wallet'}
          </button>
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden w-12 h-12 flex items-center justify-center rounded-full hover:bg-gray-100/50 transition-colors"
          aria-label="Toggle menu"
        >
          <div className="w-5 flex flex-col gap-1.5">
            <span
              className={`block h-0.5 bg-gray-400 rounded-full transition-all duration-300 ${
                mobileMenuOpen ? 'rotate-45 translate-y-[5px]' : ''
              }`}
            />
            <span
              className={`block h-0.5 bg-gray-400 rounded-full transition-all duration-300 ${
                mobileMenuOpen ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`block h-0.5 bg-gray-400 rounded-full transition-all duration-300 ${
                mobileMenuOpen ? '-rotate-45 -translate-y-[5px]' : ''
              }`}
            />
          </div>
        </button>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ${
          mobileMenuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-8 pb-8 flex flex-col gap-3 bg-white/80 backdrop-blur-3xl border-t border-white/60 rounded-b-3xl mt-2">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="py-4 text-base text-gray-600 hover:text-gray-900 transition-colors font-medium"
            >
              {link.label}
            </a>
          ))}
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleCta();
            }}
            className="mt-3 px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-base font-semibold rounded-full hover:shadow-xl hover:shadow-emerald-500/30 transition-all text-center"
          >
            {isConnected ? 'Dashboard \u2192' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    </nav>
  );
}
