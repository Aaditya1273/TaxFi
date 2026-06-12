'use client';

import { useState } from 'react';
import { useTaxFi } from '../../../hooks/useTaxFi';
import { useAccount } from 'wagmi';
import { useToast } from '../../../components/Toast';

export default function ReportsPage() {
  const { address, isConnected } = useAccount();
  const { taxForms, generateForms, isLoading } = useTaxFi();
  const toast = useToast();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear() - 1);
  const [generating, setGenerating] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i - 1);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateForms(selectedYear);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (formType: string) => {
    toast.info('Download Started', `Preparing ${formType} for ${selectedYear}...`);
  };

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-white mb-4">Tax Reports</h2>
        <p className="text-gray-400">Connect your wallet to generate tax reports</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Tax Reports</h1>
          <p className="text-gray-400 mt-1">Generate IRS-compliant tax forms</p>
        </div>
      </div>

      {/* Year Selection */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Select Tax Year</h2>
        <div className="flex flex-wrap gap-3">
          {years.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-6 py-3 rounded-lg font-medium transition ${
                selectedYear === year
                  ? 'bg-taxfi-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
        <p className="text-gray-400 text-sm mt-4">
          Selected tax year: <span className="text-white font-medium">{selectedYear}</span>
        </p>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={generating || isLoading}
        className="btn-primary w-full py-4 text-lg"
      >
        {generating ? 'Generating Forms...' : `Generate ${selectedYear} Tax Forms`}
      </button>

      {/* Generated Forms */}
      {taxForms && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-gradient-to-r from-taxfi-500/20 to-harvest/20 border border-gray-800 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">Tax Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Net Capital Gain</p>
                <p className="text-xl font-bold text-white">
                  ${taxForms.summary?.key_numbers?.net_capital_gain?.replace('$', '') || '0'}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Other Income</p>
                <p className="text-xl font-bold text-white">
                  ${taxForms.summary?.key_numbers?.other_income?.replace('$', '') || '0'}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Estimated Tax Owed</p>
                <p className="text-xl font-bold text-harvest">
                  ${taxForms.estimated_tax?.toLocaleString() || '0'}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">TaxFi Savings</p>
                <p className="text-xl font-bold text-taxfi">
                  ${taxForms.harvest_savings?.toLocaleString() || '0'}
                </p>
              </div>
            </div>
          </div>

          {/* Form Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { key: 'form_8949', name: 'Form 8949', desc: 'Sales & Dispositions' },
              { key: 'schedule_d', name: 'Schedule D', desc: 'Capital Gains' },
              { key: 'schedule_1', name: 'Schedule 1', desc: 'Additional Income' },
              { key: 'summary', name: 'Summary', desc: 'Plain English' },
            ].map(({ key, name, desc }) => {
              const form = taxForms.forms?.[key];
              return (
                <div
                  key={key}
                  className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-bold text-white">{name}</h4>
                      <p className="text-gray-500 text-sm">{desc}</p>
                    </div>
                    <span className="text-2xl">📄</span>
                  </div>
                  {form && (
                    <div className="text-sm text-gray-400 mb-4">
                      {form.transactions?.length || form.transactions ? (
                        <p>{form.transactions?.length || 'Multiple'} entries</p>
                      ) : (
                        <p>{form.title}</p>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => handleDownload(key)}
                    className="btn-secondary w-full text-sm"
                  >
                    Download PDF
                  </button>
                </div>
              );
            })}
          </div>

          {/* Onchain Attestation */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <span className="text-2xl">⛓️</span>
              <div>
                <h4 className="text-blue-400 font-bold mb-2">Onchain Attestation</h4>
                <p className="text-gray-300 text-sm">
                  These forms have been anchored onchain via TaxFormAttestor for an immutable audit trail.
                </p>
                {taxForms.onchain_hashes && (
                  <div className="mt-3 space-y-1">
                    {Object.entries(taxForms.onchain_hashes).map(([form, hash]) => (
                      <p key={form} className="text-xs text-gray-500 font-mono">
                        {form}: {hash?.slice(0, 10)}...
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!taxForms && !generating && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-12 text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-bold text-white mb-2">Generate Your Tax Forms</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Select a tax year above and click generate to create IRS-compliant forms
            (Form 8949, Schedule D, Schedule 1) from your transaction history.
          </p>
        </div>
      )}
    </div>
  );
}
