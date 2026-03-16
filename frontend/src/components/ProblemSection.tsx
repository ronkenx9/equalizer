"use client";
import { useEffect, useRef, useState } from "react";

const TWEET_TEXT = `I designed a full brand identity for this guy. Logo, colors, typography, social templates. He said "send me the files and I'll pay you." I sent them. He blocked me. Then I saw my designs on his new website. Tagged him. He deleted everything and made a new account.`;

const HIGHLIGHT_WORDS = ["blocked", "deleted", "new account"];

export default function ProblemSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visibleChars, setVisibleChars] = useState(0);
  const [showHighlights, setShowHighlights] = useState(false);
  const [showCloser, setShowCloser] = useState(false);
  const triggered = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered.current) {
          triggered.current = true;
          // Type out the tweet character by character
          let i = 0;
          const interval = setInterval(() => {
            i++;
            setVisibleChars(i);
            if (i >= TWEET_TEXT.length) {
              clearInterval(interval);
              // After typing, highlight dangerous words
              setTimeout(() => setShowHighlights(true), 500);
              setTimeout(() => setShowCloser(true), 1500);
            }
          }, 25);
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  function renderTweet() {
    const displayed = TWEET_TEXT.slice(0, visibleChars);
    if (!showHighlights) {
      return <span>{displayed}</span>;
    }

    const result = displayed;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;

    HIGHLIGHT_WORDS.forEach((word) => {
      const idx = result.toLowerCase().indexOf(word.toLowerCase(), lastIdx);
      if (idx !== -1) {
        parts.push(<span key={`pre-${word}`}>{result.slice(lastIdx, idx)}</span>);
        parts.push(
          <span key={word} className="text-danger font-medium bg-danger/10 px-1 transition-all duration-500">
            {result.slice(idx, idx + word.length)}
          </span>
        );
        lastIdx = idx + word.length;
      }
    });
    parts.push(<span key="end">{result.slice(lastIdx)}</span>);
    return <>{parts}</>;
  }

  return (
    <section
      id="problem"
      ref={sectionRef}
      className="relative min-h-screen flex items-center justify-center py-32 px-6"
    >
      <div className="max-w-3xl mx-auto">
        {/* Tweet container */}
        <div className="border border-muted/30 rounded-none p-8 md:p-12 bg-surface/50">
          {/* Tweet header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center">
              <span className="font-mono text-xs text-text-secondary">LC</span>
            </div>
            <div>
              <p className="font-sans text-sm font-medium text-text-primary">@Layi_crypt_</p>
              <p className="font-mono text-[10px] text-text-secondary">Creator · Designer</p>
            </div>
          </div>

          {/* Tweet text */}
          <p className="font-sans text-lg md:text-xl leading-relaxed text-text-primary/90 min-h-[180px]">
            {renderTweet()}
            {visibleChars < TWEET_TEXT.length && (
              <span className="inline-block w-0.5 h-5 bg-amber ml-0.5 animate-pulse" />
            )}
          </p>
        </div>

        {/* Closing line */}
        <div
          className="mt-16 text-center transition-all duration-1000"
          style={{
            opacity: showCloser ? 1 : 0,
            transform: `translateY(${showCloser ? 0 : 20}px)`,
          }}
        >
          <p className="font-serif text-2xl md:text-3xl text-text-primary">
            This happens every day.{" "}
            <span className="text-amber">EQUALIZER</span> ends it.
          </p>
        </div>
      </div>
    </section>
  );
}
