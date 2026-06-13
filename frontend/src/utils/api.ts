/**
 * TaxFi API Client
 * Connects frontend to the backend API
 */

export interface User {
  address: string;
  display_name: string;
  chains: string[];
  created_at: string;
}

export interface PipelineResult {
  success: boolean;
  total_txns: number;
  classified: number;
  opportunities: number;
  total_savings: number;
}

export interface HarvestOpportunity {
  id: number;
  asset: string;
  asset_address: string;
  quantity: number;
  cost_basis: number;
  current_value: number;
  unrealized_loss: number;
  estimated_savings: number;
  chain_id: string;
  priority: string;
}

export interface TaxFormEntry {
  title?: string;
  transactions?: unknown[];
  data?: Record<string, unknown>;
}

export interface TaxForms {
  forms: Record<string, TaxFormEntry>;
  summary: {
    title?: string;
    key_numbers?: {
      net_capital_gain?: string;
      other_income?: string;
      [key: string]: string | undefined;
    };
  };
  estimated_tax: number;
  harvest_savings: number;
  onchain_hashes?: Record<string, string>;
}

export interface CostBasisLedger {
  asset: string;
  method: string;
  total_acquired: number;
  total_sold: number;
  realized_gain_loss: number;
  lot_count: number;
}

export interface PipelineStatusResponse {
  running: boolean;
  users_registered: number;
  last_scan: string | null;
}

export interface OpportunitiesResponse {
  opportunities: HarvestOpportunity[];
  count: number;
}

export interface LedgersResponse {
  ledgers: Record<string, CostBasisLedger>;
  method?: string;
}

export interface Lot {
  lot_id: string;
  asset: string;
  amount: number;
  remaining_amount: number;
  rate: number;
  timestamp: number;
  chain_id?: string;
  tx_hash?: string;
}

export interface LotsResponse {
  lots: Lot[];
  count: number;
}

export interface ApiConfig {
  baseUrl: string;
  wsUrl: string;
}

const getDefaultConfig = (): ApiConfig => {
  // In production (Vercel frontend + Render backend), NEXT_PUBLIC_API_URL
  // must be set to the Render backend URL (e.g. https://taxfi-api.onrender.com).
  // In dev mode, it falls back to localhost.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || apiUrl.replace(/^http/, 'ws') || 'ws://localhost:8000';
  return {
    baseUrl: apiUrl,
    wsUrl: wsUrl,
  };
};

class TaxFiApiClient {
  private config: ApiConfig;
  private token: string | null = null;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second base delay

  constructor() {
    this.config = getDefaultConfig();
    this.loadToken();
  }

