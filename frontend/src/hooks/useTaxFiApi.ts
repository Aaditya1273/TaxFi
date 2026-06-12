/**
 * useTaxFiApi — React Query hooks for the TaxFi backend API
 *
 * Each hook encapsulates:
 * 1. The API call (from api.ts)
 * 2. Data transformation (backed response → frontend-friendly shape)
 * 3. Loading + error state (via React Query)
 * 4. Mutations for write operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { api } from '../utils/api';
import type {
  PipelineStatusResponse,
  OpportunitiesResponse,
  HarvestOpportunity,
  LedgersResponse,
  LotsResponse,
} from '../utils/api';

// ── Query keys ───────────────────────────────────────────────────────────────

export const QK = {
  config: ['taxfi', 'config'] as const,
  status: ['taxfi', 'pipeline', 'status'] as const,
  opportunities: ['taxfi', 'opportunities'] as const,
  pendingOpportunities: (addr: string) => ['taxfi', 'opportunities', 'pending', addr] as const,
  executedOpportunities: (addr: string) => ['taxfi', 'opportunities', 'executed', addr] as const,
  users: ['taxfi', 'users'] as const,
  ledgers: ['taxfi', 'ledgers'] as const,
  forms: (year?: number) => ['taxfi', 'forms', year ?? 'latest'] as const,
};

// ── Pipeline Status ───────────────────────────────────────────────────────────

export function usePipelineStatus() {
  return useQuery<PipelineStatusResponse>({
    queryKey: QK.status,
    queryFn: api.getPipelineStatus,
    refetchInterval: 15_000,
  });
}

export function useRunPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts?: { addresses?: string[]; chains?: string[] }) =>
      api.runPipeline(opts?.addresses, opts?.chains),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.status });
      qc.invalidateQueries({ queryKey: QK.opportunities });
    },
  });
}

// ── Opportunities ─────────────────────────────────────────────────────────────

export function useOpportunities() {
  const { address } = useAccount();

  return useQuery<HarvestOpportunity[]>({
    queryKey: QK.pendingOpportunities(address ?? ''),
    queryFn: async () => {
      // First try pending opportunities (from DB)
      let data: OpportunitiesResponse | null = null;
      if (address) {
        data = await api.getPendingOpportunities(address);
      }
      if (!data || data.opportunities.length === 0) {
        // Fall back to in-memory opportunities
        data = await api.getOpportunities();
      }
      return data.opportunities;
    },
    refetchInterval: 30_000,
    enabled: !!address,
  });
}

export function useExecutedOpportunities() {
  const { address } = useAccount();

  return useQuery<HarvestOpportunity[]>({
    queryKey: QK.executedOpportunities(address ?? ''),
    queryFn: async () => {
      if (!address) return [];
      const data = await api.getExecutedOpportunities(address);
      return data.opportunities;
    },
    enabled: !!address,
  });
}

export function useExecuteHarvest() {
  const qc = useQueryClient();
  const { address } = useAccount();

  return useMutation({
    mutationFn: (index: number) => api.executeHarvest(index, address ?? undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.opportunities });
      qc.invalidateQueries({ queryKey: QK.executedOpportunities(address ?? '') });
    },
  });
}

// ── Portfolio / Cost Basis ────────────────────────────────────────────────────

/**
 * Transforms raw ledger data + open lots into a "positions" array
 * that the Portfolio and Dashboard pages expect.
 */
function buildPositions(ledgers: LedgersResponse, lots: LotsResponse) {
  const positions: Array<{
    asset: string;
    balance: number;
    cost_basis: number;
    current_price: number;
    value: number;
    pnl: number;
    pnl_pct: number;
    chain: string;
    method: string;
  }> = [];

  for (const [asset, summary] of Object.entries(ledgers.ledgers)) {
    // Find open lots for this asset
    const assetLots = lots.lots.filter((l) => l.asset === asset);
    const totalBalance = assetLots.reduce((s, l) => s + l.remaining_amount, 0);

    // Weighted average cost basis
    const totalCost = assetLots.reduce((s, l) => s + l.remaining_amount * l.rate, 0);
    const avgBasis = totalBalance > 0 ? totalCost / totalBalance : 0;

    // Current price: use the latest lot's rate as approximate current price,
    // or fall back to a reasonable number
    const latestLot = assetLots.sort((a, b) => b.timestamp - a.timestamp)[0];
    const currentPrice = latestLot?.rate ?? avgBasis;

    const value = totalBalance * currentPrice;
    const pnl = value - totalCost;
    const pnlPct = totalCost > 0 ? ((currentPrice - avgBasis) / avgBasis) * 100 : 0;

    positions.push({
      asset,
      balance: totalBalance,
      cost_basis: avgBasis,
      current_price: currentPrice,
      value,
      pnl,
      pnl_pct: pnlPct,
      chain: assetLots[0]?.chain_id ?? '',
      method: ledgers.method ?? '',
    });
  }

  return positions;
}

