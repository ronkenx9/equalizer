import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const deals = [
  { id: '0x8f...3a2', type: 'creator', amount: '1.5 ETH', status: 'LOCKED', time: '47:59:12' },
  { id: '0x2b...9c1', type: 'brand', amount: '5.0 ETH', status: 'RESOLVED', time: '00:00:00' },
  { id: '0x1a...4d5', type: 'creator', amount: '0.8 ETH', status: 'EVALUATING', time: '23:14:05' },
  { id: '0x9c...7e2', type: 'brand', amount: '12.4 ETH', status: 'LOCKED', time: '12:45:33' },
  { id: '0x4d...1f8', type: 'creator', amount: '3.2 ETH', status: 'RESOLVED', time: '00:00:00' },
];

const dealWidths = [45, 100, 72, 28, 100];

export function LiveFeed() {
  const sectionRef = useRef<HTMLElement>(null);
  const countersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !countersRef.current) return;

    // Deal rows animation
    const rows = gsap.utils.toArray('.deal-row', sectionRef.current);
    rows.forEach((row: any) => {
      gsap.fromTo(row,
        { x: -100, opacity: 0 },
        {
          x: 0, opacity: 1,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: row,
            start: 'top 90%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    });

    // Counters animation
    const counters = countersRef.current.querySelectorAll('.counter-val');
    counters.forEach((counter) => {
      const targetVal = parseFloat(counter.getAttribute('data-val') || '0');
      const isDecimal = targetVal % 1 !== 0;
      const obj = { val: 0 };

      gsap.to(obj, {
        val: targetVal,
        duration: 2,
        ease: 'power1.out',
        scrollTrigger: {
          trigger: countersRef.current,
          start: 'top 80%',
          toggleActions: 'play none none reverse'
        },
        onUpdate: () => {
          counter.innerHTML = isDecimal ? obj.val.toFixed(1) : Math.floor(obj.val).toLocaleString();
        }
      });
    });

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <section ref={sectionRef} id="live-feed" className="py-24 bg-base border-y border-gray-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <h3 className="font-mono text-xs tracking-widest text-gray-400 uppercase">PROTOCOL LIVE</h3>
        </div>

        {/* Stats */}
        <div ref={countersRef} className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16 font-mono border-b border-gray-800 pb-12">
          <div>
            <div className="text-3xl text-white mb-2"><span className="counter-val" data-val="2841">2841</span></div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Deals</div>
          </div>
          <div>
            <div className="text-3xl text-white mb-2"><span className="counter-val" data-val="142.3">142.3</span> ETH</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Settled</div>
          </div>
          <div>
            <div className="text-3xl text-white mb-2"><span className="counter-val" data-val="98.7">98.7</span>%</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Auto-released</div>
          </div>
          <div>
            <div className="text-3xl text-white mb-2"><span className="counter-val" data-val="0">0</span></div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Funds Lost</div>
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-4 font-mono text-sm">
          <div className="grid grid-cols-4 md:grid-cols-5 gap-4 text-gray-500 pb-4 border-b border-gray-800/50 uppercase tracking-wider text-xs">
            <div>Deal ID</div>
            <div>Amount</div>
            <div className="hidden md:block">Status</div>
            <div className="col-span-2">Countdown</div>
          </div>

          {deals.map((deal, i) => (
            <div
              key={i}
              className={`deal-row grid grid-cols-4 md:grid-cols-5 gap-4 items-center py-4 border-l-2 pl-4 bg-gray-900/20 hover:bg-gray-900/40 transition-colors
                ${deal.status === 'RESOLVED' ? 'border-green-500' : deal.type === 'creator' ? 'border-amber-500' : 'border-blue-500'}`}
            >
              <div className="text-gray-300">{deal.id}</div>
              <div className="text-white">{deal.amount}</div>
              <div className={`hidden md:block ${deal.status === 'RESOLVED' ? 'text-green-500' : 'text-gray-400'}`}>
                {deal.status}
              </div>
              <div className="col-span-2 flex items-center gap-4">
                <div className="w-full h-1 bg-gray-800 rounded overflow-hidden">
                  <div
                    className={`h-full ${deal.status === 'RESOLVED' ? 'bg-green-500' : deal.type === 'creator' ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${dealWidths[i]}%` }}
                  />
                </div>
                <div className="w-20 text-right text-gray-400">{deal.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
