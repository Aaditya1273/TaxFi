// ─── Types ─────────────────────────────────────────────────────────────

export interface FAQItem {
  q: string;
  a: string;
}

export interface PricingTier {
  name: string;
  price: string;
  yearlyPrice: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  featured?: boolean;
  href: string;
}

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  avatar: string;
  saved: string;
}

export interface Stat {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
}

export interface Feature {
  icon: string;
  title: string;
  description: string;
  gradient: string;
}

export interface Step {
  number: string;
  title: string;
  description: string;
  icon: string;
}

export interface NavLink {
  label: string;
  href: string;
}

export interface SecurityItem {
  icon: string;
  title: string;
  desc: string;
}

export interface ComparisonRow {
  feature: string;
  taxfi: boolean | string;
  cointracker: boolean | string;
  koinly: boolean | string;
}

// ─── Navigation ────────────────────────────────────────────────────────

export const NAV_LINKS: NavLink[] = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

// ─── Stats ─────────────────────────────────────────────────────────────

export const STATS: Stat[] = [
  { value: 0, label: 'Transactions Classified', prefix: '' },
  { value: 0, label: 'Tax Savings Found ($K)', prefix: '$', suffix: 'K' },
  { value: 0, label: 'Classification Accuracy', suffix: '%' },
  { value: 0, label: 'Supported Chains' },
];

// ─── How It Works Steps ────────────────────────────────────────────────

export const STEPS: Step[] = [
  {
    number: '01',
    title: 'Connect Your Wallet',
    description:
      'Grant read-only ERC-7715 permission. Your wallet stays under your control — TaxFi can only read your transaction history, never move funds.',
    icon: '',
  },
  {
    number: '02',
    title: 'AI Scans Everything',
    description:
      'Our multi-agent pipeline ingests every transaction across Ethereum, Base, and Arbitrum, classifies each one with Venice AI, and builds your cost basis ledger in real time.',
    icon: '',
  },
  {
    number: '03',
    title: 'Save on Taxes Automatically',
    description:
      'TaxFi identifies harvestable losses, optimizes your cost basis method (HIFO), and generates IRS-ready forms. You pay only 5% of what we save you.',
    icon: '',
  },
];

// ─── Features ──────────────────────────────────────────────────────────

export const FEATURES: Feature[] = [
  {
    icon: '',
    title: 'Multi-Chain Ingestion',
    description: 'Scan every wallet across Ethereum, Base, and Arbitrum simultaneously. Covalent and Alchemy data sources with automatic fallback.',
    gradient: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    icon: '',
    title: 'Venice AI Classification',
    description: 'Privacy-first AI that categorizes every transaction — swaps, airdrops, staking, LP deposits, and 15+ other categories with confidence scoring.',
    gradient: 'from-purple-500/20 to-pink-500/20',
  },
  {
    icon: '',
    title: 'HIFO Cost Basis',
    description: 'Highest-In-First-Out (HIFO) minimizes gains by default. Switch between FIFO, LIFO, HIFO, or Specific ID — your choice, your savings.',
    gradient: 'from-emerald-500/20 to-teal-500/20',
  },
  {
    icon: '',
    title: 'Gasless Execution',
    description: 'Execute loss harvests without ETH. The 1Shot relayer pays gas in USDC — you never need to think about gas fees or bridging tokens.',
    gradient: 'from-amber-500/20 to-orange-500/20',
  },
  {
    icon: '',
    title: 'IRS-Ready Forms',
    description: 'Generate Form 8949, Schedule D, and Schedule 1 with one click. PDF exports with onchain SHA-256 hashing for an immutable audit trail.',
    gradient: 'from-rose-500/20 to-red-500/20',
  },
  {
    icon: '',
    title: 'Non-Custodial Security',
    description: 'ERC-7715 read-only permissions. Your private keys never leave your wallet. Revoke access anytime — full control, zero compromise.',
    gradient: 'from-indigo-500/20 to-blue-500/20',
  },
];

// ─── Pricing ───────────────────────────────────────────────────────────

export const PRICING: PricingTier[] = [
  {
    name: 'Free',
    price: '$0',
    yearlyPrice: '$0',
    period: 'per month',
    description: 'For light users exploring crypto tax',
    features: [
      '1,000 transactions/year',
      'US jurisdiction only',
      'Basic Form 8949',
      'FIFO basis method',
      'Community support',
    ],
    cta: 'Get Started',
    href: '/dashboard',
  },
  {
    name: 'Trader',
    price: '5%',
    yearlyPrice: '4%',
    period: 'of savings',
    description: 'Of tax savings — only when you save',
    features: [
      'Unlimited transactions',
      'All jurisdictions',
      'Full Form 8949 + Schedule D',
      'HIFO / FIFO / LIFO / SpecID',
      'Real-time loss detection',
      'One-tap harvest execution',
      'Priority support',
    ],
    featured: true,
    cta: 'Start Saving',
    href: '/dashboard',
  },
  {
    name: 'Pro',
    price: '$299',
    yearlyPrice: '$239',
    period: 'per year',
    description: 'Per year — for power users and CPAs',
    features: [
      'Everything in Trader',
      'CPA review portal',
      'Audit insurance',
      'Multi-year ledger history',
      'API access',
      'Slack / Discord alerts',
      'White-label exports',
    ],
    cta: 'Go Pro',
    href: '/dashboard',
  },
];

