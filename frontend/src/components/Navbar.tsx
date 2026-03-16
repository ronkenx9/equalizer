"use client";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "nav-scrolled" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-amber rounded-full" />
          <span className="font-mono text-sm font-semibold tracking-[0.2em] text-text-primary">
            EQUALIZER
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#problem" className="font-mono text-xs text-text-secondary hover:text-amber transition-colors tracking-wider">
            PROBLEM
          </a>
          <a href="#how" className="font-mono text-xs text-text-secondary hover:text-amber transition-colors tracking-wider">
            PROTOCOL
          </a>
          <a href="#feed" className="font-mono text-xs text-text-secondary hover:text-amber transition-colors tracking-wider">
            LIVE
          </a>
          <a href="#reputation" className="font-mono text-xs text-text-secondary hover:text-amber transition-colors tracking-wider">
            REPUTATION
          </a>
        </div>
        <a
          href="#cta"
          className="px-4 py-2 border border-amber text-amber font-mono text-xs tracking-wider hover:bg-amber hover:text-base transition-all duration-300"
        >
          GET STARTED
        </a>
      </div>
    </nav>
  );
}
