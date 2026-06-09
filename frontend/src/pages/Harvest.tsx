import React, { useState } from 'react';
import { useAccount } from 'wagmi';

const MOCK_OPPORTUNITIES = [
  {
    id: 1,
    asset: 'ETH',
    token_address: '0x0000000000000000000000000000000000000000',
    quantity: 10,
    cost_basis: 3500,
    current_price: 2850,
    loss: 6500,
    loss_pct: 18.6,
    holding_days: 240,
    is_short_term: true,
    estimated_savings: 1430,
    confidence: 0.92,
    reasoning: 'ETH is down 18.6% from your average entry of $3,500. This is a short-term position (240 days), making the loss more valuable for offsetting short-term gains.',
    recommended_rebuy: 'WETH',
    chain: 'Ethereum',
  },
  {
    id: 2,
    asset: 'UNI',
    token_address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    quantity: 500,
    cost_basis: 12.50,
    current_price: 8.20,
    loss: 2150,
    loss_pct: 34.4,
    holding_days: 480,
    is_short_term: false,
    estimated_savings: 473,
    confidence: 0.78,
    reasoning: 'UNI is down 34.4%. While long-term, the significant loss can offset long-term gains or up to $3,000 of ordinary income.',
    recommended_rebuy: 'AAVE',
    chain: 'Ethereum',
  },
];

const PRICE_CHART_DATA = [
  { month: 'Jan', ETH: 3200, UNI: 14 },
  { month: 'Feb', ETH: 3400, UNI: 13 },
  { month: 'Mar', ETH: 3100, UNI: 11 },
  { month: 'Apr', ETH: 2950, UNI: 9.5 },
  { month: 'May', ETH: 2850, UNI: 8.2 },
];

export function Harvest() {
  const { isConnected } = useAccount();
  const [selectedOpp, setSelectedOpp] = useState<number | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executed, setExecuted] = useState<number[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleHarvest = async (id: number) => {
    setExecuting(true);
    // In production: call the ExecutorAgent through the backend API
    await new Promise(r => setTimeout(r, 2000));
    setExecuted([...executed, id]);
    setExecuting(false);
    setShowConfirm(false);
  };

  if (!isConnected) {
    return <div className="text-center py-20 text-gray-400">Connect wallet to see harvest opportunities</div>;
  }

  // Summary
  const totalLoss = MOCK_OPPORTUNITIES.reduce((s, o) => s + o.loss, 0);
  const totalSavings = MOCK_OPPORTUNITIES.reduce((s, o) => s + o.estimated_savings, 0);

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Tax Loss Harvesting</h1>
        <p className="text-gray-400 mt-1">
          Found <strong className="text-harvest">${totalLoss.toLocaleString()}</strong> in harvestable losses —
          estimated savings: <strong className="text-harvest">${totalSavings.toLocaleString()}</strong>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card border-l-4 border-l-harvest">
          <span className="stat-label">Total Harvestable Loss</span>
          <span className="stat-value text-harvest">${totalLoss.toLocaleString()}</span>
        </div>
        <div className="stat-card border-l-4 border-l-taxfi-400">
          <span className="stat-label">Est. Tax Savings</span>
          <span className="stat-value text-taxfi-400">${totalSavings.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Agent Fee (5%)</span>
          <span className="stat-value text-gray-300">${(totalSavings * 0.05).toFixed(0)}</span>
        </div>
      </div>

      {/* Opportunities List */}
      <div className="space-y-4">
        {MOCK_OPPORTUNITIES.map((opp) => {
          const isExecuted = executed.includes(opp.id);
          const isSelected = selectedOpp === opp.id;

          return (
            <div
              key={opp.id}
              className={`card cursor-pointer transition-all ${
                isSelected ? 'ring-2 ring-harvest' : ''
              } ${isExecuted ? 'opacity-60' : ''}`}
              onClick={() => !isExecuted && setSelectedOpp(opp.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-3 py-1 rounded-full bg-harvest/10 text-harvest text-sm font-medium">
                      {opp.is_short_term ? 'SHORT-TERM' : 'LONG-TERM'}
                    </span>
                    <span className="text-xs text-gray-500">{opp.chain}</span>
                    {isExecuted && (
                      <span className="px-2 py-1 rounded-full bg-harvest/10 text-harvest text-xs font-medium">
                        ✅ HARVESTED
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-yellow-600 flex items-center justify-center text-white font-bold text-lg">
                      {opp.asset.slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{opp.asset}</h3>
                      <p className="text-gray-400">{opp.quantity} tokens</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">Cost Basis</p>
                      <p className="text-sm font-medium text-white">${opp.cost_basis.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Current Price</p>
                      <p className="text-sm font-medium text-white">${opp.current_price.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Loss</p>
                      <p className="text-sm font-medium text-loss">-${opp.loss.toLocaleString()} ({opp.loss_pct}%)</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Savings</p>
                      <p className="text-sm font-medium text-harvest">+${opp.estimated_savings.toLocaleString()}</p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-400 bg-gray-800/30 rounded-lg p-3">
                    {opp.reasoning}
                  </p>

                  {opp.recommended_rebuy && (
                    <p className="text-xs text-gray-500 mt-2">
                      Recommended rebuy: <span className="text-taxfi-400">{opp.recommended_rebuy}</span>
                      (different enough to avoid wash sale)
                    </p>
                  )}
                </div>
              </div>

              {/* Action */}
              {isSelected && !isExecuted && (
                <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-end gap-3">
                  <button
                    className="btn-secondary text-sm"
                    onClick={(e) => { e.stopPropagation(); setSelectedOpp(null); }}
                  >
                    Dismiss
                  </button>
                  <button
                    className="btn-harvest text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowConfirm(true);
                    }}
                    disabled={executing}
                  >
                    {executing ? '⏳ Executing...' : '💰 Harvest Now'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && selectedOpp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Confirm Harvest</h3>
            {(() => {
              const opp = MOCK_OPPORTUNITIES.find(o => o.id === selectedOpp);
              if (!opp) return null;
              return (
                <>
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Selling</span>
                      <span className="text-white font-medium">{opp.quantity} {opp.asset}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Est. Proceeds</span>
                      <span className="text-white font-medium">${(opp.quantity * opp.current_price).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Loss Realized</span>
                      <span className="text-loss font-medium">-${opp.loss.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Tax Saved</span>
                      <span className="text-harvest font-medium">+${opp.estimated_savings.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-gray-700">
                      <span className="text-gray-400">Agent Fee (5%)</span>
                      <span className="text-gray-300 font-medium">${(opp.estimated_savings * 0.05).toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Gas</span>
                      <span className="text-gray-300 font-medium">Paid in USDC ⛽</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button className="btn-secondary flex-1" onClick={() => setShowConfirm(false)}>Cancel</button>
                    <button
                      className="btn-harvest flex-1"
                      onClick={() => handleHarvest(opp.id)}
                      disabled={executing}
                    >
                      {executing ? '⏳ Processing...' : '✅ Confirm & Harvest'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
