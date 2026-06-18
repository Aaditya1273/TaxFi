'use client';

import { useState } from 'react';
import { useTaxFi } from '@/hooks/useTaxFi';
import { useAccount } from 'wagmi';
import { useToast } from '@/components/Toast';
import PageHeader from '../_components/PageHeader';
import EmptyState from '../_components/EmptyState';
import HarvestCard from './_components/HarvestCard';

const CHAINS = [
  { value: 'all', label: 'All' },
  { value: 'eip155:1', label: 'Ethereum' },
  { value: 'eip155:8453', label: 'Base' },
  { value: 'eip155:42161', label: 'Arbitrum' },
  { value: 'eip155:11155111', label: 'Sepolia' },
];

export default function HarvestPage() {
  const { isConnected } = useAccount();
  const { opportunities, executeHarvest, lastScan, scanPhase, isLoading } = useTaxFi();
  const toast = useToast();
  const [executingIndex, setExecutingIndex] = useState<number | null>(null);
  const [chain, setChain] = useState('all');
  const scanning = isLoading || (scanPhase !== 'idle' && scanPhase !== 'done' && scanPhase !== 'error');

  const filtered = chain === 'all' ? opportunities : opportunities.filter(o => o.chain_id === chain);
  const totalLoss   = filtered.reduce((s, o) => s + (o.unrealized_loss   || 0), 0);
  const totalSaving = filtered.reduce((s, o) => s + (o.estimated_savings || 0), 0);

  const handleExecute = async (idx: number) => {
    setExecutingIndex(idx);
    try {
      const ok = await executeHarvest(idx);
      if (ok) toast.success('✅ Harvest executed', 'Loss realised. Gas paid via 1Shot — no ETH needed.');
      else    toast.error('Harvest failed', 'Check your wallet connection and try again.');
    } finally {
      setExecutingIndex(null);
    }
  };

  if (!isConnected) return <EmptyState title="Tax Loss Harvesting" description="Connect your wallet to see harvest opportunities." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Harvest" subtitle="Realise losses to reduce your tax bill" />

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Opportunities', value: filtered.length.toString(), mono: false },
          { label: 'Harvestable Loss', value: `$${Math.abs(totalLoss).toLocaleString(undefined,{maximumFractionDigits:0})}`, accent: true },
          { label: 'Est. Tax Saved', value: `$${totalSaving.toLocaleString(undefined,{maximumFractionDigits:0})}`, accent: true },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5">{s.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${s.accent ? 'text-emerald-600' : 'text-gray-900'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Chain filter */}
      <div className="flex gap-2 flex-wrap">
        {CHAINS.map(c => (
          <button
            key={c.value}
            onClick={() => setChain(c.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              chain === c.value
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300'
            }`}
          >{c.label}</button>
        ))}
      </div>

      {/* Scanning notice */}
      {scanning && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          Scanning your portfolio… opportunities will appear when complete.
        </div>
      )}

      {/* Opportunity cards */}
      {filtered.length === 0 && !scanning ? (
        <EmptyState
          title="No harvest opportunities"
          description={lastScan ? "No unrealised losses found for the selected chain." : "Run a scan from the Dashboard first."}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((opp, i) => (
            <HarvestCard
              key={i}
              opportunity={opp}
              index={i}
              onExecute={handleExecute}
              isExecuting={executingIndex === i}
            />
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-3">How it works</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-gray-600">
          {[
            ['1. Identify', 'TaxFi finds assets at a loss vs your cost basis.'],
            ['2. Execute', 'Sell → realise the loss. Gas paid in USDC via 1Shot.'],
            ['3. Save', 'Loss offsets gains. TaxFi takes 5% of tax saved.'],
          ].map(([title, body]) => (
            <div key={title} className="space-y-1">
              <p className="font-semibold text-emerald-800">{title}</p>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
