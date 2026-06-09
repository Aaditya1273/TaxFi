import React from 'react';
import { useAccount } from 'wagmi';

const MOCK_ASSETS = [
  { asset: 'ETH', balance: 10.5, cost_basis: 3450, current_price: 2850, value: 29925, pnl: -6300, pnl_pct: -17.4, chain: 'Ethereum', method: 'HIFO' },
  { asset: 'USDC', balance: 25000, cost_basis: 1.0, current_price: 1.0, value: 25000, pnl: 0, pnl_pct: 0, chain: 'Base', method: 'HIFO' },
  { asset: 'UNI', balance: 500, cost_basis: 12.50, current_price: 8.20, value: 4100, pnl: -2150, pnl_pct: -34.4, chain: 'Ethereum', method: 'HIFO' },
  { asset: 'LINK', balance: 200, cost_basis: 14.20, current_price: 16.80, value: 3360, pnl: 520, pnl_pct: 18.3, chain: 'Ethereum', method: 'HIFO' },
  { asset: 'AAVE', balance: 50, cost_basis: 115, current_price: 128, value: 6400, pnl: 650, pnl_pct: 11.3, chain: 'Arbitrum', method: 'HIFO' },
];

export function Portfolio() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return <div className="text-center py-20 text-gray-400">Connect wallet to see your portfolio</div>;
  }

  const totalValue = MOCK_ASSETS.reduce((s, a) => s + a.value, 0);
  const totalPnl = MOCK_ASSETS.reduce((s, a) => s + a.pnl, 0);

  return (
    <div className="space-y-8 animate-slide-in">
      <div>
        <h1 className="text-3xl font-bold text-white">Portfolio</h1>
        <p className="text-gray-400 mt-1">Cost basis method: <strong className="text-taxfi-400">HIFO</strong> (tax-optimal)</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <span className="stat-label">Total Value</span>
          <span className="stat-value">${totalValue.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Realized P&L (YTD)</span>
          <span className={`stat-value ${totalPnl >= 0 ? 'text-harvest' : 'text-loss'}`}>
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString()}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Assets Tracked</span>
          <span className="stat-value">{MOCK_ASSETS.length}</span>
        </div>
      </div>

      {/* Asset Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-sm text-gray-400 font-medium pb-3">Asset</th>
                <th className="text-right text-sm text-gray-400 font-medium pb-3">Balance</th>
                <th className="text-right text-sm text-gray-400 font-medium pb-3">Cost Basis</th>
                <th className="text-right text-sm text-gray-400 font-medium pb-3">Price</th>
                <th className="text-right text-sm text-gray-400 font-medium pb-3">Value</th>
                <th className="text-right text-sm text-gray-400 font-medium pb-3">P&L</th>
                <th className="text-right text-sm text-gray-400 font-medium pb-3">Chain</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_ASSETS.map((asset) => (
                <tr key={asset.asset} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-taxfi-400 to-taxfi-600 flex items-center justify-center text-xs font-bold">
                        {asset.asset.slice(0, 2)}
                      </div>
                      <span className="font-medium text-white">{asset.asset}</span>
                    </div>
                  </td>
                  <td className="text-right text-gray-300 font-mono">{asset.balance.toLocaleString()}</td>
                  <td className="text-right text-gray-300 font-mono">${asset.cost_basis.toFixed(2)}</td>
                  <td className="text-right text-gray-300 font-mono">${asset.current_price.toFixed(2)}</td>
                  <td className="text-right text-white font-medium font-mono">${asset.value.toLocaleString()}</td>
                  <td className="text-right">
                    <span className={`font-medium font-mono ${asset.pnl >= 0 ? 'text-harvest' : 'text-loss'}`}>
                      {asset.pnl >= 0 ? '+' : ''}${asset.pnl.toLocaleString()}
                      <span className="text-xs ml-1">({asset.pnl_pct >= 0 ? '+' : ''}{asset.pnl_pct.toFixed(1)}%)</span>
                    </span>
                  </td>
                  <td className="text-right text-gray-400 text-sm">{asset.chain}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cost Basis Summary */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Cost Basis Method: HIFO</h3>
        <p className="text-sm text-gray-400">
          HIFO (Highest-In-First-Out) sells the lots with the highest cost basis first,
          minimizing your taxable gains. This is the most tax-efficient method for most users.
        </p>
        <div className="grid grid-cols-3 gap-4 mt-4">
          {['FIFO', 'LIFO', 'HIFO'].map((m) => (
            <div
              key={m}
              className={`p-3 rounded-xl text-center cursor-pointer transition-all ${
                m === 'HIFO'
                  ? 'bg-taxfi-500/20 border border-taxfi-500/40 text-taxfi-400'
                  : 'bg-gray-800/50 text-gray-500 hover:bg-gray-800'
              }`}
            >
              {m}
              {m === 'HIFO' && <span className="block text-xs text-harvest mt-1">✅ Optimal</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
