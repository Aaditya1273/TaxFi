'use client';

import { Sparkline } from '@/components/Sparkline';

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
  sparklineData?: number[];
}

export default function PortfolioTable({ ledgers, onSelectAsset, sparklineData = [1000, 1500, 1200, 2800, 2200, 3100, 2800, 3500] }: PortfolioTableProps) {
  if (ledgers.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">&#128202;</div>
        <p className="text-gray-500 text-lg">No portfolio data yet. Run a scan to analyze your transactions.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-xs text-gray-500 font-semibold uppercase tracking-wider p-5 text-left">Asset</th>
            <th className="text-xs text-gray-500 font-semibold uppercase tracking-wider p-5 text-right">Method</th>
            <th className="text-xs text-gray-500 font-semibold uppercase tracking-wider p-5 text-right">Acquired</th>
            <th className="text-xs text-gray-500 font-semibold uppercase tracking-wider p-5 text-right">Sold</th>
            <th className="text-xs text-gray-500 font-semibold uppercase tracking-wider p-5 text-right">Gain/Loss</th>
            <th className="text-xs text-gray-500 font-semibold uppercase tracking-wider p-5 text-right">Trend</th>
          </tr>
        </thead>
        <tbody>
          {ledgers.map((ledger, i) => (
            <tr
              key={i}
              className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => onSelectAsset(ledger.asset)}
            >
              <td className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold shadow-md">
                    {ledger.asset.slice(0, 2)}
                  </div>
                  <span className="text-gray-900 font-semibold">{ledger.asset}</span>
                </div>
              </td>
              <td className="p-5 text-gray-500 text-right font-mono text-sm">{ledger.method}</td>
              <td className="p-5 text-gray-700 text-right font-semibold">
                ${(ledger.total_acquired || 0).toLocaleString()}
              </td>
              <td className="p-5 text-gray-700 text-right font-semibold">
                ${(ledger.total_sold || 0).toLocaleString()}
              </td>
              <td className={`p-5 text-right font-bold ${(ledger.realized_gain_loss || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                ${(ledger.realized_gain_loss || 0).toLocaleString()}
              </td>
              <td className="p-5">
                <Sparkline data={sparklineData.slice(0, 8)} width={100} height={30} color={(ledger.realized_gain_loss || 0) >= 0 ? '#10b981' : '#ef4444'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
