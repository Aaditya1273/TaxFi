'use client';

import { useEffect, useState } from 'react';
import type { ScanPhase } from '@/hooks/useTaxFi';

const PHASES: { id: ScanPhase; label: string; detail: string }[] = [
  { id: 'ingest',   label: 'Fetching transactions',  detail: 'Pulling on-chain history from Covalent…' },
  { id: 'classify', label: 'Classifying events',     detail: 'Venice AI categorising every transaction…' },
  { id: 'basis',    label: 'Building cost basis',    detail: 'Applying HIFO method across all assets…' },
  { id: 'detect',   label: 'Finding opportunities',  detail: 'Scanning for harvestable tax losses…' },
];

export default function ScanProgress({ phase }: { phase?: ScanPhase | string }) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [dots, setDots] = useState('');

  // Auto-advance if WS phase not provided
  useEffect(() => {
    if (!phase || phase === 'ingest') {
      const t = setInterval(() => {
        setPhaseIdx((i) => Math.min(i + 1, PHASES.length - 1));
      }, 3500);
      return () => clearInterval(t);
    }
  }, [phase]);

  // Sync to WS phase
  useEffect(() => {
    if (phase) {
      const i = PHASES.findIndex((p) => p.id === phase);
      if (i !== -1) setPhaseIdx(i);
    }
  }, [phase]);

  // Trailing dots animation
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 450);
    return () => clearInterval(t);
  }, []);

  const current = PHASES[phaseIdx];
  const pct = Math.round(((phaseIdx + 0.5) / PHASES.length) * 100);

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 overflow-hidden">
      {/* Animated top edge */}
      <div className="h-0.5 bg-emerald-200">
        <div
          className="h-full bg-emerald-500 transition-all duration-700 ease-out relative overflow-hidden"
          style={{ width: `${pct}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-pulse" />
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-white border border-emerald-200 flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-emerald-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            {/* Pulsing badge */}
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white" />
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {current.label}{dots}
            </p>
            <p className="text-xs text-emerald-700 mt-0.5 truncate">{current.detail}</p>
          </div>

          <span className="text-lg font-bold text-emerald-700 tabular-nums flex-shrink-0">{pct}%</span>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-4 gap-2">
          {PHASES.map((p, i) => {
            const done   = i < phaseIdx;
            const active = i === phaseIdx;
            return (
              <div key={p.id} className="flex flex-col items-center gap-1.5">
                {/* Circle */}
                <div className={`relative w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                  done    ? 'bg-emerald-500 text-white'
                  : active ? 'bg-white border-2 border-emerald-500 text-emerald-700'
                           : 'bg-emerald-100 text-emerald-400 border border-emerald-200'
                }`}>
                  {done ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : i + 1}
                  {active && (
                    <span className="absolute -inset-1 rounded-full border border-emerald-400 opacity-50 animate-ping" />
                  )}
                </div>
                {/* Label */}
                <span className={`text-[9px] text-center leading-tight font-medium px-0.5 ${
                  active ? 'text-emerald-700' : done ? 'text-emerald-500' : 'text-emerald-400'
                }`}>
                  {p.label}
                </span>
                {/* Connector line */}
                {i < PHASES.length - 1 && (
                  <div className="absolute" style={{ display: 'none' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Horizontal connector line between steps */}
        <div className="flex items-center gap-0 -mt-2 px-3.5">
          {PHASES.map((_, i) => (
            i < PHASES.length - 1 && (
              <div key={i} className="flex-1 flex items-center">
                <div className={`h-0.5 w-full transition-all duration-700 ${
                  i < phaseIdx ? 'bg-emerald-400' : 'bg-emerald-200'
                }`} />
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}
