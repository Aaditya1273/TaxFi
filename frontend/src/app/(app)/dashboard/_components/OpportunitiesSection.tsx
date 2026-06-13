'use client';

import Link from 'next/link';
import { ParallaxCard } from '@/components/ParallaxCard';
import { Sparkline } from '@/components/Sparkline';

interface Opportunity {
  asset: string;
  quantity: number;
  cost_basis: number;
  unrealized_loss: number;
  estimated_savings: number;
}

interface OpportunitiesSectionProps {
  opportunities: Opportunity[];
  sparklineData?: number[];
}

export default function OpportunitiesSection({
  opportunities,
  sparklineData = [1200, 1900, 1500, 2800, 2200, 3100, 2800, 3500],
}: OpportunitiesSectionProps) {
  if (opportunities.length === 0) return null;

  return (
    <div className="card-premium">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Top Opportunities</h2>
        <Link href="/harvest" className="text-emerald-600 hover:text-emerald-500 transition-colors font-medium">
          View all &rarr;
        </Link>
      </div>
      <div className="space-y-4">
        {opportunities.slice(0, 5).map((opp, i) => (
          <div key={i} className="flex justify-between items-center p-5 bg-gray-50 rounded-2xl border border-gray-100 hover:border-emerald-100 hover:bg-emerald-50/30 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold shadow-lg">
                {opp.asset.slice(0, 2)}
              </div>
              <div>
                <p className="text-gray-900 font-semibold text-lg">{opp.asset}</p>
                <p className="text-gray-500 text-sm">
                  {opp.quantity.toFixed(4)} units &bull; Cost: ${opp.cost_basis.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-emerald-600 font-bold text-xl">-${Math.abs(opp.unrealized_loss).toFixed(2)}</p>
                <p className="text-gray-500 text-sm">Save ~${opp.estimated_savings.toFixed(0)}</p>
              </div>
              <Sparkline data={sparklineData.slice(0, 7)} width={80} height={30} color="#10b981" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
