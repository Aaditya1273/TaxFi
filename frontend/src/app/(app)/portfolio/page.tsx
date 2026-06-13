'use client';

import { useState } from 'react';
import { useTaxFi } from '@/hooks/useTaxFi';
import { useAccount } from 'wagmi';
import { ScrollReveal } from '@/components/ScrollReveal';
import { StatCard } from '@/components/StatCard';
import { TaxChart } from '@/components/TaxChart';
import { MagneticButton } from '@/components/MagneticButton';
import PageHeader from '../_components/PageHeader';
import TabBar from '../_components/TabBar';
import EmptyState from '../_components/EmptyState';
import PortfolioTable from './_components/PortfolioTable';
import PortfolioDetail from './_components/PortfolioDetail';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'lots', label: 'Open Lots' },
];

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { ledgers, runPipeline, isLoading } = useTaxFi();
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const ledgerList = Object.values(ledgers);
  const totalGainLoss = ledgerList.reduce((sum, l) => sum + (l.realized_gain_loss || 0), 0);
  const totalSold = ledgerList.reduce((sum, l) => sum + (l.total_sold || 0), 0);
  const totalAcquired = ledgerList.reduce((sum, l) => sum + (l.total_acquired || 0), 0);

  const performanceData = ledgerList.map((ledger) => ({
    name: ledger.asset,
    value: ledger.realized_gain_loss || 0,
  }));

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">&#128274;</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Portfolio</h2>
        <p className="text-gray-500">Connect your wallet to view your portfolio</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ScrollReveal>
        <PageHeader
          title="Portfolio"
          subtitle="Cost basis tracking and transaction history"
          actions={
            <button onClick={() => runPipeline()} disabled={isLoading} className="btn-primary flex items-center gap-2">
              {isLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Updating...</> : <><span className="text-lg">&#128259;</span> Refresh</>}
            </button>
          }
        />
      </ScrollReveal>

      <ScrollReveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Total Acquisitions" value={`$${totalAcquired.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon="&#128229;" trend={{ value: 15, isPositive: true }} />
          <StatCard label="Total Disposals" value={`$${totalSold.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon="&#128228;" trend={{ value: 8, isPositive: true }} />
          <StatCard label="Net Gain/Loss" value={`$${totalGainLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon="&#128202;" gradient trend={{ value: totalGainLoss >= 0 ? 12 : -5, isPositive: totalGainLoss >= 0 }} />
        </div>
      </ScrollReveal>

      {performanceData.length > 0 && (
        <div className="card-premium">
          <TaxChart data={performanceData} type="bar" dataKey="value" color={totalGainLoss >= 0 ? '#10b981' : '#ef4444'} height={300} />
        </div>
      )}

      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'overview' && (
        <PortfolioTable ledgers={ledgerList} onSelectAsset={setSelectedAsset} />
      )}

      {activeTab === 'lots' && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4 animate-float">&#128211;</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Tax Lot Details</h3>
          <p className="text-gray-500">Detailed tax lot information will appear here after scanning your transactions.</p>
        </div>
      )}

      <PortfolioDetail asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
    </div>
  );
}
