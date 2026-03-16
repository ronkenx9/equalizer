"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const ScalesScene = dynamic(() => import("./three/ScalesScene"), { ssr: false });

export default function HeroSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [textReveal, setTextReveal] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const onScroll = () => {
      const rect = section.getBoundingClientRect();
      const sectionHeight = section.offsetHeight - window.innerHeight;
      const progress = Math.max(0, Math.min(1, -rect.top / sectionHeight));
      setScrollProgress(progress);
      setTextReveal(progress);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const words = ["The", "deal", "that", "actually", "holds."];

  return (
    <section
      ref={sectionRef}
      className="relative"
      style={{ height: "300vh" }}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* 3D Scales */}
        <div className="absolute inset-0 z-0">
          <ScalesScene scrollProgress={scrollProgress} />
        </div>

        {/* Content overlay */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center px-6">
          {/* Main headline — words reveal based on scroll */}
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-center leading-tight mb-8">
            {words.map((word, i) => (
              <span
                key={i}
                className="inline-block mr-4 transition-all duration-700"
                style={{
                  opacity: textReveal > (i / words.length) * 0.7 ? 1 : 0,
                  transform: `translateY(${textReveal > (i / words.length) * 0.7 ? 0 : 30}px)`,
                }}
              >
                {word === "actually" ? (
                  <span className="text-amber">{word}</span>
                ) : word === "holds." ? (
                  <span className="text-electric">{word}</span>
                ) : (
                  word
                )}
              </span>
            ))}
          </h1>

          {/* Subtitle */}
          <p
            className="font-mono text-sm md:text-base text-text-secondary max-w-xl text-center transition-all duration-700"
            style={{
              opacity: textReveal > 0.5 ? 1 : 0,
              transform: `translateY(${textReveal > 0.5 ? 0 : 20}px)`,
            }}
          >
            An AI agent that lives in your conversations. Locks payment in
            onchain escrow. Evaluates delivery. Releases funds autonomously.
          </p>

          {/* Equilibrium line indicator */}
          <div
            className="absolute bottom-32 left-1/2 -translate-x-1/2 transition-all duration-1000"
            style={{
              opacity: scrollProgress > 0.85 ? 1 : 0,
              width: scrollProgress > 0.85 ? "200px" : "0px",
            }}
          >
            <div className="h-px bg-amber" />
            <p className="font-mono text-[10px] text-amber text-center mt-2 tracking-[0.3em]">
              EQUILIBRIUM
            </p>
          </div>

          {/* Scroll indicator */}
          <div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 transition-opacity duration-500"
            style={{ opacity: scrollProgress < 0.1 ? 1 : 0 }}
          >
            <div className="flex flex-col items-center gap-2">
              <span className="font-mono text-[10px] text-text-secondary tracking-[0.3em]">SCROLL</span>
              <div className="w-px h-8 bg-gradient-to-b from-text-secondary to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
