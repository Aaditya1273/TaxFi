import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useMetaMaskPermissions } from '../hooks/useMetaMaskPermissions';
import { SUPPORTED_CHAINS, getTaxFiAgentAddress } from '../utils/permission-utils';

type GrantStep = 'idle' | 'pending' | 'granted' | 'rejected';

export function PermissionGrant() {
  const { isConnected, address, chainId } = useAccount();

  const {
    supportsErc7715,
    supportedTypes,
    hasHarvestPermission,
    isSmartAccount,
    isLoading,
    error,
    checkPermissions,
    requestHarvestPermission,
  } = useMetaMaskPermissions();

  const [agreed, setAgreed] = useState(false);
  const [step, setStep] = useState<GrantStep>('idle');
  const [pageError, setPageError] = useState<string | null>(null);

  // Re-check when wallet connects
  useEffect(() => {
    if (isConnected) setStep('idle');
  }, [isConnected]);

  const handleGrantHarvest = useCallback(async () => {
    setStep('pending');
    setPageError(null);

    try {
      // $10,000/day harvest limit with 6 decimals for USDC
      const amount = BigInt(10_000 * 10 ** 6);
      await requestHarvestPermission(amount, 1);
      setStep('granted');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Harvest permission rejected';
      setPageError(msg);
      setStep('rejected');
    }
  }, [requestHarvestPermission]);

  // Derived states
  const displayError = error || pageError;
  const chainName = SUPPORTED_CHAINS.find((c) => c.id === chainId)?.name ?? `Chain ${chainId}`;
  const usdcAddress = SUPPORTED_CHAINS.find((c) => c.id === chainId)?.usdcAddress ?? '';
  const agentAddress = getTaxFiAgentAddress(chainId ?? 84532);

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-5xl mb-4">🦊</div>
          <p className="text-xl text-gray-400">Connect your wallet to continue</p>
          <p className="text-sm text-gray-500 mt-2">
            Read access is automatic — ERC-7715 only needed for harvest execution
          </p>
        </div>
      </div>
    );
  }

  // Wallet doesn't support EIP-7715
  if (supportsErc7715 === false) {
    return (
      <div className="max-w-2xl mx-auto py-8 animate-slide-in">
        <div className="card text-center">
          <div className="text-5xl mb-6">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Wallet Update Required
          </h2>
          <p className="text-gray-400 mb-4">
            Your wallet doesn't support ERC-7715 Advanced Permissions.
            Tax Loss Harvesting requires this, but you can still use TaxFi
            for portfolio tracking and tax reports.
          </p>
          <div className="bg-gray-800/50 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm text-gray-300 font-medium mb-2">
              To enable harvest execution, you need:
            </p>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>• MetaMask production ≥ 13.23</li>
              <li>• MetaMask Flask ≥ 13.5</li>
              <li>• A Smart Account (EIP-7702 upgrade)</li>
            </ul>
          </div>
          <button onClick={checkPermissions} className="btn-secondary">
            🔄 Check Again
          </button>
        </div>
      </div>
    );
  }

  // Needs Smart Account upgrade
  // Unsupported chain guard
  const currentChain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  if (isConnected && !currentChain) {
    return (
      <div className="max-w-2xl mx-auto py-8 animate-slide-in">
        <div className="card text-center">
          <div className="text-5xl mb-6">🌐</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Unsupported Chain
          </h2>
          <p className="text-gray-400 mb-6">
            TaxFi doesn't support chain ID {chainId}. Please switch to one of:
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {SUPPORTED_CHAINS.filter((c) => c.id !== 84532).map((c) => (
              <span
                key={c.id}
                className="px-3 py-1 rounded-full bg-gray-800 text-gray-300 text-sm"
              >
                {c.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isSmartAccount === false) {
    return (
      <div className="max-w-2xl mx-auto py-8 animate-slide-in">
        <div className="card text-center">
          <div className="text-5xl mb-6">🔄</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Smart Account Upgrade Required
          </h2>
          <p className="text-gray-400 mb-6">
            Your account needs to be upgraded to a MetaMask Smart Account (EIP-7702)
            before you can grant Advanced Permissions.
          </p>
          <div className="bg-gray-800/50 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm text-gray-300 font-medium mb-2">
              What happens when you upgrade:
            </p>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>✅ Your address stays the same</li>
              <li>✅ Your funds stay accessible</li>
              <li>✅ You can grant granular permissions to agents</li>
              <li>❌ No seed phrase changes needed</li>
            </ul>
          </div>
          <div className="flex gap-3 justify-center">
            <a
              href="https://docs.metamask.io/smart-accounts-kit/get-started/upgrade/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              📖 Upgrade Guide →
            </a>
            <button onClick={checkPermissions} className="btn-secondary">
              🔄 Check Status
            </button>
          </div>
          {isLoading && (
            <p className="text-sm text-gray-400 mt-4">⏳ Checking upgrade status...</p>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (displayError) {
    return (
      <div className="max-w-2xl mx-auto py-8 animate-slide-in">
        <div className="card text-center">
          <div className="text-5xl mb-6">❌</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Harvest Permission Failed
          </h2>
          <p className="text-gray-400 mb-6">{displayError}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setStep('idle')} className="btn-primary">
              🔄 Try Again
            </button>
            <button onClick={checkPermissions} className="btn-secondary">
              Check Wallet Status
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success
  if (hasHarvestPermission && step === 'granted') {
    return (
      <div className="max-w-2xl mx-auto py-8 animate-slide-in">
        <div className="card text-center">
          <div className="text-5xl mb-6">✅</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Harvest Permission Granted!
          </h2>
          <p className="text-gray-400 mb-6">
            TaxFi can now execute tax loss harvesting swaps on your behalf
            on <strong className="text-white">{chainName}</strong>.
          </p>
          <div className="bg-harvest/10 rounded-xl p-4 mb-6">
            <p className="text-harvest font-medium mb-2">Active Permission</p>
            <ul className="space-y-1 text-sm">
              <li className="text-harvest">
                ✅ Up to $10,000 USDC worth of swaps per day
              </li>
              <li className="text-harvest">
                ✅ Gas paid in USDC (you never need ETH)
              </li>
              <li className="text-gray-400">
                ❌ Revocable anytime from MetaMask
              </li>
            </ul>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs text-gray-500 font-mono break-all">
              Agent: {agentAddress}
              <br />
              Token: {usdcAddress}
              <br />
              Expires: 1 year
            </p>
          </div>
          <button onClick={checkPermissions} className="btn-secondary text-sm">
            🔄 Refresh Status
          </button>
        </div>
      </div>
    );
  }

  // Main grant form
  return (
    <div className="max-w-2xl mx-auto py-8 animate-slide-in">
      <div className="card">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🛡️</div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Grant Harvest Permission
          </h1>
          <p className="text-gray-400 max-w-md mx-auto">
            Read access is already available through your wallet connection.
            This permission is for executing tax loss harvests.
          </p>
        </div>

        {/* Read Access (auto) */}
        <div className="bg-gray-800/50 rounded-xl p-6 mb-4">
          <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
            ✅ Already Active — Read Access
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-harvest">✅</span>
                <span className="text-gray-300">Portfolio & transaction viewing</span>
              </div>
              <span className="text-harvest text-xs font-medium">Via Wagmi</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800">
              <span className="text-gray-400">Wallet</span>
              <span className="text-white font-mono text-sm">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800">
              <span className="text-gray-400">Network</span>
              <span className="text-white text-sm">{chainName}</span>
            </div>
          </div>
        </div>

        {/* Harvest Permission (requires ERC-7715) */}
        <div className="bg-taxfi-500/5 border border-taxfi-500/20 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
            🔑 Requires Approval — Harvest Execution
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            This grants the TaxFi agent permission to execute token swaps for tax loss
            harvesting. Gas is paid in USDC — you never need ETH.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800">
              <span className="text-gray-400">Daily Limit</span>
              <span className="text-white font-medium">$10,000 USDC</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800">
              <span className="text-gray-400">Period</span>
              <span className="text-white font-medium">Daily (resets every 24h)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800">
              <span className="text-gray-400">Agent Address</span>
              <span className="text-white font-mono text-xs">
                {agentAddress.slice(0, 10)}...{agentAddress.slice(-6)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800">
              <span className="text-gray-400">Duration</span>
              <span className="text-white font-medium">1 year (revocable)</span>
            </div>
          </div>
        </div>

        {/* Wallet capabilities */}
        {isSmartAccount === true && (
          <div className="flex items-center gap-2 mb-4 p-2">
            <span className="text-harvest text-sm">✅ Smart Account active</span>
            {supportedTypes.length > 0 && (
              <span className="text-xs text-gray-500">
                Supports: {supportedTypes.join(', ')}
              </span>
            )}
          </div>
        )}

        {isSmartAccount === null && isLoading && (
          <p className="text-sm text-gray-500 mb-4">⏳ Checking wallet capabilities...</p>
        )}

        {/* Agreement */}
        <label className="flex items-start gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 rounded border-gray-600 bg-gray-800 text-taxfi-500 focus:ring-taxfi-500"
          />
          <span className="text-sm text-gray-400">
            I understand this grants the TaxFi agent permission to execute{' '}
            <strong className="text-white">token swaps up to $10,000/day</strong>{' '}
            on my behalf for tax loss harvesting. I can revoke this anytime
            from my wallet.
          </span>
        </label>

        {/* Action */}
        <button
          onClick={handleGrantHarvest}
          disabled={!agreed || isLoading || step === 'pending'}
          className="btn-harvest w-full text-lg"
        >
          {isLoading || step === 'pending'
            ? '⏳ Check MetaMask...'
            : '🔑 Approve in MetaMask'}
        </button>

        {/* Pending hint */}
        {step === 'pending' && (
          <div className="mt-4 p-4 rounded-xl bg-taxfi-500/10 border border-taxfi-500/20 animate-pulse-slow">
            <p className="text-sm text-taxfi-400 text-center">
              📱 A MetaMask prompt should appear — review and sign the permission
            </p>
          </div>
        )}

        <p className="text-center text-xs text-gray-500 mt-4">
          Powered by{' '}
          <a
            href="https://docs.metamask.io/smart-accounts-kit/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-taxfi-400 hover:underline"
          >
            MetaMask Smart Accounts Kit
          </a>{' '}
          · ERC-7715 · EIP-7702
        </p>
      </div>
    </div>
  );
}
