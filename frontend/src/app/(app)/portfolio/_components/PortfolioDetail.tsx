'use client';

import DetailModal from '../../_components/DetailModal';

interface PortfolioDetailProps {
  asset: string | null;
  onClose: () => void;
}

export default function PortfolioDetail({ asset, onClose }: PortfolioDetailProps) {
  return (
    <DetailModal
      open={!!asset}
      onClose={onClose}
      title={asset || ''}
      subtitle="Detailed lot information"
      actions={
        <>
          <button onClick={onClose} className="btn-secondary">Close</button>
          <button className="btn-primary">View Transactions</button>
        </>
      }
    >
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold shadow-lg">
          {(asset || '').slice(0, 2)}
        </div>
      </div>
      {[
        { label: 'Cost Basis Method', value: 'HIFO' },
        { label: 'Total Acquired', value: '$12,450.00' },
        { label: 'Total Sold', value: '$8,320.00' },
        { label: 'Realized Gain/Loss', value: '-$4,130.00', loss: true },
      ].map((row, i) => (
        <div key={i} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
          <span className="text-gray-500">{row.label}</span>
          <span className={`font-semibold ${row.loss ? 'text-emerald-600' : 'text-gray-900'}`}>
            {row.value}
          </span>
        </div>
      ))}
    </DetailModal>
  );
}
