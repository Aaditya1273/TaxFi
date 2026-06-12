/**
 * TaxFi — Permission Utilities
 *
 * Types, constants, and helpers for ERC-7715 Advanced Permissions
 * via the MetaMask Smart Accounts Kit.
 *
 * Covers:
 * - Permission scope definitions (read-only, ERC20 periodic, function call)
 * - Chain configuration
 * - Decoding permission contexts for relayer submission
 */

import type { Address, Hex } from 'viem';

// Supported chain metadata for permissions
/**
 * Deployed TaxFiAgentSmartAccount addresses per chain.
 * These are the addresses that the user grants ERC-7715 delegations TO.
 * In production, update these after deploying the smart contracts.
 */
const TAXFI_AGENT_ADDRESSES: Record<number, Address> = {
  1: '0x0000000000000000000000000000000000000000',      // Ethereum - TODO: deploy on mainnet
  8453: '0x0000000000000000000000000000000000000000',     // Base - TODO: deploy on mainnet
  42161: '0x0000000000000000000000000000000000000000',    // Arbitrum - TODO: deploy on mainnet
  11155111: '0x401E5B592D1F56f335405079F13d49b81309f82f',  // Ethereum Sepolia ✅ deployed
  31337: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',   // Local Hardhat (dev)
  84532: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',   // Base Sepolia - dev
};

export function getTaxFiAgentAddress(chainId: number): Address {
  return (
    TAXFI_AGENT_ADDRESSES[chainId] ??
    '0x401E5B592D1F56f335405079F13d49b81309f82f'
  );
}

export const SUPPORTED_CHAINS = [
  {
    id: 1,
    name: 'Ethereum',
    caip2: 'eip155:1',
    usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
    covalentChainId: 1,
    agentAddress: TAXFI_AGENT_ADDRESSES[1],
  },
  {
    id: 8453,
    name: 'Base',
    caip2: 'eip155:8453',
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
    covalentChainId: 8453,
    agentAddress: TAXFI_AGENT_ADDRESSES[8453],
  },
  {
    id: 42161,
    name: 'Arbitrum',
    caip2: 'eip155:42161',
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address,
    covalentChainId: 42161,
    agentAddress: TAXFI_AGENT_ADDRESSES[42161],
  },
  {
    id: 84532,
    name: 'Base Sepolia',
    caip2: 'eip155:84532',
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address,
    covalentChainId: 84532,
    agentAddress: TAXFI_AGENT_ADDRESSES[84532],
  },
  {
    id: 11155111,
    name: 'Sepolia',
    caip2: 'eip155:11155111',
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address,
    covalentChainId: 11155111,
    agentAddress: TAXFI_AGENT_ADDRESSES[11155111],
  },
] as const;

export type ChainConfig = (typeof SUPPORTED_CHAINS)[number];

// --- ERC-7715 Permission Types ---

export type PermissionType =
  | 'erc20-token-periodic'
  | 'erc20-token-amount'
  | 'function-call'
  | 'read-only';

export interface Erc20PeriodicPermission {
  type: 'erc20-token-periodic';
  data: {
    tokenAddress: Address;
    periodAmount: bigint; // e.g. parseUnits('10', 6) for 10 USDC
    periodDuration: number; // in seconds, e.g. 86400 = 1 day
    justification?: string;
  };
  isAdjustmentAllowed?: boolean;
}

export interface Erc20AmountPermission {
  type: 'erc20-token-amount';
  data: {
    tokenAddress: Address;
    amount: bigint;
    justification?: string;
  };
  isAdjustmentAllowed?: boolean;
}

export interface FunctionCallPermission {
  type: 'function-call';
  data: {
    to: Address;
    selector: Hex;
    justification?: string;
  };
  isAdjustmentAllowed?: boolean;
}

export type PermissionConfig =
  | Erc20PeriodicPermission
  | Erc20AmountPermission
  | FunctionCallPermission;

export interface PermissionRequest {
  chainId: number;
  expiry: number; // unix seconds
  to: Address; // delegate (the TaxFi agent or relayer targetAddress)
  permission: PermissionConfig;
}

export interface GrantedPermission {
  context: Hex;
  permissions: PermissionRequest[];
}

// --- TaxFi-specific permission presets ---

/**
 * ERC-20 periodic permission for tax loss harvesting.
 * This is the ONLY permission that requires ERC-7715.
 * Read-only access comes from the wallet connection itself (Wagmi exposes addresses).
 *
 * Allows the agent to transfer up to `amount` USDC worth of tokens per `periodDays`.
 * The user signs this in MetaMask and can revoke anytime.
 */
export function createHarvestPermission(
  chainId: number,
  usdcAddress: Address,
  targetAddress: Address,
  amount: bigint,
  periodDays: number = 1,
  expiry: number = Math.floor(Date.now() / 1000) + 365 * 86400,
): PermissionRequest {
  return {
    chainId,
    expiry,
    to: targetAddress,
    permission: {
      type: 'erc20-token-periodic',
      data: {
        tokenAddress: usdcAddress,
        periodAmount: amount,
        periodDuration: periodDays * 86400,
        justification:
          `TaxFi agent can harvest up to ${amount} units of USDC worth of tokens ` +
          `per ${periodDays} day(s) for tax loss harvesting`,
      },
      isAdjustmentAllowed: true,
    },
  };
}

/**
 * Check if the user's wallet is already upgraded to a Smart Account (EIP-7702).
 * MetaMask Smart Accounts require EIP-7702 delegation to be set.
 */
export async function checkSmartAccountUpgrade(address: Address): Promise<boolean> {
  if (typeof window === 'undefined' || !window.ethereum) return false;

  try {
    const provider = window.ethereum;
    const code: Hex = await provider.request({
      method: 'eth_getCode',
      params: [address, 'latest'],
    });
    // Smart accounts have code at their address (unlike EOAs)
    return code !== '0x' && code.length > 2;
  } catch {
    return false;
  }
}



/**
 * Get the user-friendly label for a permission type.
 */
export function getPermissionLabel(type: PermissionType): string {
  const labels: Record<string, string> = {
    'erc20-token-periodic': 'Periodic Token Spend',
    'erc20-token-amount': 'One-Time Token Spend',
    'function-call': 'Function Call Access',
    'read-only': 'Read-Only Access',
  };
  return labels[type] ?? type;
}

/**
 * Format a chain ID to its human-readable name.
 */
export function getChainName(chainId: number): string {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  return chain?.name ?? `Chain ${chainId}`;
}
