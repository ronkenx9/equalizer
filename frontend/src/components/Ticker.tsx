import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const tickerItems = [
  "DEAL 0x8f...3a2 LOCKED (1.5 ETH)",
  "DEAL 0x2b...9c1 RESOLVED (5.0 ETH)",
  "DEAL 0x1a...4d5 EVALUATING (0.8 ETH)",
  "DEAL 0x9c...7e2 LOCKED (12.4 ETH)",
  "DEAL 0x4d...1f8 RESOLVED (3.2 ETH)",
  "DEAL 0x7e...2b4 DISPUTED (0.5 ETH)",
  "DEAL 0x3f...8a1 LOCKED (2.0 ETH)",
  "DEAL 0x5c...9d3 RESOLVED (8.1 ETH)",
];

export function Ticker() {
  const tickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tickerRef.current) return;

    const tl = gsap.timeline({ repeat: -1 });
    tl.to(tickerRef.current, {
      xPercent: -50,
      ease: "none",
      duration: 20
    });

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 w-full overflow-hidden py-2 z-50" style={{ backgroundColor: '#1C1814', borderBottom: '1px solid #2E2820', height: '32px' }}>
      <div ref={tickerRef} className="flex whitespace-nowrap font-mono text-xs tracking-widest uppercase text-gray-500">
        {[...tickerItems, ...tickerItems].map((item, i) => (
          <span key={i} className="mx-8 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${
              item.includes('RESOLVED') ? 'bg-green-500' :
              item.includes('DISPUTED') ? 'bg-red-500' :
              item.includes('LOCKED') ? 'bg-blue-500' : 'bg-amber-500'
            }`} />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
