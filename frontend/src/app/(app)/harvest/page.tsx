'use client';

import { useState } from 'react';
import { useTaxFi } from '../../../hooks/useTaxFi';
import { useAccount } from 'wagmi';
import { useToast } from '../../../components/Toast';

export default function HarvestPage() {
  const { address, isConnected } = useAccount();
  const { opportunities, executeHarvest, isLoading } = useTaxFi();
  const toast = useToast();
  const [executing, setExecuting] = useState<number | null>(null);
  const [filterChain, setFilterChain] = useState<string>('all');

  const filteredOpps = filterChain === 'all'
    ? opportunities
    : opportunities.filter(o => o.chain_id === filterChain);

  const totalHarvestable = filteredOpps.reduce((sum, o) => sum + (o.unrealized_loss || 0), 0);
  const totalSavings = filteredOpps.reduce((sum, o) => sum + (o.estimated_savings || 0), 0);

  const handleExecute = async (index: number) => {
    setExecuting(index);
    try {
      const success = await executeHarvest(index);
      if (!success) {
        toast.error('Harvest Failed', 'Please try again or check your wallet connection.');
      } else {
        toast.success('Harvest Executed', 'The tax loss harvest was executed successfully.');
      }
    } finally {
      setExecuting(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-white mb-4">Tax Loss Harvesting</h2>
        <p className="text-gray-400">Connect your wallet to access harvest opportunities</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Harvest Opportunities</h1>
          <p className="text-gray-400 mt-1">Execute tax loss harvesting to reduce your tax bill</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-sm">Available Opportunities</p>
          <p className="text-3xl font-bold text-white mt-2">{filteredOpps.length}</p>
        </div>
        
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-sm">Total Harvestable Loss</p>
          <p className="text-3xl font-bold text-harvest mt-2">
            ${Math.abs(totalHarvestable).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-sm">Estimated Tax Savings</p>
          <p className="text-3xl font-bold text-taxfi mt-2">
            ${totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'eip155:1', 'eip155:8453', 'eip155:42161'] as const).map((chain) => (
          <button
            key={chain}
            onClick={() => setFilterChain(chain)}
            className={`px-4 py-2 rounded-lg text-sm ${
              filterChain === chain
                ? 'bg-taxfi-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {chain === 'all' ? 'All Chains' : chain.replace('eip155:', '')}
          </button>
        ))}
      </div>

      {/* Opportunities List */}
      {filteredOpps.length === 0 ? (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-12 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-xl font-bold text-white mb-2">No Opportunities Found</h3>
          <p className="text-gray-400">
            Your portfolio has no positions at a loss. Run a scan from the Dashboard.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOpps.map((opp, i) => (
            <div
              key={i}
              className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-white">{opp.asset}</h3>
                    <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
                      {opp.chain_id?.replace('eip155:', '') || 'ETH'}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      opp.priority === 'high' ? 'bg-harvest/20 text-harvest' : 'bg-gray-800 text-gray-400'
                    }`}>
                      {opp.priority || 'medium'} priority
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <p className="text-gray-500 text-xs">Quantity</p>
                      <p className="text-white font-medium">{opp.quantity.toFixed(6)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Cost Basis</p>
                      <p className="text-white font-medium">${opp.cost_basis.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Current Value</p>
                      <p className="text-white font-medium">${opp.current_value.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Unrealized Loss</p>
                      <p className="text-harvest font-bold">-${Math.abs(opp.unrealized_loss).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="text-right ml-6">
                  <p className="text-sm text-gray-400 mb-2">Est. Tax Savings</p>
                  <p className="text-2xl font-bold text-taxfi mb-4">
                    ${opp.estimated_savings.toFixed(0)}
                  </p>
                  <button
                    onClick={() => handleExecute(i)}
                    disabled={executing !== null}
                    className="btn-harvest"
                  >
                    {executing === i ? 'Executing...' : 'Harvest'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-taxfi-500/10 border border-taxfi-500/30 rounded-xl p-6">
        <h4 className="text-taxfi-400 font-bold mb-2">💡 How Tax Loss Harvesting Works</h4>
        <ul className="text-gray-300 space-y-2 text-sm">
          <li>• Sell assets at a loss to realize the loss for tax purposes</li>
          <li>• Immediately rebuy the same or similar asset to maintain your position</li>
          <li>• Losses offset capital gains, reducing your tax bill</li>
          <li>• TaxFi executes gaslessly via 1Shot relayer — you never need ETH</li>
          <li>• TaxFi charges 5% of realized tax savings as a fee</li>
        </ul>
      </div>
    </div>
  );
}
