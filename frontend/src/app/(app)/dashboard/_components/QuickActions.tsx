'use client';

import Link from 'next/link';

interface QuickAction {
  path: string;
  icon: string;
  title: string;
  description: string;
  gradient: string;
  accent: string;
}

const ACTIONS: QuickAction[] = [
  {
    path: '/harvest',
    icon: '\ud83d\udcb0',
    title: 'Harvest Losses',
    description: 'Execute tax loss harvesting on your portfolio',
    gradient: 'from-emerald-500 to-teal-500',
    accent: 'text-emerald-500',
  },
  {
    path: '/portfolio',
    icon: '\ud83d\udcbc',
    title: 'View Portfolio',
    description: 'See your cost basis and transaction history',
    gradient: 'from-emerald-500 to-cyan-500',
    accent: 'text-emerald-500',
  },
  {
    path: '/reports',
    icon: '\ud83d\udccb',
    title: 'Tax Reports',
    description: 'Generate IRS-compliant tax forms',
    gradient: 'from-teal-500 to-cyan-500',
    accent: 'text-emerald-500',
  },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {ACTIONS.map((action) => (
        <Link key={action.path} href={action.path}>
          <div className="card-premium group cursor-pointer hover:shadow-emerald-500/10 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${action.gradient} flex items-center justify-center text-2xl font-bold text-white shadow-lg group-hover:scale-110 transition-transform duration-500`}
              >
                {action.icon}
              </div>
              <span className={`${action.accent} opacity-0 group-hover:opacity-100 transition-opacity`}>
                &rarr;
              </span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{action.title}</h3>
            <p className="text-gray-500 text-sm">{action.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
