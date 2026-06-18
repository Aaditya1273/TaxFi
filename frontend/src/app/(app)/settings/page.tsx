'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { api } from '@/utils/api';

// Deployed contract addresses from .env
const CONTRACTS = {
  permissionRegistry: process.env.NEXT_PUBLIC_PERMISSION_REGISTRY  || '0x4F7141763FeB5dB91178343d3c894E88992794A3',
  agentAddress:       process.env.NEXT_PUBLIC_AGENT_ADDRESS         || '0x401E5B592D1F56f335405079F13d49b81309f82f',
  vaultAddress:       process.env.NEXT_PUBLIC_VAULT_ADDRESS         || '0x2AF710af85914DEe0AA89017223638367645f6b4',
  attestorAddress:    process.env.NEXT_PUBLIC_ATTESTOR_ADDRESS      || '0xff32FDd41F06b1a166d56677d1C5c0001251BF4C',
};

function Row({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div className="flex justify-between items-start py-3 border-b border-gray-100 last:border-0 gap-4">
      <span className="text-sm text-gray-500 flex-shrink-0">{label}</span>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-emerald-600 hover:underline break-all text-right"
        >
          {value}
        </a>
      ) : (
        <span className="text-xs font-mono text-gray-700 break-all text-right">{value}</span>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [costBasis, setCostBasis] = useState('HIFO');
  const [threshold, setThreshold]   = useState(100);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  // Load saved settings from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('taxfi_settings');
    if (stored) {
      try {
        const s = JSON.parse(stored);
        if (s.costBasis) setCostBasis(s.costBasis);
        if (s.harvestThreshold) setThreshold(s.harvestThreshold);
      } catch {}
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSettings({ cost_basis_method: costBasis, harvest_threshold_usd: threshold });
      localStorage.setItem('taxfi_settings', JSON.stringify({ costBasis, harvestThreshold: threshold }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    finally { setSaving(false); }
  };

  const sepoliaExplorer = (addr: string) => `https://sepolia.etherscan.io/address/${addr}`;

  if (!isConnected) return (
    <div className="text-center py-20 text-gray-500">Connect your wallet to configure TaxFi.</div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your TaxFi preferences and view smart contract info.</p>
      </div>

      {/* Cost Basis */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-sm font-bold text-gray-900 mb-4">Cost Basis Method</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { v: 'HIFO', d: 'Highest In, First Out — tax optimal' },
            { v: 'FIFO', d: 'First In, First Out — IRS default' },
            { v: 'LIFO', d: 'Last In, First Out' },
            { v: 'ACB',  d: 'Average Cost Basis' },
          ].map(m => (
            <label
              key={m.v}
              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-all ${
                costBasis === m.v ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300'
              }`}
            >
              <input type="radio" name="costBasis" value={m.v}
                checked={costBasis === m.v}
                onChange={e => setCostBasis(e.target.value)}
                className="mt-0.5 accent-emerald-600"
              />
              <div>
                <p className="text-sm font-semibold text-gray-900">{m.v}</p>
                <p className="text-xs text-gray-500">{m.d}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Harvest threshold */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-sm font-bold text-gray-900 mb-3">Min Harvest Threshold</p>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 font-semibold">$</span>
          <input
            type="number" min={0} value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-28 focus:ring-2 focus:ring-emerald-400 outline-none"
          />
          <p className="text-xs text-gray-400">Only show opportunities above this amount</p>
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-all active:scale-95 disabled:opacity-60"
      >
        {saving
          ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
          : saved
            ? <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Saved</>
            : 'Save Settings'
        }
      </button>

      {/* Account */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-sm font-bold text-gray-900 mb-3">Account</p>
        <Row label="Wallet"   value={address ?? '—'} link={address ? `https://sepolia.etherscan.io/address/${address}` : undefined} />
        <Row label="Chain ID" value={chainId?.toString() ?? '—'} />
        <Row label="TaxFi Fee" value="5% of tax savings" />
      </div>

      {/* Smart Contracts */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-sm font-bold text-gray-900 mb-1">Deployed Smart Contracts</p>
        <p className="text-xs text-gray-400 mb-4">Ethereum Sepolia Testnet (Chain 11155111)</p>
        <Row label="Permission Registry" value={CONTRACTS.permissionRegistry} link={sepoliaExplorer(CONTRACTS.permissionRegistry)} />
        <Row label="Agent Account"       value={CONTRACTS.agentAddress}        link={sepoliaExplorer(CONTRACTS.agentAddress)} />
        <Row label="Harvest Vault"        value={CONTRACTS.vaultAddress}        link={sepoliaExplorer(CONTRACTS.vaultAddress)} />
        <Row label="Form Attestor"        value={CONTRACTS.attestorAddress}     link={sepoliaExplorer(CONTRACTS.attestorAddress)} />
      </div>

      {/* Danger Zone */}
      <div className="border border-red-200 bg-red-50 rounded-xl p-5">
        <p className="text-sm font-bold text-red-700 mb-3">⚠ Danger Zone</p>
        <div className="flex gap-3">
          <button className="px-4 py-2 text-xs font-semibold bg-white border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
            Clear Portfolio Data
          </button>
          <button className="px-4 py-2 text-xs font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
