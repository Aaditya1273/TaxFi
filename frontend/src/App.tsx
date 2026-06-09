import React, { useState } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

// Pages
import { Dashboard } from './pages/Dashboard';
import { PermissionGrant } from './pages/PermissionGrant';
import { Portfolio } from './pages/Portfolio';
import { Harvest } from './pages/Harvest';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/portfolio', label: 'Portfolio', icon: '💼' },
  { path: '/harvest', label: 'Harvest', icon: '💰' },
  { path: '/reports', label: 'Reports', icon: '📋' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

export function App() {
  const { isConnected, address } = useAccount();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-gray-900/50 border-r border-gray-800 flex flex-col`}>
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-taxfi-500 to-harvest flex items-center justify-center text-white font-bold text-lg">
              T
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="text-xl font-bold text-white">TaxFi</h1>
                <p className="text-xs text-gray-500">AI Tax Agent</p>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={isActive ? 'nav-link-active' : 'nav-link'}
              >
                <span className="text-lg">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-gray-800">
          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, mounted }) => {
              return (
                <div>
                  {!mounted || !account ? (
                    <button onClick={openConnectModal} className="btn-primary w-full text-sm">
                      Connect Wallet
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-taxfi-500/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-taxfi-400">
                          {account.displayName?.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      {sidebarOpen && (
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {account.displayName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {chain?.name || 'Connected'}
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
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-grid">
        <div className="max-w-7xl mx-auto p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/permissions" element={<PermissionGrant />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/harvest" element={<Harvest />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
