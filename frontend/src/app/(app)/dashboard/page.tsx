'use client';

import { useState, useEffect, useRef } from 'react';
import { useTaxFi } from '@/hooks/useTaxFi';
import { useAccount } from 'wagmi';
import { ParallaxCard } from '@/components/ParallaxCard';
import { ScrollReveal } from '@/components/ScrollReveal';
import { TextReveal } from '@/components/TextReveal';
import { StatCard } from '@/components/StatCard';
import { TaxChart } from '@/components/TaxChart';
import { DonutChart } from '@/components/DonutChart';
import { MagneticButton } from '@/components/MagneticButton';
import { ParticleField } from '@/components/ParticleField';
import PageHeader from '../_components/PageHeader';
import EmptyState from '../_components/EmptyState';
import LiveIndicator from './_components/LiveIndicator';
import DashboardSkeleton from './_components/DashboardSkeleton';
import QuickActions from './_components/QuickActions';
import OpportunitiesSection from './_components/OpportunitiesSection';

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { isLoading, error, opportunities, lastScan, runPipeline, connectWebSocket } = useTaxFi();
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (isConnected && !wsRef.current) {
      const ws = connectWebSocket();
      if (ws) {
        wsRef.current = ws;
        ws.onopen = () => setWsConnected(true);
        ws.onclose = () => setWsConnected(false);
        ws.onerror = () => { setWsConnected(false); wsRef.current = null; };
      }
    }
    return () => { wsRef.current?.close(); wsRef.current = null; };
  }, [isConnected, connectWebSocket]);

  const totalSavings = opportunities.reduce((sum, o) => sum + (o.estimated_savings || 0), 0);
  const totalLosses = opportunities.reduce((sum, o) => sum + (o.unrealized_loss || 0), 0);

  const savingsData = [
    { name: 'Jan', savings: 1200 }, { name: 'Feb', savings: 1900 },
    { name: 'Mar', savings: 1500 }, { name: 'Apr', savings: 2800 },
    { name: 'May', savings: 2200 }, { name: 'Jun', savings: totalSavings || 3100 },
  ];
  const portfolioData = [
    { name: 'ETH', value: 45, color: '#627eea' },
    { name: 'BTC', value: 30, color: '#f7931a' },
    { name: 'USDC', value: 15, color: '#2775ca' },
    { name: 'Others', value: 10, color: '#8b5cf6' },
  ];

  if (!isConnected) return null;

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <ScrollReveal>
        <PageHeader
          title="Dashboard"
          subtitle={address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
          actions={
            <div className="flex gap-4 items-center">
              <LiveIndicator connected={wsConnected} />
              <button onClick={() => runPipeline()} disabled={isLoading} className="btn-primary flex items-center gap-2">
                {isLoading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Scanning...</>
                ) : (
                  <><span className="text-lg">&#9889;</span> Scan Portfolio</>
                )}
              </button>
            </div>
          }
        />
      </ScrollReveal>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-600 animate-slide-up">
          {error}
        </div>
      )}

        {/* Stats Grid */}
        <ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ParallaxCard className="stat-card">
              <StatCard label="Opportunities" value={opportunities.length} icon="&#127919;" trend={{ value: 12, isPositive: true }} />
            </ParallaxCard>
            <ParallaxCard className="stat-card">
              <StatCard label="Harvestable Losses" value={`$${Math.abs(totalLosses).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon="&#128176;" gradient />
            </ParallaxCard>
            <ParallaxCard className="stat-card">
              <StatCard label="Est. Tax Savings" value={`$${totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon="&#128200;" gradient trend={{ value: 8, isPositive: true }} />
            </ParallaxCard>
            <ParallaxCard className="stat-card">
              <StatCard label="Last Scan" value={lastScan ? new Date(lastScan).toLocaleDateString() : 'Never'} icon="&#128339;" />
            </ParallaxCard>
          </div>
        </ScrollReveal>

        {/* Charts */}
        <ScrollReveal>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="card-premium">
                <TaxChart data={savingsData} type="area" dataKey="savings" color="#10b981" height={350} />
              </div>
            </div>
            <div className="card-premium">
              <DonutChart data={portfolioData} height={350} innerRadius={70} outerRadius={120} />
            </div>
          </div>
        </ScrollReveal>

        {/* Quick Actions */}
        <ScrollReveal>
          <QuickActions />
        </ScrollReveal>

        {/* Top Opportunities */}
        <ScrollReveal>
          <OpportunitiesSection opportunities={opportunities} />
        </ScrollReveal>

        {/* Empty State */}
        {opportunities.length === 0 && !isLoading && (
          <ScrollReveal>
            <EmptyState
              icon="&#128269;"
              title="No Opportunities Found"
              description="Run a scan to analyze your portfolio for tax savings"
              action={<button onClick={() => runPipeline()} className="btn-primary">Scan Portfolio</button>}
            />
          </ScrollReveal>
        )}

      </div>
  );
}