  private loadToken(): void {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('taxfi_token');
    }
  }

  setToken(token: string): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('taxfi_token', token);
    }
  }

  clearToken(): void {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('taxfi_token');
    }
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    // In production (empty baseUrl), prepend /api so requests go through the nginx proxy.
    // In development (full URL), use the endpoint as-is.
    const path = this.config.baseUrl ? endpoint : `/api${endpoint}`;
    const url = `${this.config.baseUrl}${path}`;

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers: { ...this.getHeaders(), ...options.headers },
      });
    } catch (networkError) {
      // Network error — retry with exponential backoff if we haven't exhausted retries
      if (retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        console.warn(`[api] Network error for ${endpoint}, retry ${retryCount + 1}/${this.maxRetries} after ${delay}ms`, networkError);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request<T>(endpoint, options, retryCount + 1);
      }
      throw new Error(`Network error: ${endpoint} unreachable after ${this.maxRetries} retries`);
    }

    if (!response.ok) {
      // Server-side errors — don't retry 4xx client errors, retry 5xx server errors
      if (response.status >= 500 && retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        console.warn(`[api] Server error ${response.status} for ${endpoint}, retry ${retryCount + 1}/${this.maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request<T>(endpoint, options, retryCount + 1);
      }

      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Health check
  async healthCheck(): Promise<{ status: string; database_connected: boolean }> {
    return this.request('/health');
  }

  // User management
  async registerUser(address: string, displayName = ''): Promise<User> {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify({ address, display_name: displayName }),
    });
  }

  async listUsers(): Promise<{ users: User[]; count: number }> {
    return this.request('/users');
  }

  async getUser(address: string): Promise<User> {
    return this.request(`/users/${address}`);
  }

  async deleteUser(address: string): Promise<{ success: boolean }> {
    return this.request(`/users/${address}`, { method: 'DELETE' });
  }

  // Pipeline operations
  async runPipeline(
    addresses?: string[],
    chains?: string[]
  ): Promise<{ success: boolean; message: string }> {
    const params = new URLSearchParams();
    if (addresses?.length) params.set('addresses', addresses.join(','));
    if (chains?.length) params.set('chains', chains.join(','));
    return this.request(`/pipeline/run?${params}`, { method: 'POST' });
  }

  async getPipelineStatus(): Promise<{
    running: boolean;
    users_registered: number;
    last_scan: string | null;
  }> {
    return this.request('/pipeline/status');
  }

  async getPipelineRuns(address: string, limit = 20): Promise<{
    runs: Array<{
      id: number;
      status: string;
      total_txns: number;
      created_at: string;
      finished_at: string | null;
    }>;
    count: number;
  }> {
    return this.request(`/pipeline/runs?address=${address}&limit=${limit}`);
  }

  // Harvest opportunities
  async getOpportunities(): Promise<{
    opportunities: HarvestOpportunity[];
    count: number;
  }> {
    return this.request('/opportunities');
  }

  async getPendingOpportunities(
    address: string,
    limit = 50
  ): Promise<{ opportunities: HarvestOpportunity[]; count: number }> {
    return this.request(`/opportunities/pending?address=${address}&limit=${limit}`);
  }

  async getExecutedOpportunities(
    address: string,
    limit = 50
  ): Promise<{ opportunities: HarvestOpportunity[]; count: number }> {
    return this.request(`/opportunities/executed?address=${address}&limit=${limit}`);
  }

  async executeHarvest(
    index: number,
    userAddress?: string
  ): Promise<{ success: boolean; tx_hash?: string; error?: string }> {
    return this.request(`/opportunities/${index}/execute`, {
      method: 'POST',
      body: JSON.stringify({ user_address: userAddress }),
    });
  }

  // Tax forms
  async generateForms(taxYear?: number): Promise<TaxForms> {
    return this.request('/forms', {
      method: 'POST',
      body: JSON.stringify({ tax_year: taxYear }),
    });
  }

  // Open lots
  async getOpenLots(address: string): Promise<LotsResponse> {
    return this.request(`/lots?address=${encodeURIComponent(address)}`);
  }

  // Cost basis
  async getLedgers(): Promise<LedgersResponse> {
    return this.request('/ledgers');
  }

  async getLedger(asset: string): Promise<CostBasisLedger & { lots: Array<{
    lot_id: string;
    amount: number;
    remaining: number;
    rate: number;
    timestamp: string;
    tx_hash: string;
  }> }> {
    return this.request(`/ledgers/${asset}`);
  }

  // Continuous mode
  async startContinuous(intervalSeconds = 3600): Promise<{ success: boolean }> {
    return this.request('/continuous/start', {
      method: 'POST',
      body: JSON.stringify({ interval_seconds: intervalSeconds }),
    });
  }

  async stopContinuous(): Promise<{ success: boolean }> {
    return this.request('/continuous/stop', { method: 'POST' });
  }

  // WebSocket connection — only called from browser useEffects
  connectWebSocket(): WebSocket {
    if (this.config.wsUrl) {
      return new WebSocket(`${this.config.wsUrl}/ws`);
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return new WebSocket(`${proto}//${window.location.host}/ws`);
  }
}

// Singleton instance
export const api = new TaxFiApiClient();

// Auth helpers
export function generateDemoToken(address: string): string {
  const payload = {
    sub: address,
    exp: Date.now() + 24 * 60 * 60 * 1000,
    demo: true,
  };
  return btoa(JSON.stringify(payload));
}
