'use client';

import { useEffect, useRef, useState } from 'react';
import { useTaxFi } from '@/hooks/useTaxFi';
import { useAccount } from 'wagmi';
import { ScrollReveal } from '@/components/ScrollReveal';
import PageHeader from '../_components/PageHeader';
import EmptyState from '../_components/EmptyState';
import LiveIndicator from './_components/LiveIndicator';
import DashboardSkeleton from './_components/DashboardSkeleton';
import QuickActions from './_components/QuickActions';
import OpportunitiesSection from './_components/OpportunitiesSection';
import ScanProgress from './_components/ScanProgress';

function StatCard({
  label,
  value,
  sub,
  accent = false,
  highlight = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-5 border transition-all duration-500 ${
      highlight
        ? 'bg-emerald-50 border-emerald-300 shadow-sm shadow-emerald-100'
        : 'bg-white border-gray-200'
    }`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">{label}</p>
      <p className={`text-2xl font-bold tabular-nums transition-all duration-300 ${accent ? 'text-emerald-600' : 'text-gray-900'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { isLoading, scanPhase, txCount, error, opportunities, lastScan, runPipeline, connectWebSocket } = useTaxFi();
  const [wsConnected, setWsConnected] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Flash "scan complete" state for 3 s after done
  useEffect(() => {
    if (scanPhase === 'done') {
      setJustDone(true);
      const t = setTimeout(() => setJustDone(false), 3000);
      return () => clearTimeout(t);
    }
  }, [scanPhase]);

  useEffect(() => {
    if (isConnected && !wsRef.current) {
      const ws = connectWebSocket();
      if (ws) {
        wsRef.current = ws;
        ws.onopen = () => setWsConnected(true);
        ws.onclose = () => { setWsConnected(false); wsRef.current = null; };
        ws.onerror = () => { setWsConnected(false); wsRef.current = null; };
      }
    }
    return () => { wsRef.current?.close(); wsRef.current = null; };
  }, [isConnected, connectWebSocket]);

  const totalSavings = opportunities.reduce((s, o) => s + (o.estimated_savings || 0), 0);
  const totalLosses = opportunities.reduce((s, o) => s + (o.unrealized_loss || 0), 0);
  const scanning = isLoading || (scanPhase !== 'idle' && scanPhase !== 'done' && scanPhase !== 'error');

  if (!isConnected) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <ScrollReveal>
        <PageHeader
          title="Dashboard"
          subtitle={address ? `${address.slice(0, 6)}…${address.slice(-4)}` : undefined}
          actions={
            <div className="flex gap-3 items-center">
              <LiveIndicator connected={wsConnected} />
              <button
                onClick={() => runPipeline()}
                disabled={scanning}
                className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:cursor-not-allowed ${
                  scanning
                    ? 'bg-emerald-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                }`}
              >
                {scanning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Scanning…
                  </>
                ) : justDone ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Done
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Scan Portfolio
                  </>
                )}
              </button>
            </div>
          }
        />
      </ScrollReveal>

      {/* Scan in progress — shown while backend is running */}
      {scanning && (
        <ScanProgress phase={scanPhase} />
      )}

      {/* Scan complete flash */}
      {justDone && !scanning && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800 animate-fade-in">
          <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            <strong>Scan complete</strong>
            {txCount > 0 && ` — ${txCount} transactions analysed`}
            {opportunities.length > 0
              ? `, ${opportunities.length} harvest ${opportunities.length === 1 ? 'opportunity' : 'opportunities'} found`
              : ', no harvest opportunities right now'}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Stats */}
      <ScrollReveal>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Opportunities" value={opportunities.length} highlight={justDone && opportunities.length > 0} />
          <StatCard
            label="Harvestable Losses"
            value={`$${Math.abs(totalLosses).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            accent
            highlight={justDone && totalLosses < 0}
          />
          <StatCard
            label="Est. Tax Savings"
            value={`$${totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            accent
            highlight={justDone && totalSavings > 0}
          />
          <StatCard
            label="Last Scan"
            value={lastScan ? new Date(lastScan).toLocaleDateString() : '—'}
            sub={lastScan ? new Date(lastScan).toLocaleTimeString() : 'Never scanned'}
            highlight={justDone}
          />
        </div>
      </ScrollReveal>

      {/* First-time empty state */}
      {!lastScan && !scanning && opportunities.length === 0 && (
        <ScrollReveal>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">No data yet</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Click <strong>Scan Portfolio</strong> to pull your on-chain transactions and find tax savings opportunities.
              </p>
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* Quick Actions */}
      <ScrollReveal>
        <QuickActions />
      </ScrollReveal>

      {/* Opportunities list */}
      {opportunities.length > 0 ? (
        <ScrollReveal>
          <OpportunitiesSection opportunities={opportunities} />
        </ScrollReveal>
      ) : (
        lastScan && !scanning && (
          <ScrollReveal>
            <EmptyState
              title="No harvest opportunities found"
              description="Your portfolio has no unrealised losses right now. TaxFi monitors continuously and will alert you when something appears."
            />
          </ScrollReveal>
        )
      )}
    </div>
  );
}
