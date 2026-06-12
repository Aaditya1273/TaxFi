'use client';

import { useState, useEffect } from 'react';
import { useTaxFi } from '../../../hooks/useTaxFi';
import { useAccount } from 'wagmi';

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { ledgers, runPipeline, isLoading } = useTaxFi();
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'lots'>('overview');

  const ledgerList = Object.values(ledgers);
  const totalGainLoss = ledgerList.reduce((sum, l) => sum + (l.realized_gain_loss || 0), 0);
  const totalSold = ledgerList.reduce((sum, l) => sum + (l.total_sold || 0), 0);
  const totalAcquired = ledgerList.reduce((sum, l) => sum + (l.total_acquired || 0), 0);

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-white mb-4">Portfolio</h2>
        <p className="text-gray-400">Connect your wallet to view your portfolio</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Portfolio</h1>
          <p className="text-gray-400 mt-1">Cost basis tracking and transaction history</p>
        </div>
        <button
          onClick={() => runPipeline()}
          disabled={isLoading}
          className="btn-primary"
        >
          {isLoading ? 'Updating...' : 'Refresh'}
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-sm">Total Acquisitions</p>
          <p className="text-2xl font-bold text-white mt-2">
            ${totalAcquired.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-sm">Total Disposals</p>
          <p className="text-2xl font-bold text-white mt-2">
            ${totalSold.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-sm">Net Gain/Loss</p>
          <p className={`text-2xl font-bold mt-2 ${
            totalGainLoss >= 0 ? 'text-green-400' : 'text-harvest'
          }`}>
            ${totalGainLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-800">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-1 ${
            activeTab === 'overview'
              ? 'text-taxfi-400 border-b-2 border-taxfi-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('lots')}
          className={`pb-3 px-1 ${
            activeTab === 'lots'
              ? 'text-taxfi-400 border-b-2 border-taxfi-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Open Lots
        </button>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="text-left p-4 text-gray-400 font-medium">Asset</th>
                <th className="text-right p-4 text-gray-400 font-medium">Method</th>
                <th className="text-right p-4 text-gray-400 font-medium">Acquired</th>
                <th className="text-right p-4 text-gray-400 font-medium">Sold</th>
                <th className="text-right p-4 text-gray-400 font-medium">Gain/Loss</th>
              </tr>
            </thead>
            <tbody>
              {ledgerList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    No portfolio data yet. Run a scan to analyze your transactions.
                  </td>
                </tr>
              ) : (
                ledgerList.map((ledger, i) => (
                  <tr
                    key={i}
                    className="border-t border-gray-800 hover:bg-gray-800/30 cursor-pointer"
                    onClick={() => setSelectedAsset(ledger.asset)}
                  >
                    <td className="p-4 text-white font-medium">{ledger.asset}</td>
                    <td className="p-4 text-gray-400 text-right">{ledger.method}</td>
                    <td className="p-4 text-gray-300 text-right">
                      ${(ledger.total_acquired || 0).toLocaleString()}
                    </td>
                    <td className="p-4 text-gray-300 text-right">
                      ${(ledger.total_sold || 0).toLocaleString()}
                    </td>
                    <td className={`p-4 text-right ${
                      (ledger.realized_gain_loss || 0) >= 0 ? 'text-green-400' : 'text-harvest'
                    }`}>
                      ${(ledger.realized_gain_loss || 0).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'lots' && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <p className="text-gray-400 text-center py-8">
            Tax lot details will appear here after scanning your transactions.
          </p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-white">{selectedAsset}</h2>
              <button
                onClick={() => setSelectedAsset(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-gray-400">
              Detailed lot information for {selectedAsset} will be displayed here.
            </p>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setSelectedAsset(null)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
