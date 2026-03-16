"use client";
import { useEffect, useRef, useState } from "react";

interface ProfileCard {
  name: string;
  handle: string;
  deals: number;
  volume: string;
  rate: number;
  type: "creator" | "brand";
}

const CREATORS: ProfileCard[] = [
  { name: "Kai Chen", handle: "@designerKai", deals: 47, volume: "4.2 ETH", rate: 100, type: "creator" },
  { name: "Ana Reyes", handle: "@copywriterAna", deals: 31, volume: "1.8 ETH", rate: 97, type: "creator" },
  { name: "Marcos Silva", handle: "@devMarcos", deals: 23, volume: "8.5 ETH", rate: 100, type: "creator" },
];

const BRANDS: ProfileCard[] = [
  { name: "SynthDAO", handle: "@synthDAO", deals: 62, volume: "12.3 ETH", rate: 98, type: "brand" },
  { name: "Protocol X", handle: "@protocolX", deals: 28, volume: "5.1 ETH", rate: 100, type: "brand" },
  { name: "DeFi Alpha", handle: "@defiAlpha", deals: 44, volume: "9.7 ETH", rate: 95, type: "brand" },
];

function Card({ card, delay }: { card: ProfileCard; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), delay);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`card-tilt border border-muted/20 bg-surface/50 p-6 transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{ borderLeftWidth: "3px", borderLeftColor: card.type === "creator" ? "#D4A017" : "#4A9EFF" }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          card.type === "creator" ? "bg-amber/10" : "bg-electric/10"
        }`}>
          <span className={`font-mono text-xs font-semibold ${
            card.type === "creator" ? "text-amber" : "text-electric"
          }`}>
            {card.name.split(" ").map(n => n[0]).join("")}
          </span>
        </div>
        <div>
          <p className="font-sans text-sm font-medium text-text-primary">{card.name}</p>
          <p className={`font-mono text-[10px] ${card.type === "creator" ? "text-amber" : "text-electric"}`}>
            {card.handle}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="stat-number text-lg font-semibold text-text-primary">{card.deals}</p>
          <p className="font-mono text-[9px] text-text-secondary tracking-wider">DEALS</p>
        </div>
        <div>
          <p className="stat-number text-lg font-semibold text-text-primary">{card.volume}</p>
          <p className="font-mono text-[9px] text-text-secondary tracking-wider">VOLUME</p>
        </div>
        <div>
          <p className={`stat-number text-lg font-semibold ${card.rate === 100 ? "text-resolve" : "text-text-primary"}`}>
            {card.rate}%
          </p>
          <p className="font-mono text-[9px] text-text-secondary tracking-wider">
            {card.type === "creator" ? "DELIVERY" : "RELIABILITY"}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-px bg-muted/30 w-full relative">
        <div
          className={`h-px absolute top-0 left-0 ${card.type === "creator" ? "bg-amber" : "bg-electric"}`}
          style={{ width: `${card.rate}%` }}
        />
      </div>
    </div>
  );
}

export default function ReputationSection() {
  return (
    <section id="reputation" className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="font-mono text-[10px] text-text-secondary tracking-[0.4em] mb-4">
            ONCHAIN REPUTATION
          </p>
          <h2 className="font-serif text-3xl md:text-5xl">
            Trust you can <span className="text-resolve">verify</span>
          </h2>
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Creator column */}
          <div>
            <p className="font-mono text-xs text-amber tracking-[0.3em] mb-6 flex items-center gap-2">
              <span className="w-3 h-px bg-amber" />
              CREATORS
            </p>
            <div className="space-y-4">
              {CREATORS.map((c, i) => (
                <Card key={c.handle} card={c} delay={i * 200} />
              ))}
            </div>
          </div>

          {/* Brand column */}
          <div>
            <p className="font-mono text-xs text-electric tracking-[0.3em] mb-6 flex items-center gap-2">
              <span className="w-3 h-px bg-electric" />
              BRANDS
            </p>
            <div className="space-y-4">
              {BRANDS.map((b, i) => (
                <Card key={b.handle} card={b} delay={i * 200 + 100} />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom statement */}
        <div className="text-center mt-20">
          <p className="font-sans text-lg md:text-xl text-text-secondary max-w-2xl mx-auto">
            Your reputation travels with you.{" "}
            <span className="text-text-primary font-medium">Onchain. Forever.</span>{" "}
            No platform can take it.
          </p>
        </div>
      </div>
    </section>
  );
}
