'use client';

import { useState } from 'react';
import { useTaxFi } from '@/hooks/useTaxFi';
import { useAccount } from 'wagmi';
import { useToast } from '@/components/Toast';
import { ScrollReveal } from '@/components/ScrollReveal';
import { MagneticButton } from '@/components/MagneticButton';
import PageHeader from '../_components/PageHeader';
import EmptyState from '../_components/EmptyState';
import YearSelector from './_components/YearSelector';
import FormCard from './_components/FormCard';

const FORM_TYPES = [
  { key: 'form_8949', name: 'Form 8949', desc: 'Sales & Dispositions' },
  { key: 'schedule_d', name: 'Schedule D', desc: 'Capital Gains' },
  { key: 'schedule_1', name: 'Schedule 1', desc: 'Additional Income' },
  { key: 'summary', name: 'Summary', desc: 'Plain English' },
];

export default function ReportsPage() {
  const { address, isConnected } = useAccount();
  const { taxForms, generateForms, isLoading } = useTaxFi();
  const toast = useToast();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear() - 1);
  const [generating, setGenerating] = useState(false);

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
        <div className="text-6xl mb-4">&#128274;</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Tax Reports</h2>
        <p className="text-gray-500">Connect your wallet to generate tax reports</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <ScrollReveal>
        <PageHeader title="Tax Reports" subtitle="Generate IRS-compliant tax forms" />
      </ScrollReveal>

      <ScrollReveal>
        <YearSelector selectedYear={selectedYear} onYearChange={setSelectedYear} />
      </ScrollReveal>

      <button onClick={handleGenerate} disabled={generating || isLoading} className="btn-primary w-full py-4 text-lg">
        {generating ? 'Generating Forms...' : `Generate ${selectedYear} Tax Forms`}
      </button>

      {taxForms && (
        <div className="space-y-4 animate-slide-up">
          {/* Summary */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl p-8">
            <h3 className="text-xl font-bold text-emerald-900 mb-6">Tax Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Net Capital Gain', value: `$${taxForms.summary?.key_numbers?.net_capital_gain?.replace('$', '') || '0'}`, color: 'text-gray-900' },
                { label: 'Other Income', value: `$${taxForms.summary?.key_numbers?.other_income?.replace('$', '') || '0'}`, color: 'text-gray-900' },
                { label: 'Estimated Tax Owed', value: `$${taxForms.estimated_tax?.toLocaleString() || '0'}`, color: 'text-emerald-600' },
                { label: 'TaxFi Savings', value: `$${taxForms.harvest_savings?.toLocaleString() || '0'}`, color: 'text-emerald-600' },
              ].map((item, i) => (
                <div key={i}>
                  <p className="text-gray-500 text-sm">{item.label}</p>
                  <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Form Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {FORM_TYPES.map(({ key, name, desc }) => (
              <FormCard
                key={key}
                name={name}
                desc={desc}
                form={taxForms.forms?.[key] || null}
                onDownload={() => handleDownload(key)}
              />
            ))}
          </div>

          {/* Onchain Attestation */}
          {taxForms.onchain_hashes && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8">
              <div className="flex items-start gap-4">
                <span className="text-2xl">&#9917;&#65039;</span>
                <div>
                  <h4 className="text-emerald-800 font-bold mb-2">Onchain Attestation</h4>
                  <p className="text-gray-600 text-sm">These forms have been anchored onchain via TaxFormAttestor for an immutable audit trail.</p>
                  <div className="mt-3 space-y-1">
                    {Object.entries(taxForms.onchain_hashes).map(([form, hash]) => (
                      <p key={form} className="text-xs text-gray-500 font-mono">{form}: {String(hash).slice(0, 10)}...</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!taxForms && !generating && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">&#128211;</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Generate Your Tax Forms</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">Select a tax year above and click generate to create IRS-compliant forms (Form 8949, Schedule D, Schedule 1) from your transaction history.</p>
        </div>
      )}
    </div>
  );
}
