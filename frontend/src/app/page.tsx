import type { Metadata } from 'next';
import LandingPage from './landing-page/page';
import JsonLd from './landing-page/components/JsonLd';
import { getLandingPageMetadata } from '../lib/seo';

export const metadata: Metadata = getLandingPageMetadata();

export default function Home() {
  return (
    <>
      <JsonLd faq webApplication product />
      <LandingPage />
    </>
  );
}
