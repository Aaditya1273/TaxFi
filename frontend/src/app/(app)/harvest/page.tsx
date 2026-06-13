'use client';

import { useState } from 'react';
import { useTaxFi } from '@/hooks/useTaxFi';
import { useAccount } from 'wagmi';
import { useToast } from '@/components/Toast';
import { ScrollReveal } from '@/components/ScrollReveal';
import { StatCard } from '@/components/StatCard';
import PageHeader from '../_components/PageHeader';
import FilterPills from '../_components/FilterPills';
import EmptyState from '../_components/EmptyState';
import HarvestCard from './_components/HarvestCard';

const CHAIN_OPTIONS = [
  { value: 'all', label: 'All Chains' },
  { value: 'eip155:1', label: 'Ethereum' },
  { value: 'eip155:8453', label: 'Base' },
  { value: 'eip155:42161', label: 'Arbitrum' },
];

export default function HarvestPage() {
  const { address, isConnected } = useAccount();
  const { opportunities, executeHarvest, isLoading } = useTaxFi();
  const toast = useToast();
  const [executingIndex, setExecutingIndex] = useState<number | null>(null);
  const [filterChain, setFilterChain] = useState('all');

  const filteredOpps = filterChain === 'all'
    ? opportunities
    : opportunities.filter((o) => o.chain_id === filterChain);

  const totalHarvestable = filteredOpps.reduce((sum, o) => sum + (o.unrealized_loss || 0), 0);
  const totalSavings = filteredOpps.reduce((sum, o) => sum + (o.estimated_savings || 0), 0);

  const handleExecute = async (index: number) => {
    setExecutingIndex(index);
    try {
      const success = await executeHarvest(index);
      if (success) {
        toast.success('Harvest Executed', 'The tax loss harvest was executed successfully.');
      } else {
        toast.error('Harvest Failed', 'Please try again or check your wallet connection.');
      }
    } finally {
      setExecutingIndex(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">&#128274;</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Tax Loss Harvesting</h2>
        <p className="text-gray-500">Connect your wallet to access harvest opportunities</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <ScrollReveal>
        <PageHeader title="Harvest Opportunities" subtitle="Execute tax loss harvesting to reduce your tax bill" />
      </ScrollReveal>

      <ScrollReveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Available Opportunities" value={filteredOpps.length} icon="&#127919;" trend={{ value: 8, isPositive: true }} />
          <StatCard label="Total Harvestable Loss" value={`$${Math.abs(totalHarvestable).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon="&#128176;" gradient />
          <StatCard label="Est. Tax Savings" value={`$${totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon="&#128200;" gradient trend={{ value: 15, isPositive: true }} />
        </div>
      </ScrollReveal>

      <FilterPills options={CHAIN_OPTIONS} selected={filterChain} onSelect={setFilterChain} />

      {filteredOpps.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">&#9989;</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Opportunities Found</h3>
          <p className="text-gray-500">Your portfolio has no positions at a loss. Run a scan from the Dashboard.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredOpps.map((opp, i) => (
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

      {/* Info Box */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-lg">
            ?
          </div>
          <div>
            <h4 className="text-emerald-800 font-bold text-lg mb-3">How Tax Loss Harvesting Works</h4>
            <ul className="text-gray-600 space-y-2">
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1">&bull;</span><span>Sell assets at a loss to realize the loss for tax purposes</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1">&bull;</span><span>Immediately rebuy the same or similar asset to maintain your position</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1">&bull;</span><span>Losses offset capital gains, reducing your tax bill</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1">&bull;</span><span>TaxFi executes gaslessly via 1Shot relayer &mdash; you never need ETH</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1">&bull;</span><span>TaxFi charges 5% of realized tax savings as a fee</span></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
