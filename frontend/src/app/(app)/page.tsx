'use client';

import { useState, useEffect, useRef } from 'react';
import { useTaxFi } from '../../hooks/useTaxFi';
import { useAccount } from 'wagmi';
import Link from 'next/link';

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const {
    isLoading,
    error,
    opportunities,
    lastScan,
    runPipeline,
    connectWebSocket
  } = useTaxFi();

  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (isConnected && !wsRef.current) {
      const ws = connectWebSocket();
      if (ws) {
        wsRef.current = ws;
        ws.onopen = () => setWsConnected(true);
        ws.onclose = () => setWsConnected(false);
        ws.onerror = () => {
          setWsConnected(false);
          wsRef.current = null;
        };
      }
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isConnected, connectWebSocket]);

  const totalSavings = opportunities.reduce((sum, o) => sum + (o.estimated_savings || 0), 0);
  const totalLosses = opportunities.reduce((sum, o) => sum + (o.unrealized_loss || 0), 0);

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-white mb-4">Welcome to TaxFi</h2>
        <p className="text-gray-400">Connect your wallet to get started with tax optimization</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">
            {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
          </p>
        </div>
        <div className="flex gap-3">
          <span className={`px-3 py-1 rounded-full text-sm ${
            wsConnected ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
          }`}>
            {wsConnected ? '● Live' : '○ Offline'}
          </span>
          <button
            onClick={() => runPipeline()}
            disabled={isLoading}
            className="btn-primary"
          >
            {isLoading ? 'Scanning...' : 'Scan Portfolio'}
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-sm">Opportunities Found</p>
          <p className="text-3xl font-bold text-white mt-2">{opportunities.length}</p>
        </div>
        
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-sm">Harvestable Losses</p>
          <p className="text-3xl font-bold text-harvest mt-2">
            ${totalLosses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-sm">Estimated Tax Savings</p>
          <p className="text-3xl font-bold text-taxfi mt-2">
            ${totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-sm">Last Scan</p>
          <p className="text-lg text-white mt-2">
            {lastScan ? new Date(lastScan).toLocaleDateString() : 'Never'}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/harvest" className="bg-gradient-to-br from-harvest/20 to-harvest/5 border border-harvest/30 rounded-xl p-6 hover:border-harvest/50 transition">
          <div className="text-4xl mb-3">💰</div>
          <h3 className="text-xl font-bold text-white">Harvest Losses</h3>
          <p className="text-gray-400 text-sm mt-2">Execute tax loss harvesting on your portfolio</p>
        </Link>
        
        <Link href="/portfolio" className="bg-gradient-to-br from-taxfi-500/20 to-taxfi-500/5 border border-taxfi-500/30 rounded-xl p-6 hover:border-taxfi-500/50 transition">
          <div className="text-4xl mb-3">💼</div>
          <h3 className="text-xl font-bold text-white">View Portfolio</h3>
          <p className="text-gray-400 text-sm mt-2">See your cost basis and transaction history</p>
        </Link>
        
        <Link href="/reports" className="bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/30 rounded-xl p-6 hover:border-blue-500/50 transition">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="text-xl font-bold text-white">Tax Reports</h3>
          <p className="text-gray-400 text-sm mt-2">Generate IRS-compliant tax forms</p>
        </Link>
      </div>

      {/* Recent Opportunities */}
      {opportunities.length > 0 && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Top Opportunities</h2>
          <div className="space-y-3">
            {opportunities.slice(0, 5).map((opp, i) => (
              <div key={i} className="flex justify-between items-center p-4 bg-gray-800/50 rounded-lg">
                <div>
                  <p className="text-white font-medium">{opp.asset}</p>
                  <p className="text-gray-400 text-sm">
                    {opp.quantity.toFixed(4)} units • Cost basis: ${opp.cost_basis.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-harvest font-bold">-${Math.abs(opp.unrealized_loss).toFixed(2)}</p>
                  <p className="text-gray-400 text-sm">
                    Save ~${opp.estimated_savings.toFixed(0)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {opportunities.length > 5 && (
            <Link href="/harvest" className="block text-center text-taxfi-400 mt-4 hover:underline">
              View all {opportunities.length} opportunities →
            </Link>
          )}
        </div>
      )}

      {/* Empty state */}
      {opportunities.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-gray-900/50 border border-gray-800 rounded-xl">
          <p className="text-gray-400 mb-4">No harvest opportunities found yet</p>
          <button onClick={() => runPipeline()} className="btn-primary">
            Scan Portfolio
          </button>
        </div>
      )}
    </div>
  );
}
