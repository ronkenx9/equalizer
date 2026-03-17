import { useState, useEffect } from 'react';

const NAV_BG = '#1C1814';

export function Nav() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed left-0 w-full z-40 transition-all duration-300 ${isScrolled ? 'py-2' : 'py-3'}`}
      style={{ backgroundColor: NAV_BG, top: '32px' }}
    >
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">

        {/* Logo — scales mark + wordmark */}
        <div className="flex items-center gap-3">
          <img
            src="/scales-mark.svg"
            alt="scales"
            style={{ height: '40px', width: 'auto', display: 'block' }}
          />
          <span
            className="font-serif text-xl tracking-widest uppercase"
            style={{ color: '#C9A95A', letterSpacing: '0.18em' }}
          >
            Equalizer
          </span>
        </div>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8 font-mono text-sm tracking-widest uppercase text-gray-400">
          <a href="#how-it-works" className="hover:text-amber-500 transition-colors">Protocol</a>
          <a href="#live-feed"    className="hover:text-blue-500 transition-colors">Live Feed</a>
          <a href="#reputation"   className="hover:text-green-500 transition-colors">Reputation</a>
        </div>

        {/* CTA */}
        <a
          href="https://t.me/equalizer_agent_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono uppercase tracking-widest transition-all duration-300"
          style={{
            border: '0.5px solid #D4A017',
            color: '#D4A017',
            background: 'transparent',
            fontSize: '12px',
            padding: '8px 20px',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(212,160,23,0.1)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          Add to Telegram &rarr;
        </a>
      </div>
    </nav>
  );
}
