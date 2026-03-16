"use client";
import { useEffect, useRef, useState } from "react";

interface DealRow {
  id: string;
  brand: string;
  creator: string;
  amount: string;
  deliverable: string;
  status: "active" | "completed" | "disputed";
  timeLeft?: string;
  progress?: number;
}

const MOCK_DEALS: DealRow[] = [
  { id: "EQ-0041", brand: "@synthDAO", creator: "@designerKai", amount: "0.25 ETH", deliverable: "Brand Identity Package", status: "active", timeLeft: "14h 23m", progress: 40 },
  { id: "EQ-0040", brand: "@protocolX", creator: "@copywriterAna", amount: "0.08 ETH", deliverable: "Whitepaper Draft v2", status: "completed" },
  { id: "EQ-0039", brand: "@defiAlpha", creator: "@devMarcos", amount: "0.5 ETH", deliverable: "Smart Contract Audit", status: "completed" },
  { id: "EQ-0038", brand: "@nftLabs", creator: "@illustratorRen", amount: "0.12 ETH", deliverable: "PFP Collection (50 units)", status: "disputed" },
  { id: "EQ-0037", brand: "@web3mag", creator: "@writerSol", amount: "0.05 ETH", deliverable: "Feature Article", status: "completed" },
  { id: "EQ-0036", brand: "@fundDAO", creator: "@analystJin", amount: "0.3 ETH", deliverable: "Market Analysis Report", status: "active", timeLeft: "6h 12m", progress: 74 },
  { id: "EQ-0035", brand: "@startupXYZ", creator: "@devAlice", amount: "0.15 ETH", deliverable: "Landing Page Build", status: "completed" },
  { id: "EQ-0034", brand: "@communityDAO", creator: "@modBob", amount: "0.04 ETH", deliverable: "Community Guidelines Doc", status: "completed" },
];

const STATS = [
  { label: "DEALS", value: 2841, suffix: "" },
  { label: "SETTLED", value: 142.3, suffix: " ETH", decimals: 1 },
  { label: "AUTO-RELEASED", value: 98.7, suffix: "%", decimals: 1 },
  { label: "FUNDS LOST", value: 0, suffix: "" },
];

function AnimatedCounter({ target, suffix, decimals = 0 }: { target: number; suffix: string; decimals?: number }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const triggered = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered.current) {
          triggered.current = true;
          const start = performance.now();
          const duration = 2000;
          const step = (now: number) => {
            const elapsed = now - start;
            const p = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setValue(eased * target);
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="text-center">
      <div className="stat-number text-3xl md:text-4xl font-semibold text-text-primary">
        {decimals > 0 ? value.toFixed(decimals) : Math.floor(value).toLocaleString()}
        {suffix}
      </div>
    </div>
  );
}

export default function LiveFeedSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visibleRows, setVisibleRows] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Stagger deal rows
          let i = 0;
          const interval = setInterval(() => {
            i++;
            setVisibleRows(i);
            if (i >= MOCK_DEALS.length) clearInterval(interval);
          }, 150);
        }
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="feed" ref={sectionRef} className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-12">
          <div className="w-2 h-2 rounded-full bg-resolve animate-pulse-dot" />
          <span className="font-mono text-[10px] text-text-secondary tracking-[0.4em]">
            PROTOCOL LIVE
          </span>
        </div>

        {/* Deal feed */}
        <div className="border border-muted/20 bg-surface/30">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-muted/20 font-mono text-[10px] text-text-secondary tracking-wider">
            <div className="col-span-1">ID</div>
            <div className="col-span-2">BRAND</div>
            <div className="col-span-2">CREATOR</div>
            <div className="col-span-1">AMOUNT</div>
            <div className="col-span-3">DELIVERABLE</div>
            <div className="col-span-1">STATUS</div>
            <div className="col-span-2">WINDOW</div>
          </div>

          {/* Deal rows */}
          {MOCK_DEALS.map((deal, i) => (
            <div
              key={deal.id}
              className={`grid grid-cols-12 gap-4 px-6 py-4 border-b border-muted/10 font-mono text-xs transition-all duration-500 ${
                i < visibleRows ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"
              }`}
              style={{
                borderLeftWidth: "3px",
                borderLeftColor:
                  deal.status === "completed" ? "#3DB87A" :
                  deal.status === "disputed" ? "#FF6B6B" : "#D4A017",
              }}
            >
              <div className="col-span-1 text-text-secondary">{deal.id}</div>
              <div className="col-span-2 text-electric">{deal.brand}</div>
              <div className="col-span-2 text-amber">{deal.creator}</div>
              <div className="col-span-1 text-text-primary font-medium">{deal.amount}</div>
              <div className="col-span-3 text-text-secondary truncate">{deal.deliverable}</div>
              <div className="col-span-1">
                <span className={`px-2 py-0.5 text-[10px] ${
                  deal.status === "completed" ? "bg-resolve/10 text-resolve" :
                  deal.status === "disputed" ? "bg-danger/10 text-danger" :
                  "bg-amber/10 text-amber"
                }`}>
                  {deal.status.toUpperCase()}
                </span>
              </div>
              <div className="col-span-2">
                {deal.status === "active" && deal.progress !== undefined ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-muted/30 relative">
                      <div
                        className="countdown-bar absolute top-0 left-0 h-full"
                        style={{ width: `${deal.progress}%` }}
                      />
                    </div>
                    <span className="text-amber text-[10px]">{deal.timeLeft}</span>
                  </div>
                ) : deal.status === "completed" ? (
                  <span className="text-resolve text-[10px]">RELEASED</span>
                ) : (
                  <span className="text-danger text-[10px]">RULING PENDING</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 py-8 border-t border-b border-muted/20">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <AnimatedCounter target={stat.value} suffix={stat.suffix} decimals={stat.decimals} />
              <div className="font-mono text-[10px] text-text-secondary tracking-[0.3em] mt-2">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
