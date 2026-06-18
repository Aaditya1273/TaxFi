'use client';

import { useState } from 'react';
import { useTaxFi } from '@/hooks/useTaxFi';
import { useAccount } from 'wagmi';
import { useToast } from '@/components/Toast';
import PageHeader from '../_components/PageHeader';
import EmptyState from '../_components/EmptyState';

const FORMS = [
  { key: 'form_8949', name: 'Form 8949', desc: 'Sales & Dispositions' },
  { key: 'schedule_d', name: 'Schedule D', desc: 'Capital Gains' },
  { key: 'schedule_1', name: 'Schedule 1', desc: 'Additional Income' },
  { key: 'summary', name: 'Summary', desc: 'Plain English' },
];

export default function ReportsPage() {
  const { isConnected } = useAccount();
  const { taxForms, generateForms } = useTaxFi();
  const toast = useToast();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear - 1);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await generateForms(year);
    } catch {
      toast.error('Failed', 'Run a scan first, then generate forms.');
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) return <EmptyState title="Tax Reports" description="Connect your wallet to generate tax reports." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Tax Reports" subtitle="Generate IRS-compliant forms from your on-chain data" />

      {/* Year picker */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Tax Year</p>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }, (_, i) => thisYear - i - 1).map(y => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                year === y ? 'bg-emerald-600 text-white' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:border-emerald-400'
              }`}
            >{y}</button>
          ))}
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading
          ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Generating…</>
          : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> Generate {year} Forms</>
        }
      </button>

      {taxForms ? (
        <div className="space-y-5">
          {/* Numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Net Capital Gain', value: taxForms.summary?.key_numbers?.net_capital_gain ?? '—' },
              { label: 'Other Income',    value: taxForms.summary?.key_numbers?.other_income    ?? '—' },
              { label: 'Est. Tax Owed',  value: taxForms.estimated_tax  != null ? `$${taxForms.estimated_tax.toLocaleString()}`  : '—', accent: true },
              { label: 'TaxFi Saved',    value: taxForms.harvest_savings != null ? `$${taxForms.harvest_savings.toLocaleString()}` : '—', accent: true },
            ].map(item => (
              <div key={item.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                <p className={`text-xl font-bold tabular-nums ${item.accent ? 'text-emerald-600' : 'text-gray-900'}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Form cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {FORMS.map(({ key, name, desc }) => {
              const hasData = !!taxForms.forms?.[key];
              return (
                <div key={key} className={`bg-white border rounded-xl p-4 transition-all ${hasData ? 'border-emerald-200' : 'border-gray-200 opacity-60'}`}>
                  <p className="text-sm font-bold text-gray-900">{name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 mb-4">{desc}</p>
                  <button
                    disabled={!hasData}
                    className="w-full py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Download PDF
                  </button>
                </div>
              );
            })}
          </div>

          {/* Onchain attestation */}
          {taxForms.onchain_hashes && Object.keys(taxForms.onchain_hashes).length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">⛓ Onchain Attestation</p>
              <p className="text-xs text-gray-500 mb-2">Form hashes anchored on-chain via TaxFormAttestor — immutable audit trail.</p>
              {Object.entries(taxForms.onchain_hashes).map(([f, h]) => (
                <p key={f} className="text-xs font-mono text-gray-400 truncate">
                  <span className="text-gray-600">{f}:</span> {String(h)}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : !loading && (
        <EmptyState
          title="No forms yet"
          description={`Select ${year} above and click Generate. You need a completed scan first.`}
        />
      )}
    </div>
  );
}
