'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';

export default function SettingsPage() {
  const { address, isConnected } = useAccount();
  const [costBasis, setCostBasis] = useState('HIFO');
  const [harvestThreshold, setHarvestThreshold] = useState(100);
  const [notifications, setNotifications] = useState(true);
  const [autoHarvest, setAutoHarvest] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('taxfi_settings', JSON.stringify({
      costBasis,
      harvestThreshold,
      notifications,
      autoHarvest,
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-white mb-4">Settings</h2>
        <p className="text-gray-400">Connect your wallet to configure settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Configure your TaxFi preferences</p>
      </div>

      {/* Cost Basis Method */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Cost Basis Method</h2>
        <p className="text-gray-400 text-sm mb-4">
          Determines how TaxFi calculates your cost basis when selling assets.
        </p>
        <div className="space-y-3">
          {[
            { value: 'HIFO', label: 'HIFO (Highest In, First Out)', desc: 'Minimizes gains, tax-optimal' },
            { value: 'FIFO', label: 'FIFO (First In, First Out)', desc: 'Default IRS method' },
            { value: 'LIFO', label: 'LIFO (Last In, First Out)', desc: 'Sell newest first' },
            { value: 'ACB', label: 'ACB (Average Cost)', desc: 'Average cost across all lots' },
          ].map((method) => (
            <label
              key={method.value}
              className={`flex items-start gap-3 p-4 rounded-lg cursor-pointer transition ${
                costBasis === method.value
                  ? 'bg-taxfi-500/20 border border-taxfi-500/50'
                  : 'bg-gray-800/50 border border-transparent hover:bg-gray-800'
              }`}
            >
              <input
                type="radio"
                name="costBasis"
                value={method.value}
                checked={costBasis === method.value}
                onChange={(e) => setCostBasis(e.target.value)}
                className="mt-1"
              />
              <div>
                <p className="text-white font-medium">{method.label}</p>
                <p className="text-gray-500 text-sm">{method.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Harvest Settings */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Harvest Settings</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              Minimum Harvest Threshold (USD)
            </label>
            <div className="flex items-center gap-3">
              <span className="text-white text-lg">$</span>
              <input
                type="number"
                value={harvestThreshold}
                onChange={(e) => setHarvestThreshold(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white w-32"
              />
            </div>
            <p className="text-gray-500 text-sm mt-2">
              Only report harvest opportunities above this amount
            </p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoHarvest}
              onChange={(e) => setAutoHarvest(e.target.checked)}
              className="w-5 h-5 rounded bg-gray-800 border-gray-700 text-taxfi-500"
            />
            <div>
              <p className="text-white font-medium">Auto-execute small harvests</p>
              <p className="text-gray-500 text-sm">
                Automatically execute harvests under $500 without confirmation
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Notifications</h2>
        
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={notifications}
            onChange={(e) => setNotifications(e.target.checked)}
            className="w-5 h-5 rounded bg-gray-800 border-gray-700 text-taxfi-500"
          />
          <div>
            <p className="text-white font-medium">Push Notifications</p>
            <p className="text-gray-500 text-sm">
              Get notified about new harvest opportunities
            </p>
          </div>
        </label>
      </div>

      {/* Account Info */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Account</h2>
        
        {address && (
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Wallet</span>
              <span className="text-white font-mono">{address}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Chain</span>
              <span className="text-white">Ethereum (Mainnet)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">TaxFi Fee</span>
              <span className="text-taxfi-400">5% of tax savings</span>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <button onClick={handleSave} className="btn-primary">
          Save Settings
        </button>
        {saved && (
          <span className="text-green-400 text-sm">Settings saved!</span>
        )}
      </div>

      {/* Danger Zone */}
      <div className="border border-red-500/30 rounded-xl p-6">
        <h3 className="text-red-400 font-bold mb-4">Danger Zone</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-white">Clear Portfolio Data</p>
              <p className="text-gray-500 text-sm">
                Remove all cost basis and transaction data
              </p>
            </div>
            <button className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">
              Clear Data
            </button>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-white">Delete Account</p>
              <p className="text-gray-500 text-sm">
                Permanently delete your TaxFi account and all data
              </p>
            </div>
            <button className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
