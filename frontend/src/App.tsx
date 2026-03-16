import { Cursor } from './components/Cursor';
import { ScrollProgress } from './components/ScrollProgress';
import { Nav } from './components/Nav';
import { Ticker } from './components/Ticker';
import { Hero } from './components/Hero';
import { Problem } from './components/Problem';
import { HowItWorks } from './components/HowItWorks';
import { LiveFeed } from './components/LiveFeed';
import { BalancePrinciple } from './components/BalancePrinciple';
import { Reputation } from './components/Reputation';
import { CTA } from './components/CTA';

export default function App() {
  return (
    <div className="bg-base min-h-screen text-white font-sans selection:bg-amber-500/30 selection:text-amber-200">
      <Cursor />
      <ScrollProgress />

      <Ticker />
      <Nav />

      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <LiveFeed />
        <BalancePrinciple />
        <Reputation />
        <CTA />
      </main>
    </div>
  );
}
