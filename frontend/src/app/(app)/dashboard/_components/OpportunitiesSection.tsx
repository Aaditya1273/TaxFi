'use client';

import Link from 'next/link';

interface Opportunity {
  asset: string;
  quantity: number;
  cost_basis: number;
  unrealized_loss: number;
  estimated_savings: number;
}

interface OpportunitiesSectionProps {
  opportunities: Opportunity[];
}

export default function OpportunitiesSection({ opportunities }: OpportunitiesSectionProps) {
  if (opportunities.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500">
          Top Opportunities
        </h3>
        <Link href="/harvest" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 transition-colors">
          View all
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
        {opportunities.slice(0, 5).map((opp, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm flex-shrink-0">
                {opp.asset.slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{opp.asset}</p>
                <p className="text-xs text-gray-400">
                  {opp.quantity.toFixed(4)} units · cost ${opp.cost_basis.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-4">
              <p className="text-sm font-bold text-red-600">
                −${Math.abs(opp.unrealized_loss).toFixed(2)}
              </p>
              <p className="text-xs text-gray-400">
                save ~${opp.estimated_savings.toFixed(0)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