// ─── Testimonials ──────────────────────────────────────────────────────

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'Your testimonial could be here. Share your experience with TaxFi.',
    name: 'Your Name',
    role: 'Your Role',
    avatar: '',
    saved: '$0',
  },
  {
    quote:
      'Your testimonial could be here. Share your experience with TaxFi.',
    name: 'Your Name',
    role: 'Your Role',
    avatar: '',
    saved: '$0',
  },
  {
    quote:
      'Your testimonial could be here. Share your experience with TaxFi.',
    name: 'Your Name',
    role: 'Your Role',
    avatar: '',
    saved: '$0',
  },
];

// ─── FAQ ───────────────────────────────────────────────────────────────

export const FAQS: FAQItem[] = [
  {
    q: 'Is TaxFi non-custodial?',
    a: 'Yes. TaxFi uses ERC-7715 Advanced Permissions \u2014 you grant read-only access to your transaction history. We never have access to your private keys and cannot move your funds. Revoke access anytime from your wallet.',
  },
  {
    q: 'How does the 5% fee work?',
    a: 'You only pay when TaxFi saves you money. If we identify and execute a tax loss harvest that saves you $1,000, our fee is $50 (5%). If there are no savings, you pay nothing. No subscriptions, no hidden fees.',
  },
  {
    q: 'What chains do you support?',
    a: 'Ethereum, Base, and Arbitrum are supported at launch. We use Covalent and Alchemy as data sources with automatic fallback \u2014 if one provider is down, the other takes over seamlessly.',
  },
  {
    q: 'How do you classify transactions?',
    a: 'Every transaction is analyzed by Venice AI \u2014 a privacy-first inference API that runs in TEE environments. Your transaction data never trains public models and prompts are never stored. We support 20+ categories including swaps, airdrops, staking, LP events, and more.',
  },
  {
    q: 'Do I need ETH for gas?',
    a: 'No. TaxFi uses the 1Shot permissionless relayer. Gas is paid in USDC from the harvested proceeds. You never need to hold ETH, bridge tokens, or think about gas fees at any point.',
  },
  {
    q: 'Is this tax advice?',
    a: 'No. TaxFi generates reports based on your transaction data using the cost basis method you select. We are not a CPA or tax attorney. Always consult a qualified tax professional before filing. Our onchain attestation creates an immutable audit trail your CPA can verify.',
  },
];

// ─── Comparison Table ──────────────────────────────────────────────────

export const COMPETITIVE_ADVANTAGES: ComparisonRow[] = [
  { feature: 'Non-custodial', taxfi: true, cointracker: false, koinly: false },
  { feature: 'Agentic / Real-time', taxfi: true, cointracker: false, koinly: false },
  { feature: 'Gasless (no ETH needed)', taxfi: true, cointracker: false, koinly: false },
  { feature: 'AI Transaction Classification', taxfi: true, cointracker: 'Partial', koinly: false },
  { feature: 'Tax Loss Harvesting', taxfi: true, cointracker: false, koinly: false },
  { feature: 'Pay Only on Savings', taxfi: true, cointracker: false, koinly: false },
  { feature: 'Onchain Audit Trail', taxfi: true, cointracker: false, koinly: false },
  { feature: 'ERC-7715 Permissions', taxfi: true, cointracker: false, koinly: false },
];

// ─── Security Items ────────────────────────────────────────────────────

export const SECURITY_ITEMS: SecurityItem[] = [
  {
    icon: '',
    title: 'ERC-7715 Permissions',
    desc: 'Granular, revocable permissions scoped by chain, address, and operation type. Your keys never leave your custody.',
  },
  {
    icon: '',
    title: 'Privacy-First AI',
    desc: 'Venice AI runs in TEE environments. Your transaction data never trains public models and prompts are never stored.',
  },
  {
    icon: '',
    title: 'Onchain Audit Trail',
    desc: 'Every form and harvest is SHA-256 hashed and anchored onchain for immutable verification by you or your CPA.',
  },
  {
    icon: '',
    title: 'Gasless via 1Shot',
    desc: 'All transactions are relayed through the 1Shot API. Gas paid in USDC from harvested proceeds \u2014 never ETH.',
  },
];

// ─── Dashboard Mockup Data ─────────────────────────────────────────────

export interface MockupCard {
  label: string;
  value: string;
  color: string;
}

export interface MockupRow {
  asset: string;
  cost: string;
  current: string;
  gl: string;
  loss: boolean;
}

export const MOCKUP_CARDS: MockupCard[] = [
  { label: 'Total Gains YTD', value: '$0', color: 'text-emerald-400' },
  { label: 'Harvestable Losses', value: '$0', color: 'text-cyan-400' },
  { label: 'Est. Tax Saved', value: '$0', color: 'text-emerald-400' },
];

export const MOCKUP_ROWS: MockupRow[] = [
  { asset: 'ETH', cost: '$0', current: '$0', gl: '$0', loss: false },
  { asset: 'UNI', cost: '$0', current: '$0', gl: '$0', loss: false },
  { asset: 'LINK', cost: '$0', current: '$0', gl: '$0', loss: false },
  { asset: 'AAVE', cost: '$0', current: '$0', gl: '$0', loss: false },
];
