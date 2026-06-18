"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import ConnectGate from "@/components/ConnectGate";

const NAV_ITEMS = [
  { path: "/dashboard",   label: "Dashboard",   icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { path: "/portfolio",   label: "Portfolio",   icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" },
  { path: "/harvest",     label: "Harvest",     icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { path: "/reports",     label: "Reports",     icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { path: "/permissions", label: "Permissions", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
  { path: "/settings",    label: "Settings",    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

function NavIcon({ path }: { path: string }) {
  const item = NAV_ITEMS.find(n => n.path === path);
  if (!item) return null;
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
    </svg>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  if (!isConnected) return <ConnectGate />;

  const isActive = (path: string) => pathname === path;

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-4 lg:p-6 border-b border-emerald-100/60">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 group-hover:scale-105 transition-all duration-300">
            T
          </div>
          {(sidebarOpen || mobileSidebarOpen) && (
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900">Tax<span className="text-emerald-500">Fi</span></h1>
              <p className="text-xs text-gray-400 hidden lg:block">AI Tax Agent</p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 lg:p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <div key={item.path} className="relative">
              <Link
                href={item.path}
                onClick={() => setMobileSidebarOpen(false)}
                className={`group relative flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors duration-200 ${
                  active
                    ? "text-emerald-600 bg-gradient-to-r from-emerald-50 to-white border border-emerald-200/60 shadow-sm"
                    : "text-gray-500 hover:text-emerald-600 hover:bg-emerald-50/50"
                }`}
              >
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={active ? 2 : 1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {(sidebarOpen || mobileSidebarOpen) && (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* User / wallet section */}
      <div className="p-3 lg:p-4 border-t border-gray-200">
        <ConnectButton.Custom>
          {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted: rkMounted }) => {
            const connected = rkMounted && account && chain;
            return (
              <div>
                {connected ? (
                  <div className="space-y-1">
                    {/* Chain pill */}
                    {chain.unsupported ? (
                      <button
                        onClick={openChainModal}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
                      >
                        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                        Wrong network
                      </button>
                    ) : (
                      <button
                        onClick={openChainModal}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        {chain.hasIcon && chain.iconUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={chain.iconUrl} alt={chain.name} className="w-4 h-4 rounded-full flex-shrink-0" />
                        )}
                        {(sidebarOpen || mobileSidebarOpen) && (
                          <span className="text-xs text-gray-500 truncate flex-1 text-left">{chain.name}</span>
                        )}
                        <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}

                    {/* Account row */}
                    <button
                      onClick={openAccountModal}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs flex-shrink-0">
                        {account.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      {(sidebarOpen || mobileSidebarOpen) && (
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {account.displayName}
                          </p>
                          {account.displayBalance && (
                            <p className="text-xs text-gray-400 truncate">{account.displayBalance}</p>
                          )}
                        </div>
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={openConnectModal}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    {(sidebarOpen || mobileSidebarOpen) && 'Connect Wallet'}
                  </button>
                )}
              </div>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </>
  );

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex ${
          sidebarOpen ? "w-64" : "w-20"
        } transition-all duration-200 bg-white border-r border-gray-200 flex-col flex-shrink-0`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar (overlay) */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="relative w-64 bg-white border-r border-gray-200 h-full flex flex-col">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-40 lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
            T
          </div>
          <span className="text-gray-900 font-bold text-sm">TaxFi</span>
        </div>
        <div className="w-9" />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
