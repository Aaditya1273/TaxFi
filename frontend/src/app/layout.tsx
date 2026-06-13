import type { Metadata, Viewport } from 'next';
import { Providers } from '../providers';
import '../index.css';
import { defaultMetadata } from '../lib/seo';

export const metadata: Metadata = {
  ...defaultMetadata,
  title: {
    default: 'TaxFi \u2014 AI Crypto Tax Agent That Pays for Itself',
    template: '%s | TaxFi',
  },
  icons: {
    icon: '/taxfi-icon.svg',
    shortcut: '/taxfi-icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* Preload hero image / critical assets */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
      </head>
      <body className="font-display antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
