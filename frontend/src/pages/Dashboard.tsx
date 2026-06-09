import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts';

// Mock data for development
const MOCK_PORTFOLIO = {
  total_value: 124_500,
  total_gain_loss: -8_200,
  harvestable_losses: 4_200,
  estimated_savings: 924,
  positions: [
    { asset: 'ETH', amount: 10, cost_basis: 3500, current_price: 2850, pnl: -6500, pnl_pct: -18.6 },
    { asset: 'UNI', amount: 500, cost_basis: 12.50, current_price: 8.20, pnl: -2150, pnl_pct: -34.4 },
    { asset: 'USDC', amount: 25000, cost_basis: 1.0, current_price: 1.0, pnl: 0, pnl_pct: 0 },
    { asset: 'LINK', amount: 200, cost_basis: 14.20, current_price: 16.80, pnl: 520, pnl_pct: 18.3 },
    { asset: 'AAVE', amount: 50, cost_basis: 115, current_price: 128, pnl: 650, pnl_pct: 11.3 },
  ],
  opportunities: [
    { asset: 'ETH', loss: 6500, savings: 1430, priority: 1, reasoning: 'Down 18.6% from cost basis. Short-term loss offsets ST gains.' },
    { asset: 'UNI', loss: 2150, savings: 473, priority: 2, reasoning: 'Down 34.4%. Long-term holding but significant loss.' },
  ],
  recent_activity: [
    { type: 'scan', message: 'Full portfolio scan complete', time: '2 min ago' },
    { type: 'opportunity', message: 'New harvest opportunity: ETH', time: '15 min ago' },
    { type: 'alert', message: 'USDC balance threshold reached', time: '1 hour ago' },
  ],
};

const MOCK_PRICE_HISTORY = [
  { date: 'Jan', value: 3200, portfolio: 145000 },
  { date: 'Feb', value: 3400, portfolio: 152000 },
  { date: 'Mar', value: 3100, portfolio: 138000 },
  { date: 'Apr', value: 2900, portfolio: 128000 },
  { date: 'May', value: 2850, portfolio: 124500 },
];

export function Dashboard() {
  const { isConnected, address } = useAccount();
  const [data] = useState(MOCK_PORTFOLIO);

  const totalSavings = data.opportunities.reduce((s, o) => s + o.savings, 0);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="text-6xl mb-6">🦊</div>
        <h1 className="text-4xl font-bold text-white mb-4">
          Your AI Crypto Tax Agent
        </h1>
        <p className="text-xl text-gray-400 mb-8 max-w-lg">
          Connect your wallet to find tax savings you didn't know existed.
          <span className="block mt-2 text-harvest font-semibold">
            The agent pays for itself.
          </span>
        </p>
        <div className="flex gap-4">
          <div className="px-6 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm">
            🔒 Non-custodial
          </div>
          <div className="px-6 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm">
            ⛽ Gasless
          </div>
          <div className="px-6 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm">
            🧠 AI-powered
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/permissions" className="btn-secondary text-sm">
            🔑 Grant Permission
          </Link>
          <button className="btn-harvest text-sm">
            🔄 Scan Now
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <span className="stat-label">Portfolio Value</span>
          <span className="stat-value">${data.total_value.toLocaleString()}</span>
          <span className="text-sm text-gray-400">Across all chains</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Unrealized P&L</span>
          <span className="stat-value text-loss">-${Math.abs(data.total_gain_loss).toLocaleString()}</span>
          <span className="text-sm text-gray-400">Current market value</span>
        </div>
        <div className="stat-card border-l-4 border-l-harvest">
          <span className="stat-label">Harvestable Losses</span>
          <span className="stat-value text-harvest">${data.harvestable_losses.toLocaleString()}</span>
          <span className="text-sm text-gray-400">
            Est. savings: <strong className="text-white">${totalSavings.toLocaleString()}</strong>
          </span>
        </div>
        <div className="stat-card border-l-4 border-l-taxfi-400">
          <span className="stat-label">Tax Savings Found</span>
          <span className="stat-value text-taxfi-400">${totalSavings.toLocaleString()}</span>
          <span className="text-sm text-gray-400">Agent fee: ${(totalSavings * 0.05).toFixed(0)}</span>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio Value Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Portfolio Value</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={MOCK_PRICE_HISTORY}>
              <defs>
                <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" stroke="#6b7280" />
              <YAxis stroke="#6b7280" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px' }}
                labelStyle={{ color: '#d1d5db' }}
              />
              <Area type="monotone" dataKey="portfolio" stroke="#3b82f6" fill="url(#portfolioGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Position Breakdown */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Positions</h3>
          <div className="space-y-3">
            {data.positions.map((pos) => (
              <div key={pos.asset} className="flex items-center justify-between p-3 rounded-xl bg-gray-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-taxfi-400 to-taxfi-600 flex items-center justify-center text-xs font-bold">
                    {pos.asset.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{pos.asset}</p>
                    <p className="text-xs text-gray-400">{pos.amount} tokens</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">${(pos.amount * pos.current_price).toLocaleString()}</p>
                  <p className={`text-xs font-medium ${pos.pnl >= 0 ? 'text-harvest' : 'text-loss'}`}>
                    {pos.pnl >= 0 ? '+' : ''}{pos.pnl_pct.toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Opportunities & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Harvest Opportunities */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Harvest Opportunities</h3>
            <Link to="/harvest" className="text-sm text-taxfi-400 hover:text-taxfi-300">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {data.opportunities.map((opp, i) => (
              <div key={i} className="opportunity-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-harvest/10 text-harvest text-xs font-medium">
                      PRIORITY {opp.priority}
                    </span>
                    <span className="font-semibold text-white">{opp.asset}</span>
                  </div>
                  <span className="text-loss font-bold">-${opp.loss.toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-400 mb-3">{opp.reasoning}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    Est. savings: <strong className="text-harvest">${opp.savings.toLocaleString()}</strong>
                  </span>
                  <button className="btn-harvest text-sm py-2 px-4">
                    💰 Harvest
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {data.recent_activity.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  item.type === 'opportunity' ? 'bg-harvest' :
                  item.type === 'alert' ? 'bg-yellow-500' : 'bg-taxfi-400'
                }`} />
                <div className="flex-1">
                  <p className="text-sm text-gray-300">{item.message}</p>
                  <p className="text-xs text-gray-500">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
