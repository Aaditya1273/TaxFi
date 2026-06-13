'use client';

interface LiveIndicatorProps {
  connected: boolean;
}

export default function LiveIndicator({ connected }: LiveIndicatorProps) {
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
        connected
          ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
          : 'bg-gray-50 border-gray-200 text-gray-500'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}
      />
      {connected ? 'Live' : 'Offline'}
    </div>
  );
}
