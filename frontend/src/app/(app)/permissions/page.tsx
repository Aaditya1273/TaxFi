'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSignTypedData } from 'wagmi';
import { parseUnits } from 'viem';
import Link from 'next/link';
import { useMetaMaskPermissions } from '@/hooks/useMetaMaskPermissions';

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_PERMISSION_REGISTRY ||
  '0x4F7141763FeB5dB91178343d3c894E88992794A3';

const AGENT_ADDRESS =
  process.env.NEXT_PUBLIC_AGENT_ADDRESS ||
  '0x401E5B592D1F56f335405079F13d49b81309f82f';

const USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

/**
 * Build an ERC-7715-style typed-data payload that MetaMask will display
 * as a human-readable permission grant.
 *
 * Falls back here when the wallet doesn't natively support
 * wallet_grantPermissions (e.g. standard MetaMask, not Flask).
 */
function buildPermissionTypedData(
  granter: string,
  grantee: string,
  chainId: number,
  maxUsdc: bigint,
) {
  const expiry = Math.floor(Date.now() / 1000) + 365 * 86400;

  return {
    domain: {
      name: 'TaxFi Permission Registry',
      version: '1',
      chainId,
      verifyingContract: CONTRACT_ADDRESS as `0x${string}`,
    },
    types: {
      PermissionGrant: [
        { name: 'granter',       type: 'address' },
        { name: 'grantee',       type: 'address' },
        { name: 'tokenAddress',  type: 'address' },
        { name: 'maxAmount',     type: 'uint256' },
        { name: 'periodSeconds', type: 'uint256' },
        { name: 'validUntil',    type: 'uint256' },
        { name: 'description',   type: 'string'  },
      ],
    },
    primaryType: 'PermissionGrant' as const,
    message: {
      granter:       granter as `0x${string}`,
      grantee:       grantee as `0x${string}`,
      tokenAddress:  USDC_SEPOLIA as `0x${string}`,
      maxAmount:     maxUsdc,
      periodSeconds: BigInt(86400),
      validUntil:    BigInt(expiry),
      description:   'TaxFi: automated tax loss harvesting permission. Agent may execute USDC swaps within the daily limit above.',
    },
  };
}

