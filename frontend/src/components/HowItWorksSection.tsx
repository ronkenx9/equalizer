"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const StepIcon = dynamic(() => import("./three/StepIcon"), { ssr: false });

const STEPS = [
  {
    key: "detect" as const,
    label: "DETECT",
    description: "Agent reads your Telegram conversation. Spots the deal forming. Extracts terms, price, deadline, parties. Only triggers above 80% confidence.",
  },
  {
    key: "lock" as const,
    label: "LOCK",
    description: "Brand sends funds directly to the escrow contract. Agent never touches them. From this moment, no human controls the money.",
  },
  {
    key: "evaluate" as const,
    label: "EVALUATE",
    description: "Creator submits delivery. Agent reads it against the locked terms. Not quality — specificity. Did you deliver what you promised?",
  },
  {
    key: "release" as const,
    label: "RELEASE",
    description: "Silence = satisfied. 24 hours. No dispute? Auto-release fires. Permissionless. No chasing. No ghosting. Payment happens.",
  },
];

export default function HowItWorksSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      const rect = container.getBoundingClientRect();
      const sectionHeight = container.offsetHeight - window.innerHeight;
      const progress = Math.max(0, Math.min(1, -rect.top / sectionHeight));
      setActiveStep(Math.min(3, Math.floor(progress * 4)));
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section
      id="how"
      ref={containerRef}
      className="relative"
      style={{ height: "400vh" }}
    >
      <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden">
        {/* Header */}
        <div className="px-6 md:px-16 mb-12">
          <p className="font-mono text-[10px] text-text-secondary tracking-[0.4em] mb-2">
            HOW IT WORKS
          </p>
          <h2 className="font-serif text-3xl md:text-5xl">
            Four steps.{" "}
            <span className="text-amber">Zero trust required.</span>
          </h2>
        </div>

        {/* Steps - horizontal layout */}
        <div className="flex-1 flex items-center px-6 md:px-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 w-full">
            {STEPS.map((step, i) => (
              <div
                key={step.key}
                className={`transition-all duration-700 ${
                  i <= activeStep ? "opacity-100 translate-y-0" : "opacity-20 translate-y-8"
                }`}
              >
                {/* Step number */}
                <div className="font-mono text-[10px] text-text-secondary tracking-[0.3em] mb-4">
                  {String(i + 1).padStart(2, "0")}
                </div>

                {/* 3D Icon */}
                <div className={`mb-4 transition-all duration-500 ${i <= activeStep ? "scale-100" : "scale-75"}`}>
                  <StepIcon type={step.key} />
                </div>

                {/* Label */}
                <h3 className={`font-mono text-lg font-semibold mb-3 tracking-wider ${
                  step.key === "detect" ? "text-amber" :
                  step.key === "lock" ? "text-electric" :
                  step.key === "evaluate" ? "text-text-primary" :
                  "text-resolve"
                }`}>
                  {step.label}
                </h3>

                {/* Description */}
                <p className="font-sans text-sm text-text-secondary leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-6 md:px-16 pb-8">
          <div className="h-px bg-muted/30 w-full relative">
            <div
              className="h-px bg-amber absolute top-0 left-0 transition-all duration-500"
              style={{ width: `${((activeStep + 1) / 4) * 100}%` }}
            />
            <div className="flex justify-between mt-3">
              {STEPS.map((step, i) => (
                <span
                  key={i}
                  className={`font-mono text-[9px] tracking-wider transition-colors duration-300 ${
                    i <= activeStep ? "text-amber" : "text-muted"
                  }`}
                >
                  {step.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
