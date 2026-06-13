'use client';

interface FormData {
  transactions?: unknown[];
  title?: string;
}

interface FormCardProps {
  name: string;
  desc: string;
  form?: FormData | null;
  onDownload: () => void;
}

export default function FormCard({ name, desc, form, onDownload }: FormCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm hover:border-emerald-200 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-lg font-bold text-gray-900">{name}</h4>
          <p className="text-gray-500 text-sm">{desc}</p>
        </div>
        <span className="text-2xl">&#128196;</span>
      </div>
      {form && (
        <div className="text-sm text-gray-500 mb-4">
          {form.transactions?.length ? <p>{form.transactions.length} entries</p> : <p>{form.title}</p>}
        </div>
      )}
      <button onClick={onDownload} className="btn-secondary w-full text-sm">
        Download PDF
      </button>
    </div>
  );
}