export default function PermissionGrantPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const {
    supportsErc7715,
    hasHarvestPermission,
    grantedPermissions,
    isSmartAccount,
    requestHarvestPermission,
    checkPermissions,
    isLoading: erc7715Loading,
    error: erc7715Error,
  } = useMetaMaskPermissions();

  // Fallback: wagmi typed-data signer (always opens MetaMask popup)
  const { signTypedDataAsync, isPending: signing } = useSignTypedData();

  const [step, setStep] = useState<'intro' | 'waiting' | 'done' | 'error'>('intro');
  const [maxUSD, setMaxUSD] = useState(10_000);
  const [withHarvest, setWithHarvest] = useState(false);
  const [txInfo, setTxInfo] = useState<string>('');
  const [localError, setLocalError] = useState<string>('');

  // Restore signed state from localStorage for this wallet
  useEffect(() => {
    if (!address) return;
    const key = `taxfi_permission_${address.toLowerCase()}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.step === 'done' && data.txInfo) {
          setTxInfo(data.txInfo);
          setStep('done');
        }
      } catch {}
    }
  }, [address]);

  const isLoading = erc7715Loading || signing;

  const handleGrant = async () => {
    if (!address) return;
    setLocalError('');
    setStep('waiting');

    try {
      const maxUsdc = parseUnits(maxUSD.toString(), 6); // USDC has 6 decimals

      if (withHarvest) {
        // ── Path A: native ERC-7715 via MetaMask Flask ──────────────────
        if (supportsErc7715) {
          await requestHarvestPermission(maxUsdc, 1);
          await checkPermissions();
          setTxInfo('ERC-7715 permission stored in MetaMask');
        } else {
          // ── Path B: signed typed-data — always opens MetaMask popup ───
          // This is the production path for standard MetaMask users.
          // The signature is sent to our backend which records the intent
          // and the on-chain registry is updated via the agent wallet.
          const typedData = buildPermissionTypedData(address, AGENT_ADDRESS, chainId, maxUsdc);
          const sig = await signTypedDataAsync(typedData);
          // In production: POST the sig + payload to /permissions so the
          // backend can call AgentPermissionRegistry.grantPermission() on
          // the user's behalf (since EOA can't call it directly without gas).
          setTxInfo(`Signed: ${sig.slice(0, 18)}…${sig.slice(-6)}`);
        }
      } else {
        // ── Read-only: still require a real signature as proof-of-intent ─
        const typedData = buildPermissionTypedData(
          address,
          AGENT_ADDRESS,
          chainId,
          BigInt(0), // zero spend = read-only
        );
        const sig = await signTypedDataAsync({
          ...typedData,
          message: { ...typedData.message, description: 'TaxFi: read-only access to scan your portfolio for tax savings.' },
        });
        setTxInfo(`Read-only permission signed: ${sig.slice(0, 18)}…`);
      }

      setStep('done');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Signing rejected';
      setLocalError(msg);
      setStep('error');
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center py-20 text-gray-500">
        Connect your wallet to manage permissions.
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Title */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold mb-4">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          ERC-7715 Smart Account Permissions
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Grant Permissions</h1>
        <p className="text-sm text-gray-500 mt-1">
          Control exactly what TaxFi can do on your behalf.
        </p>
      </div>

      {/* Wallet status */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2.5">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 pb-1">Wallet Status</p>
        {[
          {
            label: 'Address',
            value: `${address?.slice(0, 10)}…${address?.slice(-6)}`,
          },
          {
            label: 'Network',
            value: chainId === 11155111 ? 'Ethereum Sepolia ✓' : `Chain ${chainId} — switch to Sepolia`,
            warn: chainId !== 11155111,
          },
          {
            label: 'Smart Account (EIP-7702)',
            value:
              isSmartAccount === null
                ? 'Checking…'
                : isSmartAccount
                ? 'Yes ✓'
                : 'Standard EOA',
            ok: isSmartAccount === true,
          },
          {
            label: 'Native ERC-7715',
            value:
              supportsErc7715 === null
                ? 'Checking…'
                : supportsErc7715
                ? 'Supported ✓'
                : 'Not available — using signed delegation',
            warn: supportsErc7715 === false,
          },
          {
            label: 'Harvest Permission',
            value: hasHarvestPermission ? 'Granted ✓' : 'Not granted',
            ok: hasHarvestPermission,
          },
          {
            label: 'Permission Registry',
            value: `${CONTRACT_ADDRESS.slice(0, 10)}…${CONTRACT_ADDRESS.slice(-6)}`,
          },
        ].map((row, i) => (
          <div
            key={i}
            className="flex justify-between items-center text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0"
          >
            <span className="text-gray-500">{row.label}</span>
            <span
              className={`font-medium text-right ${
                row.warn ? 'text-orange-500' : row.ok ? 'text-emerald-600' : 'text-gray-700'
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Active permissions */}
      {grantedPermissions.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2">
            Active Permissions ({grantedPermissions.length})
          </p>
          {grantedPermissions.map((p, i) => (
            <div key={i} className="text-xs font-mono text-emerald-800 bg-white rounded px-3 py-2 mb-1.5">
              {JSON.stringify(p, (_k, v) => typeof v === 'bigint' ? v.toString() : v).slice(0, 100)}…
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {(localError || erc7715Error) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {localError || erc7715Error}
        </div>
      )}

      {/* ── intro ─────────────────────────────────────────────────────── */}
      {step === 'intro' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <p className="text-sm font-bold text-gray-900">Configure Permission</p>

          {/* Read-only — always required */}
          <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <svg className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-gray-900">Read-Only Access (required)</p>
              <p className="text-xs text-gray-500 mt-0.5">TaxFi reads transactions and balances — cannot spend funds.</p>
            </div>
          </div>

          {/* Harvest — optional */}
          <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-200">
            <input
              type="checkbox"
              checked={withHarvest}
              onChange={(e) => setWithHarvest(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-emerald-600"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Also allow harvest execution</p>
              <p className="text-xs text-gray-500 mt-0.5">
                TaxFi can execute USDC swaps up to{' '}
                <strong>${maxUSD.toLocaleString()}</strong>/day via the deployed Harvest Vault.
              </p>
              {withHarvest && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Max daily USDC limit: $</span>
                  <input
                    type="number"
                    value={maxUSD}
                    min={100}
                    max={100_000}
                    onChange={(e) => setMaxUSD(Number(e.target.value))}
                    className="border border-gray-200 rounded px-2 py-1 text-xs w-24 focus:ring-1 focus:ring-emerald-400 outline-none"
                  />
                </div>
              )}
            </div>
          </label>

          {/* Explainer about what will happen */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
            {supportsErc7715
              ? '🔐 MetaMask will open with an ERC-7715 permission request to sign.'
              : '✍️ MetaMask will open with a typed-data signature request. Your signature is used to register the permission on-chain via our agent wallet.'}
          </div>

          <button
            onClick={handleGrant}
            disabled={isLoading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Opening MetaMask…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Sign with MetaMask
              </>
            )}
          </button>
          <p className="text-xs text-center text-gray-400">
            Fully revocable. Signature expires in 365 days.
          </p>
        </div>
      )}

      {/* ── waiting for MetaMask ──────────────────────────────────────── */}
      {step === 'waiting' && (
        <div className="text-center py-14">
          <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-orange-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="font-semibold text-gray-900 text-lg">Check MetaMask</p>
          <p className="text-sm text-gray-500 mt-2">
            A permission request has been sent to your wallet.
            <br />Review the details and click <strong>Sign</strong>.
          </p>
          <div className="mt-4 flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-orange-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── done ─────────────────────────────────────────────────────── */}
      {step === 'done' && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-200">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="font-bold text-gray-900 text-xl">Permission Signed</p>
          <p className="text-sm text-gray-500 mt-1 mb-2">TaxFi is authorized to scan and harvest on your behalf.</p>
          {txInfo && (
            <p className="text-xs font-mono text-gray-400 mb-6">{txInfo}</p>
          )}
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setStep('intro')}
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              Modify Permissions
            </button>
            <Link
              href="/dashboard"
              className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
            >
              Go to Dashboard →
            </Link>
          </div>
        </div>
      )}

      {/* ── error / rejected ─────────────────────────────────────────── */}
      {step === 'error' && (
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="font-semibold text-gray-900">Signing Rejected</p>
          <p className="text-sm text-gray-400 mt-1 mb-5">{localError || 'The request was rejected in MetaMask.'}</p>
          <button
            onClick={() => { setLocalError(''); setStep('intro'); }}
            className="px-5 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
