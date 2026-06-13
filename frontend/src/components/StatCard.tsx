'use client';

import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  gradient?: boolean;
  className?: string;
}

export function StatCard({ label, value, icon, trend, gradient = false, className = '' }: StatCardProps) {
  return (
    <div className={`stat-card ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="stat-label">{label}</div>
        {icon && <div className="text-2xl opacity-80">{icon}</div>}
      </div>
      <div className={gradient ? 'stat-value-gradient' : 'stat-value'}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {trend && (
        <div className={`flex items-center gap-2 mt-2 text-sm ${
          trend.isPositive ? 'text-emerald-600' : 'text-red-500'
        }`}>
          <span>{trend.isPositive ? '↑' : '↓'}</span>
          <span>{Math.abs(trend.value)}%</span>
          <span className="text-gray-400">vs last month</span>
        </div>
      )}
    </div>
  );
}
