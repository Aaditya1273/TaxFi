'use client';

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
}

const CHAIN_LABELS: Record<string, string> = {
  'eip155:1': 'Ethereum',
  'eip155:8453': 'Base',
  'eip155:42161': 'Arbitrum',
};

export default function HarvestCard({ opportunity: opp, index, onExecute, isExecuting }: HarvestCardProps) {
  const chainLabel = opp.chain_id ? (CHAIN_LABELS[opp.chain_id] ?? opp.chain_id.replace('eip155:', 'Chain ')) : 'Ethereum';
  const isHigh = opp.priority === 'high';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 lg:p-6 hover:border-emerald-300 transition-colors">
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Left: asset info + metrics */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm flex-shrink-0">
              {opp.asset.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-gray-900">{opp.asset}</span>
                <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-500 text-xs">
                  {chainLabel}
                </span>
                {isHigh && (
                  <span className="px-2 py-0.5 rounded bg-red-50 text-red-600 text-xs font-medium">
                    High priority
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Quantity</p>
              <p className="text-sm font-semibold text-gray-900">{opp.quantity.toFixed(6)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Cost Basis</p>
              <p className="text-sm font-semibold text-gray-900">${opp.cost_basis.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Current Value</p>
              <p className="text-sm font-semibold text-gray-900">${opp.current_value.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Unrealised Loss</p>
              <p className="text-sm font-bold text-red-600">−${Math.abs(opp.unrealized_loss).toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Right: savings + execute */}
        <div className="flex lg:flex-col items-center lg:items-end justify-between lg:justify-start gap-4 lg:min-w-[160px]">
          <div className="lg:text-right">
            <p className="text-xs text-gray-400 mb-0.5">Est. Tax Savings</p>
            <p className="text-2xl font-bold text-emerald-600">
              ${opp.estimated_savings.toFixed(0)}
            </p>
          </div>

          <button
            onClick={() => onExecute(index)}
            disabled={isExecuting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExecuting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Executing…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Harvest
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
