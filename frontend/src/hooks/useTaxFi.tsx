'use client';

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { api, HarvestOpportunity, TaxForms, CostBasisLedger } from '../utils/api';
import { useAccount } from 'wagmi';

export type ScanPhase = 'idle' | 'ingest' | 'classify' | 'basis' | 'detect' | 'done' | 'error';

interface TaxFiState {
  /** true while a scan has been requested and not yet completed */
  isLoading: boolean;
  /** current pipeline phase driven by WS + polling */
  scanPhase: ScanPhase;
  /** number of transactions found in the last scan */
  txCount: number;
  error: string | null;
  opportunities: HarvestOpportunity[];
  taxForms: TaxForms | null;
  ledgers: Record<string, CostBasisLedger>;
  lastScan: string | null;
}

interface TaxFiContextValue extends TaxFiState {
  runPipeline: () => Promise<void>;
  executeHarvest: (index: number) => Promise<boolean>;
  generateForms: (year?: number) => Promise<void>;
  connectWebSocket: () => WebSocket | null;
}

const TaxFiContext = createContext<TaxFiContextValue | null>(null);

// Phase sequence — used to auto-advance when WS events are delayed
const PHASE_SEQ: ScanPhase[] = ['ingest', 'classify', 'basis', 'detect'];

export function TaxFiProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const [state, setState] = useState<TaxFiState>({
    isLoading: false,
    scanPhase: 'idle',
    txCount: 0,
    error: null,
    opportunities: [],
    taxForms: null,
    ledgers: {},
    lastScan: null,
  });

  // Track the phase timer so we can clear it
  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseIdxRef = useRef(0);
  // Track if a scan is still running (used by the status poller)
  const scanningRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : 'An error occurred';
    setState((prev) => ({ ...prev, error: message, isLoading: false, scanPhase: 'error' }));
    scanningRef.current = false;
  }, []);

  // Advance through phases every ~3 s to give visual feedback even without fine-grained WS events
  const startPhaseTimer = useCallback(() => {
    phaseIdxRef.current = 0;
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    phaseTimerRef.current = setInterval(() => {
      phaseIdxRef.current = Math.min(phaseIdxRef.current + 1, PHASE_SEQ.length - 1);
      setState((prev) =>
        prev.isLoading
          ? { ...prev, scanPhase: PHASE_SEQ[phaseIdxRef.current] }
          : prev,
      );
    }, 3000);
  }, []);

  const stopPhaseTimer = useCallback(() => {
    if (phaseTimerRef.current) {
      clearInterval(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
  }, []);

  // Poll /pipeline/status every 4 s while scanning to detect completion
  const startStatusPoll = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      if (!scanningRef.current) {
        clearInterval(pollTimerRef.current!);
        return;
      }
      try {
        const status = await api.getPipelineStatus();
        if (!status.running && scanningRef.current) {
          // Pipeline finished — fetch results
          scanningRef.current = false;
          stopPhaseTimer();
          clearInterval(pollTimerRef.current!);
          const [opps, ledgers] = await Promise.all([
            api.getOpportunities().catch(() => ({ opportunities: [] })),
            api.getLedgers().catch(() => ({ ledgers: {} })),
          ]);
          setState((prev) => ({
            ...prev,
            isLoading: false,
            scanPhase: 'done',
            opportunities: opps.opportunities,
            ledgers: ledgers.ledgers || {},
            lastScan: new Date().toISOString(),
            error: null,
          }));
          // Reset to idle after 2 s so UI clears the progress bar
          setTimeout(() => setState((p) => ({ ...p, scanPhase: 'idle' })), 2000);
        }
      } catch {
        // ignore transient poll errors
      }
    }, 4000);
  }, [stopPhaseTimer]);

  const runPipeline = useCallback(async () => {
    if (!isConnected || !address) {
      setState((prev) => ({ ...prev, error: 'Wallet not connected' }));
      return;
    }
    if (scanningRef.current) return; // already running

    setState((prev) => ({
      ...prev,
      isLoading: true,
      scanPhase: 'ingest',
      error: null,
      txCount: 0,
    }));
    scanningRef.current = true;
    startPhaseTimer();

    try {
      await api.registerUser(address);
      // Fire the pipeline — returns immediately (background task on server)
      await api.runPipeline([address]);
      // Start polling status for completion
      startStatusPoll();
    } catch (error) {
      scanningRef.current = false;
      stopPhaseTimer();
      handleError(error);
    }
  }, [address, isConnected, handleError, startPhaseTimer, stopPhaseTimer, startStatusPoll]);

  const executeHarvest = useCallback(async (index: number): Promise<boolean> => {
    if (!address) return false;
    try {
      const result = await api.executeHarvest(index, address);
      if (result.success) {
        const { opportunities } = await api.getOpportunities();
        setState((prev) => ({ ...prev, opportunities }));
        return true;
      }
      return false;
    } catch (error) {
      handleError(error);
      return false;
    }
  }, [address, handleError]);

  const generateForms = useCallback(async (taxYear?: number) => {
    try {
      const forms = await api.generateForms(taxYear);
      setState((prev) => ({ ...prev, taxForms: forms }));
    } catch (error) {
      handleError(error);
    }
  }, [handleError]);

  const connectWebSocket = useCallback((): WebSocket | null => {
    try {
      const ws = api.connectWebSocket();
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'pipeline_started':
              scanningRef.current = true;
              setState((prev) => ({ ...prev, isLoading: true, scanPhase: 'ingest', error: null }));
              startPhaseTimer();
              break;

            case 'pipeline_completed': {
              scanningRef.current = false;
              stopPhaseTimer();
              const opps = data.data?.opportunities || [];
              const txns = data.data?.total_txns || 0;
              setState((prev) => ({
                ...prev,
                isLoading: false,
                scanPhase: 'done',
                txCount: txns,
                opportunities: opps.length ? opps : prev.opportunities,
                lastScan: data.timestamp || new Date().toISOString(),
                error: null,
              }));
              // Fetch fresh ledgers after scan
              api.getLedgers().then(({ ledgers }) => {
                setState((prev) => ({ ...prev, ledgers: ledgers || {} }));
              }).catch(() => {});
              // Fetch fresh opportunities
              api.getOpportunities().then(({ opportunities }) => {
                setState((prev) => ({ ...prev, opportunities }));
              }).catch(() => {});
              setTimeout(() => setState((p) => ({ ...p, scanPhase: 'idle' })), 2000);
              break;
            }

            case 'pipeline_error':
              scanningRef.current = false;
              stopPhaseTimer();
              setState((prev) => ({
                ...prev,
                isLoading: false,
                scanPhase: 'error',
                error: data.data?.error || 'Pipeline failed',
              }));
              break;

            case 'harvest_executed':
              api.getOpportunities().then(({ opportunities }) => {
                setState((prev) => ({ ...prev, opportunities }));
              }).catch(() => {});
              break;
          }
        } catch {/* parse error */}
      };
      return ws;
    } catch {
      return null;
    }
  }, [startPhaseTimer, stopPhaseTimer]);

  // Initial data fetch on wallet connect
  useEffect(() => {
    if (isConnected && address) {
      Promise.all([
        api.getOpportunities().catch(() => ({ opportunities: [] })),
        api.getLedgers().catch(() => ({ ledgers: {} })),
        api.getPipelineStatus().catch(() => null),
      ]).then(async ([opps, ledgers, status]) => {
        setState((prev) => ({
          ...prev,
          opportunities: opps.opportunities,
          ledgers: ledgers.ledgers || {},
          lastScan: status?.last_scan || prev.lastScan,
          isLoading: status?.running || false,
          scanPhase: status?.running ? 'ingest' : 'idle',
        }));
        // If pipeline is already running (e.g. user refreshed mid-scan), track it
        if (status?.running) {
          scanningRef.current = true;
          startPhaseTimer();
          startStatusPoll();
          return;
        }
        // Auto-register this address if not seen before
        try {
          await api.registerUser(address);
        } catch {/* already registered */}
        // Auto-scan if this address has never been scanned
        if (!status?.last_scan && !scanningRef.current) {
          setState((prev) => ({ ...prev, isLoading: true, scanPhase: 'ingest', error: null }));
          scanningRef.current = true;
          startPhaseTimer();
          await api.runPipeline([address]).catch(() => {});
          startStatusPoll();
        }
      });
    }
  }, [address, isConnected, startPhaseTimer, startStatusPoll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPhaseTimer();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [stopPhaseTimer]);

  return (
    <TaxFiContext.Provider value={{ ...state, runPipeline, executeHarvest, generateForms, connectWebSocket }}>
      {children}
    </TaxFiContext.Provider>
  );
}

export function useTaxFi() {
  const ctx = useContext(TaxFiContext);
  if (!ctx) throw new Error('useTaxFi must be used within a TaxFiProvider');
  return ctx;
}
