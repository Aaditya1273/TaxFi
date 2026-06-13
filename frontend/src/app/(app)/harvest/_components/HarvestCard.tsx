'use client';

import { Sparkline } from '@/components/Sparkline';

interface Opportunity {
  asset: string;
  quantity: number;
  cost_basis: number;
  current_value: number;
  unrealized_loss: number;
  estimated_savings: number;
  chain_id?: string;
  priority?: string;
}

interface HarvestCardProps {
  opportunity: Opportunity;
  index: number;
  onExecute: (index: number) => void;
  isExecuting: boolean;
  sparklineData?: number[];
}

export default function HarvestCard({
  opportunity: opp,
  index,
  onExecute,
  isExecuting,
  sparklineData = [1000, 1500, 1200, 2800, 2200, 3100, 2800, 3500],
}: HarvestCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-300">
      <div className="flex flex-col lg:flex-row justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg group-hover:scale-110 transition-transform">
              {opp.asset.slice(0, 2)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-2xl font-bold text-gray-900">{opp.asset}</h3>
                <span className="px-3 py-1 rounded-full text-xs font-semibold border border-emerald-200 bg-emerald-50 text-emerald-600">{opp.chain_id?.replace('eip155:', '') || 'ETH'}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${opp.priority === 'high' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                  {opp.priority || 'medium'} priority
                </span>
              </div>
              <div className="flex items-center gap-4">
                <Sparkline data={sparklineData.slice(0, 8)} width={120} height={35} color="#10b981" />
                <span className="text-gray-400 text-sm">24h trend</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Quantity', value: opp.quantity.toFixed(6), color: 'text-gray-900' },
              { label: 'Cost Basis', value: `$${opp.cost_basis.toFixed(2)}`, color: 'text-gray-900' },
              { label: 'Current Value', value: `$${opp.current_value.toFixed(2)}`, color: 'text-gray-900' },
              { label: 'Unrealized Loss', value: `-$${Math.abs(opp.unrealized_loss).toFixed(2)}`, color: 'text-red-600', bg: 'bg-red-50' },
            ].map((col, i) => (
              <div key={i} className={`p-4 ${col.bg || 'bg-gray-50'} rounded-xl`}>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">{col.label}</p>
                <p className={`font-bold text-lg ${col.color}`}>{col.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-4 min-w-[200px]">
          <div className="text-right">
            <p className="text-gray-500 text-sm mb-1">Est. Tax Savings</p>
            <p className="text-4xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">${opp.estimated_savings.toFixed(0)}</p>
          </div>
          <button
            onClick={() => onExecute(index)}
            disabled={isExecuting}
            className="btn-harvest w-full flex items-center justify-center gap-2"
          >
            {isExecuting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <span className="text-lg">&#9889;</span>
                Harvest Now
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