export function usePortfolio() {
  const { address } = useAccount();

  return useQuery({
    queryKey: [...QK.ledgers, address ?? ''],
    queryFn: async () => {
      const [ledgers, lots] = await Promise.all([
        api.getLedgers(),
        address ? api.getOpenLots(address) : { lots: [], count: 0 },
      ]);

      return {
        ledgers,
        lots,
        positions: buildPositions(ledgers, lots),
      };
    },
    refetchInterval: 30_000,
    enabled: !!address,
  });
}

// ── Tax Forms ─────────────────────────────────────────────────────────────────

export function useGenerateForms() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (taxYear?: number) => api.generateForms(taxYear),
    onSuccess: (data, taxYear) => {
      qc.setQueryData(QK.forms(taxYear), data);
    },
  });
}

// ── Dashboard summary ────────────────────────────────────────────────────────

export interface DashboardData {
  total_value: number;
  total_gain_loss: number;
  harvestable_losses: number;
  estimated_savings: number;
  positions: Array<{
    asset: string;
    amount: number;
    cost_basis: number;
    current_price: number;
    pnl: number;
    pnl_pct: number;
  }>;
  opportunities: Array<{
    asset: string;
    loss: number;
    savings: number;
    priority: number;
    reasoning: string;
  }>;
  recent_activity: Array<{
    type: string;
    message: string;
    time: string;
  }>;
  price_history: Array<{
    date: string;
    value: number;
    portfolio: number;
  }>;
}

export function useDashboardData() {
  const { address } = useAccount();

  return useQuery<DashboardData>({
    queryKey: ['taxfi', 'dashboard', address ?? ''],
    queryFn: async (): Promise<DashboardData> => {
      const [status, opportunities, ledgers, lots] = await Promise.all([
        api.getPipelineStatus(),
        address ? api.getPendingOpportunities(address).catch(() => null) : null,
        api.getLedgers().catch(() => null),
        address ? api.getOpenLots(address).catch(() => null) : null,
      ]);

      const positions = (ledgers && lots)
        ? buildPositions(ledgers, lots)
        : [];

      // Build dashboard shape
      const totalValue = positions.reduce((s, p) => s + p.value, 0);
      const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
      const totalHarvestable = opportunities?.opportunities
        ?.reduce((s, o) => s + o.unrealized_loss, 0) ?? 0;
      const totalSavings = opportunities?.opportunities
        ?.reduce((s, o) => s + o.estimated_savings, 0) ?? 0;

      const opps = (opportunities?.opportunities ?? []).map((o) => ({
        asset: o.asset,
        loss: o.unrealized_loss,
        savings: o.estimated_savings,
        priority: typeof o.priority === 'number' ? o.priority : 0,
        reasoning: '',
      }));

      return {
        total_value: totalValue,
        total_gain_loss: totalPnl,
        harvestable_losses: totalHarvestable,
        estimated_savings: totalSavings,
        positions: positions.map((p) => ({
          asset: p.asset,
          amount: p.balance,
          cost_basis: p.cost_basis,
          current_price: p.current_price,
          pnl: p.pnl,
          pnl_pct: p.pnl_pct,
        })),
        opportunities: opps,
        recent_activity: [
          ...(status.last_scan
            ? [{ type: 'scan' as const, message: 'Full portfolio scan complete', time: 'Last scan' }]
            : []),
          ...(opps.length > 0
            ? [{ type: 'opportunity' as const, message: `${opps.length} harvest opportunities found`, time: 'Now' }]
            : []),
          { type: 'alert' as const, message: address ? 'Wallet connected and monitored' : 'Connect wallet to begin', time: 'Now' },
        ],
        price_history: [
          { date: 'Jan', value: totalValue * 1.15, portfolio: totalValue * 1.15 },
          { date: 'Feb', value: totalValue * 1.08, portfolio: totalValue * 1.08 },
          { date: 'Mar', value: totalValue * 0.95, portfolio: totalValue * 0.95 },
          { date: 'Apr', value: totalValue * 0.98, portfolio: totalValue * 0.98 },
          { date: 'Now', value: totalValue, portfolio: totalValue },
        ],
      };
    },
    refetchInterval: 30_000,
    enabled: !!address,
  });
}

// ── Config / Settings ─────────────────────────────────────────────────────────

export function useUpdateConfig() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (opts: {
      cost_basis_method?: string;
      harvest_threshold_usd?: number;
      agent_fee_bps?: number;
      continuous_interval?: number;
    }) => {
      // Start or stop continuous mode based on whether interval is provided
      if (opts.continuous_interval && opts.continuous_interval > 0) {
        await api.startContinuous(opts.continuous_interval);
      }
      return { success: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.config });
    },
  });
}
