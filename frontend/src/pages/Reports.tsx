import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { Link } from 'react-router-dom';

const MOCK_REPORT = {
  tax_year: 2025,
  short_term_count: 3,
  long_term_count: 2,
  short_term_gain: 650,
  short_term_loss: 0,
  long_term_gain: 2400,
  long_term_loss: 750,
  total_gain: 2300,
  staking_income: 3200,
  airdrop_income: 1500,
  estimated_tax: 1844,
  harvest_savings: 1903,
  onchain_hash: '0x7a8b...c3d2',
};

export function Reports() {
  const { isConnected } = useAccount();
  const [selectedYear, setSelectedYear] = useState('2025');
  const [generating, setGenerating] = useState(false);

  if (!isConnected) {
    return <div className="text-center py-20 text-gray-400">Connect wallet to generate tax reports</div>;
  }

  const handleGenerate = async () => {
    setGenerating(true);
    // In production: call FormGenerator through backend API
    await new Promise(r => setTimeout(r, 3000));
    setGenerating(false);
  };

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Tax Reports</h1>
          <p className="text-gray-400 mt-1">IRS-compliant forms, anchored onchain</p>
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white font-medium"
        >
          <option value="2025">2025</option>
          <option value="2024">2024</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <span className="stat-label">Net Capital Gain</span>
          <span className="stat-value">${MOCK_REPORT.total_gain.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Other Income</span>
          <span className="stat-value">${(MOCK_REPORT.staking_income + MOCK_REPORT.airdrop_income).toLocaleString()}</span>
          <span className="text-xs text-gray-400">Staking + Airdrops</span>
        </div>
        <div className="stat-card border-l-4 border-l-harvest">
          <span className="stat-label">Tax Savings via Harvest</span>
          <span className="stat-value text-harvest">${MOCK_REPORT.harvest_savings.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Estimated Tax Owed</span>
          <span className="stat-value">${MOCK_REPORT.estimated_tax.toLocaleString()}</span>
        </div>
      </div>

      {/* Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form 8949 */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Form 8949</h3>
            <span className="px-3 py-1 rounded-full bg-gray-800 text-xs text-gray-400">IRS-ready</span>
          </div>
          <p className="text-sm text-gray-400 mb-4">Sales and Other Dispositions of Capital Assets</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-800">
              <span className="text-gray-400">Part I: Short-term</span>
              <span className="text-white font-medium">{MOCK_REPORT.short_term_count} transactions</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-800">
              <span className="text-gray-400">Part II: Long-term</span>
              <span className="text-white font-medium">{MOCK_REPORT.long_term_count} transactions</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-400">Onchain Hash</span>
              <span className="text-taxfi-400 font-mono text-xs">{MOCK_REPORT.onchain_hash}</span>
            </div>
          </div>
        </div>

        {/* Schedule D */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Schedule D</h3>
            <span className="px-3 py-1 rounded-full bg-gray-800 text-xs text-gray-400">Summary</span>
          </div>
          <p className="text-sm text-gray-400 mb-4">Capital Gains and Losses</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/50">
              <span className="text-sm text-gray-300">Short-term net</span>
              <span className="text-sm font-medium text-white">${MOCK_REPORT.short_term_gain.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/50">
              <span className="text-sm text-gray-300">Long-term net</span>
              <span className="text-sm font-medium text-white">${MOCK_REPORT.long_term_gain - MOCK_REPORT.long_term_loss}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/50 border border-gray-700">
              <span className="text-sm font-medium text-white">Combined net</span>
              <span className="text-sm font-bold text-white">${MOCK_REPORT.total_gain.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule 1 */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Schedule 1 — Additional Income</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/50">
            <div>
              <span className="text-gray-300">Staking Rewards</span>
              <p className="text-xs text-gray-500">Ordinary income at FMV</p>
            </div>
            <span className="text-white font-medium">${MOCK_REPORT.staking_income.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/50">
            <div>
              <span className="text-gray-300">Airdrop Income</span>
              <p className="text-xs text-gray-500">Ordinary income at FMV</p>
            </div>
            <span className="text-white font-medium">${MOCK_REPORT.airdrop_income.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/50 border border-gray-700">
            <span className="font-medium text-white">Total Other Income</span>
            <span className="font-bold text-white">
              ${(MOCK_REPORT.staking_income + MOCK_REPORT.airdrop_income).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="btn-primary"
        >
          {generating ? '⏳ Generating Forms...' : '📋 Generate Tax Forms'}
        </button>
        <button className="btn-secondary">
          📥 Download CSV
        </button>
        <button className="btn-secondary">
          🔗 View Onchain Attestation
        </button>
      </div>
    </div>
  );
}
