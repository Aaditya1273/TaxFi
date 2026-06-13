'use client';

import { useState } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { parseEther } from 'viem';
import Link from 'next/link';

export default function PermissionGrantPage() {
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<'intro' | 'signing' | 'granted'>('intro');
  const [permissionScope, setPermissionScope] = useState({
    readOnly: true,
    executeHarvest: false,
    chains: ['eip155:1', 'eip155:8453', 'eip155:42161'],
    maxDailyValue: 10000,
  });

  // Mock ERC-7715 signature
  const { signTypedData, isPending } = useSignTypedData();

  const handleSign = async () => {
    if (!address) return;

    setStep('signing');

    // In production, this would be actual ERC-7715 typed data
    try {
      await signTypedData({
        domain: {
          name: 'TaxFi Permission',
          version: '1',
          chainId: 1,
          verifyingContract: '0x1234567890123456789012345678901234567890' as `0x${string}`,
        },
        types: {
          Permission: [
            { name: 'grantee', type: 'address' },
            { name: 'granter', type: 'address' },
            { name: 'scope', type: 'PermissionScope' },
            { name: 'validUntil', type: 'uint256' },
          ],
          PermissionScope: [
            { name: 'chains', type: 'uint256[]' },
            { name: 'targets', type: 'address[]' },
            { name: 'permissionType', type: 'uint8' },
            { name: 'maxValue', type: 'uint256' },
          ],
        },
        primaryType: 'Permission',
        message: {
          grantee: '0xTaxFiAgentAddress...' as `0x${string}`,
          granter: address as `0x${string}`,
          scope: {
            chains: permissionScope.chains.map(c => BigInt(parseInt(c.replace('eip155:', '')))),
            targets: ['0x0' as `0x${string}`],
            permissionType: permissionScope.readOnly ? 0 : 1,
            maxValue: parseEther(permissionScope.maxDailyValue.toString()),
          },
          validUntil: BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60),
        },
      });
      setStep('granted');
    } catch {
      setStep('intro');
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Grant Permissions</h2>
        <p className="text-gray-500">Connect your wallet to grant TaxFi access</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Grant TaxFi Permissions</h1>
        <p className="text-gray-500 mt-2">
          Configure what access TaxFi has to your wallet
        </p>
      </div>

      {step === 'intro' && (
        <>
          {/* Permission Scope */}
          <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Permission Scope</h2>

            <div className="space-y-4">
              <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={permissionScope.readOnly}
                  onChange={(e) => {
                    setPermissionScope(s => ({ ...s, readOnly: e.target.checked }));
                    if (e.target.checked) setPermissionScope(s => ({ ...s, executeHarvest: false }));
                  }}
                  className="mt-1 w-5 h-5 rounded accent-emerald-500"
                />
                <div>
                  <p className="text-gray-900 font-medium">Read-Only Access</p>
                  <p className="text-gray-500 text-sm">
                    TaxFi can read your transaction history and balance
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={permissionScope.executeHarvest}
                  onChange={(e) => {
                    setPermissionScope(s => ({ ...s, executeHarvest: e.target.checked }));
                    if (!e.target.checked) setPermissionScope(s => ({ ...s, readOnly: true }));
                  }}
                  className="mt-1 w-5 h-5 rounded accent-emerald-500"
                />
                <div>
                  <p className="text-gray-900 font-medium">Execute Tax Loss Harvests</p>
                  <p className="text-gray-500 text-sm">
                    TaxFi can execute harvest transactions up to ${permissionScope.maxDailyValue.toLocaleString()}/day
                  </p>
                </div>
              </label>

              <div>
                <label className="block text-gray-500 text-sm mb-2">
                  Max Daily Harvest Value (USD)
                </label>
                <input
                  type="number"
                  value={permissionScope.maxDailyValue}
                  onChange={(e) => setPermissionScope(s => ({ ...s, maxDailyValue: Number(e.target.value) }))}
                  disabled={!permissionScope.executeHarvest}
                  className="bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 w-full disabled:opacity-50 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-500 text-sm mb-2">Chains</label>
                <div className="flex flex-wrap gap-2">
                  {['eip155:1', 'eip155:8453', 'eip155:42161'].map(chain => (
                    <button
                      key={chain}
                      onClick={() => {
                        const chains = permissionScope.chains.includes(chain)
                          ? permissionScope.chains.filter(c => c !== chain)
                          : [...permissionScope.chains, chain];
                        setPermissionScope(s => ({ ...s, chains }));
                      }}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        permissionScope.chains.includes(chain)
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm'
                          : 'bg-gray-50 text-gray-500 border border-gray-200 hover:border-emerald-200 hover:text-emerald-600'
                      }`}
                    >
                      {chain.replace('eip155:', '').toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Trust Summary */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8">
            <h3 className="text-emerald-800 font-bold mb-3">What You&apos;re Granting</h3>
            <ul className="space-y-2 text-gray-600 text-sm">
              <li className="flex items-center gap-2">
                {permissionScope.readOnly ? '✅' : '❌'} Read transaction history
              </li>
              <li className="flex items-center gap-2">
                {permissionScope.readOnly ? '✅' : '❌'} View balances and positions
              </li>
              <li className="flex items-center gap-2">
                {permissionScope.executeHarvest ? '✅' : '❌'} Execute trades up to ${permissionScope.maxDailyValue.toLocaleString()}/day
              </li>
              <li className="flex items-center gap-2">
                ✅ Revoke anytime
              </li>
              <li className="flex items-center gap-2">
                Expires in 365 days
              </li>
            </ul>
          </div>

          <button
            onClick={handleSign}
            className="btn-primary w-full py-4 text-lg"
          >
            Grant Permissions
          </button>

          <p className="text-center text-gray-500 text-sm">
            This uses ERC-7715. You&apos;ll see exactly what you&apos;re signing in your wallet.
          </p>
        </>
      )}

      {step === 'signing' && (
        <div className="text-center py-12">
          <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-6"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Check Your Wallet</h2>
          <p className="text-gray-500">Sign the permission request to continue</p>
        </div>
      )}

      {step === 'granted' && (
        <div className="text-center py-12">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Permissions Granted!</h2>
          <p className="text-gray-500 mb-6">
            TaxFi can now access your wallet. Start scanning to find tax savings.
          </p>
          <Link href="/dashboard" className="btn-primary">
            Go to Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
