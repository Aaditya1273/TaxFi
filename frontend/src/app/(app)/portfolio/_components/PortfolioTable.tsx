'use client';

import { usd } from '@/utils/format';

interface Ledger {
  asset: string;
  method: string;
  total_acquired: number;
  total_sold: number;
  realized_gain_loss: number;
}

interface PortfolioTableProps {
  ledgers: Ledger[];
  onSelectAsset: (asset: string) => void;
}

export default function PortfolioTable({ ledgers, onSelectAsset }: PortfolioTableProps) {
  // Filter out ledgers with no meaningful data (undefined asset = malformed backend row)
  const valid = ledgers.filter(
    (l) => l.asset && l.asset !== 'undefined' && (l.total_acquired || l.total_sold || l.realized_gain_loss),
  );

  if (valid.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
        <svg className="w-10 h-10 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-gray-500 font-medium">No portfolio data</p>
        <p className="text-gray-400 text-sm mt-1">Run a scan from the Dashboard to analyse your transactions.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              {['Asset', 'Method', 'Acquired', 'Sold', 'Gain / Loss'].map((h) => (
                <th
                  key={h}
                  className={`px-5 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500 ${
                    h === 'Asset' ? 'text-left' : 'text-right'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {valid.map((ledger, i) => {
              const gl = ledger.realized_gain_loss || 0;
              const ticker = (ledger.asset ?? '??').slice(0, 3).toUpperCase();
              return (
                <tr
                  key={i}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => onSelectAsset(ledger.asset)}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs flex-shrink-0">
                        {ticker.slice(0, 2)}
                      </div>
                      <span className="font-medium text-gray-900">{ledger.asset}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-gray-500 text-xs">
                    {ledger.method || '—'}
                  </td>
                  <td className="px-5 py-4 text-right text-gray-700 font-medium tabular-nums">
                    {usd(ledger.total_acquired || 0)}
                  </td>
                  <td className="px-5 py-4 text-right text-gray-700 font-medium tabular-nums">
                    {usd(ledger.total_sold || 0)}
                  </td>
                  <td className={`px-5 py-4 text-right font-bold tabular-nums ${gl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {gl >= 0 ? '+' : ''}{usd(gl)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
