import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { api, HarvestOpportunity, TaxForms, CostBasisLedger } from '../utils/api';
import { useAccount } from 'wagmi';

interface TaxFiState {
  isLoading: boolean;
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

export function TaxFiProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const [state, setState] = useState<TaxFiState>({
    isLoading: false,
    error: null,
    opportunities: [],
    taxForms: null,
    ledgers: {},
    lastScan: null,
  });

  const handleError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : 'An error occurred';
    setState((prev) => ({ ...prev, error: message, isLoading: false }));
  }, []);

  const runPipeline = useCallback(async () => {
    if (!isConnected || !address) {
      setState((prev) => ({ ...prev, error: 'Wallet not connected' }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      await api.registerUser(address);
      const { success } = await api.runPipeline([address]);
      
      if (success) {
        const { opportunities } = await api.getOpportunities();
        setState((prev) => ({
          ...prev,
          isLoading: false,
          opportunities,
          lastScan: new Date().toISOString(),
        }));
      }
    } catch (error) {
      handleError(error);
    }
  }, [address, isConnected, handleError]);

  const executeHarvest = useCallback(async (index: number): Promise<boolean> => {
    if (!address) return false;

    try {
      const result = await api.executeHarvest(index, address);
      if (result.success) {
        // Refresh opportunities
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
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'pipeline_completed':
            if (data.data.success) {
              setState((prev) => ({
                ...prev,
                lastScan: data.timestamp,
                opportunities: data.data.opportunities || [],
              }));
            }
            break;
          case 'harvest_executed':
            // Refresh opportunities after harvest
            api.getOpportunities().then(({ opportunities }) => {
              setState((prev) => ({ ...prev, opportunities }));
            });
            break;
        }
      };

      return ws;
    } catch {
      return null;
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    if (isConnected && address) {
      api.getOpportunities()
        .then(({ opportunities }) => {
          setState((prev) => ({ ...prev, opportunities }));
        })
        .catch(handleError);
      
      api.getLedgers()
        .then(({ ledgers }) => {
          setState((prev) => ({ ...prev, ledgers: ledgers || {} }));
        })
        .catch(() => {/* Ignore ledger errors */});
    }
  }, [address, isConnected, handleError]);

  return (
    <TaxFiContext.Provider
      value={{
        ...state,
        runPipeline,
        executeHarvest,
        generateForms,
        connectWebSocket,
      }}
    >
      {children}
    </TaxFiContext.Provider>
  );
}

export function useTaxFi() {
  const context = useContext(TaxFiContext);
  if (!context) {
    throw new Error('useTaxFi must be used within a TaxFiProvider');
  }
  return context;
}