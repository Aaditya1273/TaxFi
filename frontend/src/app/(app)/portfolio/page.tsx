'use client';

import { useEffect, useState } from 'react';
import { useTaxFi } from '@/hooks/useTaxFi';
import { useAccount } from 'wagmi';
import { api, Lot } from '@/utils/api';
import { usd } from '@/utils/format';
import { ScrollReveal } from '@/components/ScrollReveal';
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

  // Real open-lots fetch
  const [lots, setLots] = useState<Lot[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [lotsError, setLotsError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    setLotsLoading(true);
    setLotsError(null);
    api
      .getOpenLots(address)
      .then((r) => setLots(r.lots ?? []))
      .catch((e) => setLotsError(e.message ?? 'Failed to load lots'))
      .finally(() => setLotsLoading(false));
  }, [address]);

  const ledgerList = Object.values(ledgers).filter(
    // Remove malformed entries: empty asset name, or absurd values (raw wei)
    (l) => l.asset && l.asset.trim() !== '' && (l.total_acquired || l.total_sold || l.realized_gain_loss)
      && Math.abs(l.total_sold) < 1e15  // anything above 1 quadrillion is raw wei, not USD
  );
  const totalGainLoss = ledgerList.reduce((s, l) => s + (l.realized_gain_loss || 0), 0);
  const totalSold = ledgerList.reduce((s, l) => s + (l.total_sold || 0), 0);
  const totalAcquired = ledgerList.reduce((s, l) => s + (l.total_acquired || 0), 0);

  if (!isConnected) {
    return <EmptyState title="Portfolio" description="Connect your wallet to view your portfolio." />;
  }

  return (
    <div className="space-y-6">
      <ScrollReveal>
        <PageHeader
          title="Portfolio"
          subtitle="Cost basis tracking and transaction history"
          actions={
            <button
              onClick={() => runPipeline()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Updating…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </>
              )}
            </button>
          }
        />
      </ScrollReveal>

      {/* Stats */}
      <ScrollReveal>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Acquisitions', value: usd(totalAcquired) },
            { label: 'Total Disposals',    value: usd(totalSold) },
            {
              label: 'Net Gain / Loss',
              value: `${totalGainLoss >= 0 ? '+' : ''}${usd(totalGainLoss)}`,
              accent: true,
            },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">{s.label}</p>
              <p className={`text-2xl font-bold ${s.accent ? 'text-emerald-600' : 'text-gray-900'}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </ScrollReveal>

      <ScrollReveal>
        <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      </ScrollReveal>

      {activeTab === 'overview' && (
        <ScrollReveal>
          {ledgerList.length === 0 ? (
            <EmptyState
              title="No portfolio data"
              description="Run a scan from the Dashboard to analyse your on-chain transactions and build your cost basis."
            />
          ) : (
            <PortfolioTable ledgers={ledgerList} onSelectAsset={setSelectedAsset} />
          )}
        </ScrollReveal>
      )}

      {activeTab === 'lots' && (
        <ScrollReveal>
          {lotsLoading ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 text-sm">
              Loading lots…
            </div>
          ) : lotsError ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-600 text-sm">
              {lotsError}
            </div>
          ) : lots.length === 0 ? (
            <EmptyState
              title="No open lots"
              description="Open acquisition lots will appear here after scanning your transactions."
            />
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Asset', 'Lot ID', 'Amount', 'Remaining', 'Rate', 'Chain'].map((h) => (
                        <th
                          key={h}
                          className={`px-5 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500 ${h === 'Asset' || h === 'Lot ID' ? 'text-left' : 'text-right'}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lots.map((lot, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-900">{lot.asset}</td>
                        <td className="px-5 py-3 font-mono text-gray-400 text-xs">
                          {lot.lot_id?.slice(0, 8)}…
                        </td>
                        <td className="px-5 py-3 text-right text-gray-700">{lot.amount}</td>
                        <td className="px-5 py-3 text-right text-gray-700">{lot.remaining_amount}</td>
                        <td className="px-5 py-3 text-right text-gray-700">${(lot.rate ?? 0).toFixed(2)}</td>
                        <td className="px-5 py-3 text-right text-gray-500 text-xs">
                          {lot.chain_id?.replace('eip155:', '') ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </ScrollReveal>
      )}

      <PortfolioDetail asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
    </div>
  );
}
