'use client';

import Nav from './components/Nav';
import Hero from './components/Hero';
import Stats from './components/Stats';
import HowItWorks from './components/HowItWorks';
import DashboardMockup from './components/DashboardMockup';
import Features from './components/Features';
import Comparison from './components/Comparison';
import Testimonials from './components/Testimonials';
import Pricing from './components/Pricing';
import Security from './components/Security';
import FAQ from './components/FAQ';
import CTA from './components/CTA';
import Footer from './components/Footer';
import ScrollProgress from './components/animations/ScrollProgress';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-hidden">
      <ScrollProgress />
      <Nav />
      <Hero />
      <Stats />
      <HowItWorks />
      <DashboardMockup />
      <Features />
      <Comparison />
      <Testimonials />
      <Pricing />
      <Security />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}
