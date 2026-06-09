import React, { useState } from 'react';
import { useAccount } from 'wagmi';

export function Settings() {
  const { isConnected } = useAccount();
  const [method, setMethod] = useState('HIFO');
  const [autoHarvest, setAutoHarvest] = useState(false);
  const [harvestThreshold, setHarvestThreshold] = useState(500);
  const [chains, setChains] = useState(['Ethereum', 'Base', 'Arbitrum']);

  if (!isConnected) {
    return <div className="text-center py-20 text-gray-400">Connect wallet to manage settings</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-slide-in">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Configure your TaxFi agent</p>
      </div>

      {/* Cost Basis Method */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-2">Cost Basis Method</h3>
        <p className="text-sm text-gray-400 mb-4">
          Determines which lots are sold first when you dispose of an asset.
          <strong className="text-harvest"> HIFO minimizes your taxable gains.</strong>
        </p>
        <div className="grid grid-cols-4 gap-3">
          {[
            { id: 'FIFO', label: 'FIFO', desc: 'First In, First Out' },
            { id: 'LIFO', label: 'LIFO', desc: 'Last In, First Out' },
            { id: 'HIFO', label: 'HIFO', desc: 'Highest Cost First ★' },
            { id: 'ACB', label: 'ACB', desc: 'Average Cost' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id)}
              className={`p-4 rounded-xl text-left transition-all ${
                method === m.id
                  ? 'bg-taxfi-500/20 border-2 border-taxfi-500'
                  : 'bg-gray-800/50 border-2 border-transparent hover:bg-gray-800'
              }`}
            >
              <p className="font-semibold text-white">{m.label}</p>
              <p className="text-xs text-gray-400 mt-1">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Auto-Harvest Settings */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-2">Auto-Harvest</h3>
        <p className="text-sm text-gray-400 mb-4">
          Automatically execute tax loss harvests when opportunities meet your criteria.
        </p>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <span className="text-gray-300">Enable Auto-Harvest</span>
            <button
              onClick={() => setAutoHarvest(!autoHarvest)}
              className={`w-12 h-6 rounded-full transition-all ${
                autoHarvest ? 'bg-harvest' : 'bg-gray-700'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transform transition-transform ${
                autoHarvest ? 'translate-x-6.5 ml-0.5' : 'translate-x-0.5'
              }`} />
            </button>
          </label>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">
              Minimum Harvest Threshold: <strong className="text-white">${harvestThreshold}</strong>
            </label>
            <input
              type="range"
              min={100}
              max={5000}
              step={100}
              value={harvestThreshold}
              onChange={(e) => setHarvestThreshold(Number(e.target.value))}
              className="w-full accent-taxfi-500"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>$100</span>
              <span>$5,000</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chain Selection */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-2">Chains to Monitor</h3>
        <p className="text-sm text-gray-400 mb-4">Select which chains TaxFi should scan.</p>
        <div className="space-y-2">
          {['Ethereum', 'Base', 'Arbitrum', 'Polygon', 'Optimism', 'Solana'].map((chain) => (
            <label key={chain} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/30 cursor-pointer">
              <span className="text-gray-300">{chain}</span>
              <input
                type="checkbox"
                checked={chains.includes(chain)}
                onChange={() => {
                  setChains(prev =>
                    prev.includes(chain)
                      ? prev.filter(c => c !== chain)
                      : [...prev, chain]
                  );
                }}
                className="rounded border-gray-600 bg-gray-800 text-taxfi-500 focus:ring-taxfi-500"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Save */}
      <button className="btn-primary w-full">
        💾 Save Settings
      </button>
    </div>
  );
}
