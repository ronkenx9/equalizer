"use client";
import { useEffect, useRef, useState } from "react";

export default function CTASection() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="cta" ref={ref} className="relative min-h-screen flex items-center justify-center py-32 px-6">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-base via-surface/20 to-base pointer-events-none" />

      <div
        className={`relative z-10 text-center max-w-2xl mx-auto transition-all duration-1000 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
      >
        {/* Balanced scales icon (CSS version) */}
        <div className="flex items-center justify-center gap-8 mb-12">
          <div className="w-8 h-8 rounded-full border border-amber/40" />
          <div className="relative">
            <div className="w-24 h-px bg-text-secondary" />
            <div className="w-2 h-2 rounded-full bg-text-primary absolute -top-0.5 left-1/2 -translate-x-1/2" />
          </div>
          <div className="w-8 h-8 rounded-full border border-electric/40" />
        </div>

        <h2 className="font-serif text-4xl md:text-6xl mb-6">
          Add <span className="text-amber">EQUALIZER</span>
          <br />to your Telegram.
        </h2>

        <p className="font-sans text-text-secondary text-lg mb-12 max-w-lg mx-auto">
          The agent that turns handshakes into enforceable deals. 2.5% fee on completed work. That&apos;s it.
        </p>

        <a
          href="https://t.me/equalizer_agent_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-10 py-4 bg-amber text-base font-mono text-sm font-semibold tracking-wider hover:bg-amber/90 transition-all duration-300 hover:shadow-[0_0_40px_rgba(212,160,23,0.3)]"
        >
          LAUNCH BOT
        </a>

        <p className="font-mono text-xs text-text-secondary mt-8 tracking-wider">
          Also available for{" "}
          <span className="text-electric">Discord</span> ·{" "}
          <span className="text-text-primary">WhatsApp</span> ·{" "}
          <span className="text-text-secondary">Any DM</span> ·{" "}
          <span className="text-amber">Everywhere deals happen</span>
        </p>

        {/* Contract info */}
        <div className="mt-16 pt-8 border-t border-muted/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div>
              <p className="font-mono text-[10px] text-text-secondary tracking-wider mb-1">CONTRACT</p>
              <a
                href="https://sepolia.basescan.org/address/0x7a5c38be124c78da88D4C9F5ebEf72dC41869010"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-amber hover:underline"
              >
                0x7a5c...9010
              </a>
            </div>
            <div>
              <p className="font-mono text-[10px] text-text-secondary tracking-wider mb-1">NETWORK</p>
              <p className="font-mono text-xs text-electric">Base Sepolia</p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-text-secondary tracking-wider mb-1">FEE</p>
              <p className="font-mono text-xs text-resolve">2.5% on completed deals</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="font-mono text-[10px] text-muted tracking-wider">
          EQUALIZER © 2026 · MIT License ·{" "}
          <a href="https://github.com/ronkenx9/equalizer" target="_blank" rel="noopener noreferrer" className="hover:text-amber transition-colors">
            GitHub
          </a>
        </p>
      </div>
    </section>
  );
}
