'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/portfolio', label: 'Portfolio', icon: '💼' },
  { path: '/harvest', label: 'Harvest', icon: '💰' },
  { path: '/reports', label: 'Reports', icon: '📋' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-4 lg:p-6 border-b border-gray-800">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-taxfi-500 to-harvest flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            T
          </div>
          {(sidebarOpen || mobileSidebarOpen) && (
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white">TaxFi</h1>
              <p className="text-xs text-gray-500 hidden lg:block">AI Tax Agent</p>
            </div>
          )}
        </Link>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => {
          setSidebarOpen(!sidebarOpen);
          setMobileSidebarOpen(false);
        }}
        className="hidden lg:flex items-center justify-center w-full py-2 text-gray-500 hover:text-white hover:bg-gray-800/50 transition-colors"
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <svg
          className={`w-5 h-5 transition-transform duration-200 ${sidebarOpen ? '' : 'rotate-180'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>

      {/* Navigation */}
      <nav className="flex-1 p-2 lg:p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            onClick={() => setMobileSidebarOpen(false)}
            className={isActive(item.path) ? 'nav-link-active' : 'nav-link'}
          >
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            {(sidebarOpen || mobileSidebarOpen) && <span className="truncate">{item.label}</span>}
          </Link>
        ))}
      </nav>

      {/* User section */}
      <div className="p-2 lg:p-4 border-t border-gray-800">
        <ConnectButton.Custom>
          {({ account, chain, openConnectModal, mounted }) => {
            return (
              <div>
                {!mounted || !account ? (
                  <button onClick={openConnectModal} className="btn-primary w-full text-sm py-2">
                    {(sidebarOpen || mobileSidebarOpen) ? 'Connect Wallet' : '🔌'}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 lg:gap-3">
                    <div className="w-8 h-8 rounded-full bg-taxfi-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-taxfi-400">
                        {account.displayName?.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    {(sidebarOpen || mobileSidebarOpen) && (
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {account.displayName}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{chain?.name || 'Connected'}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex ${
          sidebarOpen ? 'w-64' : 'w-20'
        } transition-all duration-300 bg-gray-900/50 border-r border-gray-800 flex-col flex-shrink-0`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar (overlay) */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          {/* Sidebar panel */}
          <aside className="relative w-64 bg-gray-900 border-r border-gray-800 h-full flex flex-col animate-slide-right">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-40 lg:hidden bg-gray-950/90 backdrop-blur-md border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="text-gray-400 hover:text-white p-1"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-taxfi-500 to-harvest flex items-center justify-center text-white font-bold text-xs">
            T
          </div>
          <span className="text-white font-bold text-sm">TaxFi</span>
        </div>
        <div className="w-6" /> {/* Spacer for centering */}
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-grid pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
