'use client';

import { useEffect, useState } from 'react';
import { api, CostBasisLedger } from '@/utils/api';
import DetailModal from '../../_components/DetailModal';

interface PortfolioDetailProps {
  asset: string | null;
  onClose: () => void;
}

export default function PortfolioDetail({ asset, onClose }: PortfolioDetailProps) {
  const [ledger, setLedger] = useState<(CostBasisLedger & { lots: Array<{ lot_id: string; amount: number; remaining: number; rate: number; timestamp: string; tx_hash: string }> }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!asset) { setLedger(null); return; }
    setLoading(true);
    setError(null);
    api.getLedger(asset)
      .then(setLedger)
      .catch((e) => setError(e.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, [asset]);

  return (
    <DetailModal
      open={!!asset}
      onClose={onClose}
      title={asset ?? ''}
      subtitle="Cost basis detail"
      actions={
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          Close
        </button>
      }
    >
      {loading && (
        <div className="py-8 text-center text-gray-400 text-sm">Loading…</div>
      )}
      {error && (
        <div className="py-8 text-center text-red-500 text-sm">{error}</div>
      )}
      {!loading && !error && ledger && (
        <div className="space-y-3">
          {[
            { label: 'Cost Basis Method', value: ledger.method },
            { label: 'Total Acquired', value: `$${(ledger.total_acquired ?? 0).toLocaleString()}` },
            { label: 'Total Sold', value: `$${(ledger.total_sold ?? 0).toLocaleString()}` },
            { label: 'Realized Gain / Loss', value: `${(ledger.realized_gain_loss ?? 0) >= 0 ? '+' : ''}$${(ledger.realized_gain_loss ?? 0).toLocaleString()}` },
            { label: 'Open Lots', value: `${ledger.lot_count ?? 0}` },
          ].map((row, i) => (
            <div key={i} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-500">{row.label}</span>
              <span className="text-sm font-semibold text-gray-900">{row.value}</span>
            </div>
          ))}

          {ledger.lots && ledger.lots.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Open Lots</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {ledger.lots.map((lot, j) => (
                  <div key={j} className="bg-gray-50 rounded-lg px-4 py-3 text-xs flex justify-between">
                    <span className="text-gray-500 font-mono">{lot.lot_id?.slice(0, 8)}…</span>
                    <span className="text-gray-700 font-medium">{lot.remaining ?? lot.amount} remaining</span>
                    <span className="text-gray-500">${(lot.rate ?? 0).toFixed(2)}/unit</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {!loading && !error && !ledger && (
        <p className="py-8 text-center text-gray-400 text-sm">No data available for {asset}.</p>
      )}
    </DetailModal>
  );
}
