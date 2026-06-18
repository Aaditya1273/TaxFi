'use client';

interface LiveIndicatorProps {
  connected: boolean;
}

export default function LiveIndicator({ connected }: LiveIndicatorProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-500 ${
        connected
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-gray-100 text-gray-500 border border-gray-200'
      }`}
    >
      <span className="relative flex h-2 w-2">
        {connected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${connected ? 'bg-emerald-500' : 'bg-gray-400'}`} />
      </span>
      {connected ? 'Live' : 'Offline'}
    </div>
  );
}
