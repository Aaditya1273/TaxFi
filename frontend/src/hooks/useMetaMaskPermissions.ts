/**
 * useMetaMaskPermissions — React Hook
 *
 * Manages ERC-7715 Advanced Permissions via the MetaMask Smart Accounts Kit.
 *
 * IMPORTANT DESIGN NOTE:
 * ERC-7715 does NOT have a "read-only" permission type. Read-only access
 * to the user's addresses and transaction data is already available through
 * the Wagmi wallet connection — the connected wallet exposes the user's
 * address, and we can query on-chain data through public RPC endpoints.
 *
 * ERC-7715 is only needed for the HARVEST EXECUTION permission, where the
 * user explicitly delegates authority for the TaxFi agent to execute
 * token swaps (ERC-20 periodic spend) on their behalf.
 *
 * Flows:
 * 1. Read access → handled by Wagmi/RainbowKit connection + public RPC
 * 2. Harvest execution → requires ERC-7715 `requestExecutionPermissions`
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, useChainId } from 'wagmi';
import {
  createWalletClient,
  custom,
  type WalletClient,
  type Hex,
} from 'viem';
import {
  mainnet,
  base,
  arbitrum,
  baseSepolia,
  sepolia,
  type Chain,
} from 'viem/chains';

import type { Address } from 'viem';
import type { PermissionRequest, GrantedPermission } from '../utils/permission-utils';

/** The viem actions that erc7715ProviderActions adds to a wallet client */
export interface Erc7715Actions {
  getSupportedExecutionPermissions: () => Promise<{ permissions: string[] }>;
  requestExecutionPermissions: (
    permissions: PermissionRequest[],
  ) => Promise<GrantedPermission[]>;
  getGrantedExecutionPermissions: () => Promise<GrantedPermission[]>;
}

/** Wallet client extended with ERC-7715 actions */
export type Erc7715WalletClient = WalletClient & Erc7715Actions;

export interface PermissionState {
  /** Whether the wallet natively supports EIP-7715 */
  supportsErc7715: boolean | null;
  /** Permission types the wallet advertises */
  supportedTypes: string[];
  /** Currently granted permissions from the wallet */
  grantedPermissions: GrantedPermission[];
  /** Whether the user has granted harvest execution permission */
  hasHarvestPermission: boolean;
  /** Whether the EOA has been upgraded to a Smart Account */
  isSmartAccount: boolean | null;
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Last error message */
  error: string | null;
}

export interface PermissionActions {
  /** Check wallet capabilities and granted permissions */
  checkPermissions: () => Promise<void>;
  /** Request harvest execution permission (ERC-20 periodic) */
  requestHarvestPermission: (
    amount: bigint,
    periodDays?: number,
  ) => Promise<GrantedPermission[]>;
  /** Get currently granted permissions */
  getGrantedExecutionPermissions: () => Promise<GrantedPermission[]>;
  /** Reset all permission state */
  reset: () => void;
}

const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  42161: arbitrum,
  84532: baseSepolia,
  11155111: sepolia,
};

