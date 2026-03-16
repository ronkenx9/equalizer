"use client";
import { useEffect, useRef, useState } from "react";

export default function BalanceSection() {
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
    <section ref={ref} className="relative min-h-[70vh] flex items-center justify-center py-32 px-6">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-base via-surface/30 to-base pointer-events-none" />

      <div
        className={`relative z-10 max-w-4xl mx-auto text-center transition-all duration-1000 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        {/* Decorative line */}
        <div className="w-16 h-px bg-amber mx-auto mb-12" />

        <blockquote className="font-serif text-2xl md:text-4xl lg:text-5xl leading-snug text-text-primary">
          &ldquo;EQUALIZER doesn&rsquo;t pick a winner — it enforces what both
          parties{" "}
          <span className="text-amber">already agreed to</span>, before either
          had reason to lie.&rdquo;
        </blockquote>

        <div className="w-16 h-px bg-amber mx-auto mt-12" />

        <p className="font-mono text-xs text-text-secondary mt-8 tracking-[0.3em]">
          THE BALANCE PRINCIPLE
        </p>
      </div>
    </section>
  );
}
