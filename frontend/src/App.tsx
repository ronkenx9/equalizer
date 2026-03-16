import { lazy, Suspense } from 'react';
import { useMobile } from './hooks/useMobile';
import { ScrollProgress } from './components/ScrollProgress';
import { Nav } from './components/Nav';
import { Ticker } from './components/Ticker';
import { Problem } from './components/Problem';
import { LiveFeed } from './components/LiveFeed';
import { Reputation } from './components/Reputation';

// Lazy load heavy 3D sections — keeps initial bundle small
const Hero = lazy(() => import('./components/Hero').then(m => ({ default: m.Hero })));
const HowItWorks = lazy(() => import('./components/HowItWorks').then(m => ({ default: m.HowItWorks })));
const BalancePrinciple = lazy(() => import('./components/BalancePrinciple').then(m => ({ default: m.BalancePrinciple })));
const CTA = lazy(() => import('./components/CTA').then(m => ({ default: m.CTA })));
const Cursor = lazy(() => import('./components/Cursor').then(m => ({ default: m.Cursor })));

export default function App() {
  const isMobile = useMobile();

  return (
    <div className="bg-base min-h-screen text-white font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Custom cursor only on desktop */}
      {!isMobile && (
        <Suspense fallback={null}>
          <Cursor />
        </Suspense>
      )}
      <ScrollProgress />

      <Ticker />
      <Nav />

      <main>
        <Suspense fallback={<div className="h-screen bg-base" />}>
          <Hero />
        </Suspense>
        <Problem />
        <Suspense fallback={<div className="h-screen bg-base" />}>
          <HowItWorks />
        </Suspense>
        <LiveFeed />
        <Suspense fallback={null}>
          <BalancePrinciple />
        </Suspense>
        <Reputation />
        <Suspense fallback={null}>
          <CTA />
        </Suspense>
      </main>
    </div>
  );
}
