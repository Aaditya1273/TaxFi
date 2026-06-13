"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: "📊" },
  { path: "/portfolio", label: "Portfolio", icon: "💼" },
  { path: "/harvest", label: "Harvest", icon: "💰" },
  { path: "/reports", label: "Reports", icon: "📋" },
  { path: "/settings", label: "Settings", icon: "⚙️" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-4 lg:p-6 border-b border-emerald-100">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-lg shadow-emerald-500/20">
            T
          </div>
          {(sidebarOpen || mobileSidebarOpen) && (
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900">Tax<span className="text-emerald-500">Fi</span></h1>
              <p className="text-xs text-gray-400 hidden lg:block">
                AI Tax Agent
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 lg:p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            onClick={() => setMobileSidebarOpen(false)}
            className={isActive(item.path) ? "nav-link-active" : "nav-link"}
          >
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            {(sidebarOpen || mobileSidebarOpen) && (
              <span className="truncate">{item.label}</span>
            )}
          </Link>
        ))}
      </nav>

      {/* User section */}
      <div className="p-2 lg:p-4 border-t border-emerald-100">
        <ConnectButton.Custom>
          {({ account, chain, openConnectModal, mounted }) => {
            return (
              <div>
                {!mounted || !account ? (
                  <button
                    onClick={openConnectModal}
                    className="btn-primary w-full text-sm py-2"
                  >
                    {sidebarOpen || mobileSidebarOpen ? "Connect Wallet" : "🔌"}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 lg:gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-emerald-600">
                        {account.displayName?.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    {(sidebarOpen || mobileSidebarOpen) && (
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {account.displayName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {chain?.name || "Connected"}
                        </p>
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

  if (!isConnected) {
    return <main className="min-h-screen bg-gray-50">{children}</main>;
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex ${
          sidebarOpen ? "w-72" : "w-24"
        } transition-all duration-300 bg-white border-r border-emerald-100/80 shadow-lg shadow-emerald-500/5 flex-col flex-shrink-0`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar (overlay) */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          {/* Sidebar panel */}
          <aside className="relative w-72 bg-white border-r border-emerald-100 shadow-xl h-full flex flex-col animate-slide-right">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-40 lg:hidden bg-white/90 backdrop-blur-md border-b border-emerald-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="text-gray-500 hover:text-gray-700 p-1"
          aria-label="Open menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-xs shadow-lg">
            T
          </div>
          <span className="text-gray-900 font-bold text-sm">Tax<span className="text-emerald-500">Fi</span></span>
        </div>
        <div className="w-6" /> {/* Spacer for centering */}
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50 pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
