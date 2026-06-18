/** ── SEO & Metadata Configuration ──────────────────────────────────── */

const SITE_NAME = 'TaxFi';
const SITE_DESCRIPTION = 'Your crypto tax agent that pays for itself. Non-custodial AI that scans every wallet, classifies transactions with privacy-first Venice AI, finds tax loss harvesting opportunities, and generates IRS-ready forms.';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://taxfi.app';
const TWITTER_HANDLE = '@taxfi';
const OG_IMAGE_URL = `${SITE_URL}/og-image.png`;

// ─── Default metadata shared across all routes ─────────────────────────

export const defaultMetadata = {
  applicationName: SITE_NAME,
  authors: [{ name: 'TaxFi Team' }],
  generator: 'Next.js',
  keywords: [
    'crypto tax',
    'cryptocurrency tax calculator',
    'tax loss harvesting',
    'DeFi tax',
    'Form 8949',
    'crypto tax software',
    'AI tax agent',
    'HIFO cost basis',
    'Ethereum tax',
    'Bitcoin tax',
    'IRS crypto reporting',
    'non-custodial tax',
    'Venice AI',
  ],
  referrer: 'origin-when-cross-origin' as const,
  creator: 'TaxFi',
  publisher: 'TaxFi',
  metadataBase: new URL(SITE_URL),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1 as const,
      'max-image-preview': 'large' as const,
      'max-snippet': -1 as const,
    },
  },
  openGraph: {
    type: 'website' as const,
    locale: 'en_US',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} \ ${'AI Crypto Tax Agent'}`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image' as const,
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: `${SITE_NAME} \ AI Crypto Tax Agent`,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE_URL],
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/safari-pinned-tab.svg', color: '#34d399' },
    ],
  },
  manifest: '/site.webmanifest',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent' as const,
    'apple-mobile-web-app-title': SITE_NAME,
    'application-name': SITE_NAME,
    'msapplication-TileColor': '#030712',
    'msapplication-config': '/browserconfig.xml',
  },
};

// ─── JSON-LD Schema Generators ────────────────────────────────────────

export interface JsonLdOptions {
  website?: boolean;
  organization?: boolean;
  webApplication?: boolean;
  faq?: boolean;
  product?: boolean;
}

/**
 * Generates a complete JSON-LD script block string for the landing page.
 */
export function generateJsonLdSchema(opts: JsonLdOptions = {}): string {
  const schemas: Record<string, unknown>[] = [];

  // ─── WebSite schema ──────────────────────────────────────────────────
  if (opts.website !== false) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      publisher: {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: {
          '@type': 'ImageObject',
          url: OG_IMAGE_URL,
          width: 1200,
          height: 630,
        },
      },
      inLanguage: 'en-US',
    });
  }

  // ─── Organization schema ─────────────────────────────────────────────
  if (opts.organization !== false) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
      },
      sameAs: [
        'https://twitter.com/taxfi',
        'https://github.com/taxfi',
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'support',
        email: 'support@taxfi.app',
        url: `${SITE_URL}/contact`,
      },
    });
  }

  // ─── WebApplication schema ───────────────────────────────────────────
  if (opts.webApplication !== false) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      '@id': `${SITE_URL}/#webapplication`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      browserRequirements: 'Requires a modern browser with MetaMask, Rainbow, or WalletConnect support.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Free tier available. Trader tier takes 5% of tax savings.',
      },
      featureList: [
        'Multi-chain transaction ingestion',
        'AI-powered transaction classification',
        'HIFO cost basis calculation',
        'Tax loss harvesting detection and execution',
        'IRS Form 8949 generation',
        'Gasless execution via 1Shot relayer',
        'Non-custodial ERC-7715 permissions',
      ],
    });
  }

  // ─── FAQ schema ─────────────────────────────────────────────────────
  if (opts.faq) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/#faq`,
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Is TaxFi non-custodial?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. TaxFi uses ERC-7715 Advanced Permissions \ you grant read-only access to your transaction history. We never have access to your private keys and cannot move your funds. Revoke access anytime from your wallet.',
          },
        },
        {
          '@type': 'Question',
          name: 'How does the 5% fee work?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'You only pay when TaxFi saves you money. If we identify and execute a tax loss harvest that saves you $1,000, our fee is $50 (5%). If there are no savings, you pay nothing. No subscriptions, no hidden fees.',
          },
        },
        {
          '@type': 'Question',
          name: 'What chains do you support?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Ethereum, Base, and Arbitrum are supported at launch. We use Covalent and Alchemy as data sources with automatic fallback \ if one provider is down, the other takes over seamlessly.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do I need ETH for gas?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'No. TaxFi uses the 1Shot permissionless relayer. Gas is paid in USDC from the harvested proceeds. You never need to hold ETH, bridge tokens, or think about gas fees at any point.',
          },
        },
        {
          '@type': 'Question',
          name: 'How do you classify transactions?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Every transaction is analyzed by Venice AI \ a privacy-first inference API that runs in TEE environments. Your transaction data never trains public models and prompts are never stored. We support 20+ categories including swaps, airdrops, staking, LP events, and more.',
          },
        },
      ],
    });
  }

  // ─── SoftwareApplication schema ──────────────────────────────────────
  if (opts.product) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#softwareapplication`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'USD',
        lowPrice: '0',
        highPrice: '299',
        offerCount: '3',
        offers: [
          { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD' },
          { '@type': 'Offer', name: 'Trader', price: '0', priceCurrency: 'USD', description: '5% of tax savings' },
          { '@type': 'Offer', name: 'Pro', price: '299', priceCurrency: 'USD', description: 'Per year' },
        ],
      },
    });
  }

  // If only one schema, return it directly; otherwise return as @graph
  if (schemas.length === 1) {
    return JSON.stringify(schemas[0], null, 2);
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': schemas }, null, 2);
}

// ─── Route-specific metadata generators ────────────────────────────────

export function getLandingPageMetadata() {
  return {
    title: `${SITE_NAME} \ AI Crypto Tax Agent That Pays for Itself`,
    description: SITE_DESCRIPTION,
    alternates: {
      canonical: SITE_URL,
    },
    openGraph: {
      title: `${SITE_NAME} \ AI Crypto Tax Agent That Pays for Itself`,
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      images: [
        {
          url: OG_IMAGE_URL,
          width: 1200,
          height: 630,
          alt: 'TaxFi \ Your crypto tax agent that pays for itself',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image' as const,
      site: TWITTER_HANDLE,
      creator: TWITTER_HANDLE,
      title: `${SITE_NAME} \ AI Crypto Tax Agent That Pays for Itself`,
      description: SITE_DESCRIPTION,
      images: [OG_IMAGE_URL],
    },
  };
}
