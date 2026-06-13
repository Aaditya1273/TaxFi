'use client';

interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export default function DetailModal({ open, onClose, title, subtitle, children, actions }: DetailModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white border border-gray-200 rounded-3xl p-8 max-w-2xl w-full mx-4 animate-scale-in shadow-2xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl transition-colors">
            &#10005;
          </button>
        </div>
        <div className="space-y-4">{children}</div>
        {actions && <div className="mt-8 flex justify-end gap-4">{actions}</div>}
      </div>
    </div>
  );
}
