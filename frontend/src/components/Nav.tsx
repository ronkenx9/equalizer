
const NAV_BG = '#1C1814';

export function Nav() {
  return (
    <nav
      className="absolute left-0 w-full z-40 py-3"
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
          <a href="#live-feed" className="hover:text-blue-500 transition-colors">Live Feed</a>
          <a href="#reputation" className="hover:text-green-500 transition-colors">Reputation</a>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-4">
          <a
            href="https://t.me/equalizer_agent_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono uppercase tracking-widest transition-all duration-300 whitespace-nowrap"
            style={{
              border: '0.5px solid #D4A017',
              color: '#D4A017',
              background: 'transparent',
              fontSize: '11px',
              padding: '8px 16px',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(212,160,23,0.1)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            Add to Telegram &rarr;
          </a>
          <a
            href="https://discord.com/oauth2/authorize?client_id=1483076054984822946"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono uppercase tracking-widest transition-all duration-300 hidden sm:inline-block whitespace-nowrap"
            style={{
              border: '0.5px solid #5865F2',
              color: '#5865F2',
              background: 'transparent',
              fontSize: '11px',
              padding: '8px 16px',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(88,101,242,0.1)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            Add to Discord &rarr;
          </a>
        </div>
      </div>
    </nav>
  );
}