export function useMetaMaskPermissions(): PermissionState & PermissionActions {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const [state, setState] = useState<PermissionState>({
    supportsErc7715: null,
    supportedTypes: [],
    grantedPermissions: [],
    hasHarvestPermission: false,
    isSmartAccount: null,
    isLoading: false,
    error: null,
  });

  const walletClientRef = useRef<Erc7715WalletClient | null>(null);

  /**
   * Initialize the ERC-7715 wallet client by extending the browser
   * provider with erc7715ProviderActions from the MetaMask Smart Accounts Kit.
   */
  const initWalletClient = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setState((s) => ({ ...s, error: 'No Ethereum provider found' }));
      return null;
    }

    try {
      const { erc7715ProviderActions } = await import(
        '@metamask/smart-accounts-kit/actions'
      );

      const client = createWalletClient({
        transport: custom(window.ethereum),
        chain: CHAIN_MAP[chainId] ?? mainnet,
      }).extend(erc7715ProviderActions()) as unknown as Erc7715WalletClient;

      walletClientRef.current = client;
      return client;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to init wallet client';
      setState((s) => ({ ...s, error: msg, supportsErc7715: false }));
      return null;
    }
  }, [chainId]);

  /**
   * Check wallet capabilities, Smart Account status, and granted permissions.
   */
  const checkPermissions = useCallback(async () => {
    if (!address) return;

    const client = walletClientRef.current ?? (await initWalletClient());
    if (!client) return;

    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      // Check Smart Account upgrade (EIP-7702)
      let isSmartAccount = false;
      try {
        const provider = window.ethereum!;
        const code: Hex = await provider.request({
          method: 'eth_getCode',
          params: [address, 'latest'],
        });
        isSmartAccount = code !== '0x' && code.length > 2;
      } catch {
        isSmartAccount = false;
      }

      // Check supported permission types
      let supportedTypes: string[] = [];
      let supportsErc7715 = true;
      try {
        const supported = await client.getSupportedExecutionPermissions();
        supportedTypes = supported.permissions ?? [];
      } catch {
        supportsErc7715 = false;
      }

      // Get already-granted permissions
      let grantedPermissions: GrantedPermission[] = [];
      let hasHarvestPermission = false;

      if (supportsErc7715) {
        try {
          grantedPermissions = await client.getGrantedExecutionPermissions();
          for (const gp of grantedPermissions) {
            for (const perm of gp.permissions ?? []) {
              if (perm.permission?.type === 'erc20-token-periodic') {
                hasHarvestPermission = true;
              }
            }
          }
        } catch {
          // No permissions granted yet — expected for first visit
        }
      }

      setState({
        supportsErc7715,
        supportedTypes,
        grantedPermissions,
        hasHarvestPermission,
        isSmartAccount,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Permission check failed';
      setState((s) => ({ ...s, isLoading: false, error: msg }));
    }
  }, [address, initWalletClient]);

  /**
   * Request harvest execution permission (ERC-20 periodic spend).
   *
   * This is the ONLY permission that needs ERC-7715. Read access is
   * already handled by the wallet connection itself.
   *
   * Prompts the user via MetaMask to approve a periodic USDC spend limit
   * that the TaxFi agent can use for gasless loss-harvesting swaps.
   *
   * @param amount - Max USDC atoms per period (e.g. parseUnits('10000', 6))
   * @param periodDays - How often the limit resets (default 1 day)
   */
  const requestHarvestPermission = useCallback(
    async (amount: bigint, periodDays: number = 1) => {
      const client = walletClientRef.current ?? (await initWalletClient());
      if (!client) throw new Error('Wallet client not initialized');

      setState((s) => ({ ...s, isLoading: true, error: null }));

      try {
        const now = Math.floor(Date.now() / 1000);
        const expiry = now + 365 * 86400; // 1 year

        const chain = (
          await import('../utils/permission-utils')
        ).SUPPORTED_CHAINS.find((c) => c.id === chainId);
        const usdcAddress =
          chain?.usdcAddress ??
          '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
        const targetAddress =
          chain?.agentAddress ??
          '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18';

        const permissionRequest: PermissionRequest = {
          chainId,
          expiry,
          to: targetAddress as Address,
          permission: {
            type: 'erc20-token-periodic',
            data: {
              tokenAddress: usdcAddress as Address,
              periodAmount: amount,
              periodDuration: periodDays * 86400,
              justification: `TaxFi automated tax loss harvesting — up to ${amount} USDC worth every ${periodDays} day(s)`,
            },
            isAdjustmentAllowed: true,
          },
        };

        const granted = await client.requestExecutionPermissions([
          permissionRequest,
        ]);

        setState((s) => ({
          ...s,
          hasHarvestPermission: true,
          grantedPermissions: [...s.grantedPermissions, ...granted],
          isLoading: false,
          error: null,
        }));

        return granted;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Harvest permission rejected';
        setState((s) => ({ ...s, isLoading: false, error: msg }));
        throw err;
      }
    },
    [chainId, initWalletClient],
  );

  /**
   * Retrieve currently granted permissions from the wallet.
   */
  const getGranted = useCallback(async () => {
    const client = walletClientRef.current ?? (await initWalletClient());
    if (!client) return [];

    try {
      const granted = await client.getGrantedExecutionPermissions();
      setState((s) => ({ ...s, grantedPermissions: granted }));
      return granted;
    } catch {
      return [];
    }
  }, [initWalletClient]);

  /**
   * Reset all permission state (e.g. on wallet disconnect).
   */
  const reset = useCallback(() => {
    setState({
      supportsErc7715: null,
      supportedTypes: [],
      grantedPermissions: [],
      hasHarvestPermission: false,
      isSmartAccount: null,
      isLoading: false,
      error: null,
    });
    walletClientRef.current = null;
  }, []);

  // Initialize wallet client and check permissions when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      initWalletClient().then(() => checkPermissions());
    } else {
      reset();
    }
  }, [isConnected, address, initWalletClient, checkPermissions, reset]);

  return {
    ...state,
    checkPermissions,
    requestHarvestPermission,
    getGrantedExecutionPermissions: getGranted,
    reset,
  };
}
