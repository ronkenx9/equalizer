import { useState, useEffect } from 'react';

export function Nav() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-8 left-0 w-full z-40 transition-all duration-300 ${isScrolled ? 'bg-[#0D0D1A]/80 backdrop-blur-md py-4' : 'bg-transparent py-6'}`}>
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        <div className="font-serif text-2xl tracking-widest text-white">
          EQUALIZER
        </div>

        <div className="hidden md:flex items-center gap-8 font-mono text-sm tracking-widest uppercase text-gray-400">
          <a href="#how-it-works" className="hover:text-amber-500 transition-colors">Protocol</a>
          <a href="#live-feed" className="hover:text-blue-500 transition-colors">Live Feed</a>
          <a href="#reputation" className="hover:text-green-500 transition-colors">Reputation</a>
        </div>

        <button className="border border-amber-500/50 text-amber-500 px-6 py-2 font-mono text-xs uppercase tracking-widest hover:bg-amber-500 hover:text-base transition-all duration-300">
          Connect
        </button>
      </div>
    </nav>
  );
}
