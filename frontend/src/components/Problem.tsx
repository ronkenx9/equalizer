import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const workerStory = {
  label: 'THE WORKER',
  color: '#D4A017',
  text: 'Won a contest. Prize was $200 for best promotion. Dev announces me as the winner. When I asked for the reward, suddenly it became $10 per post. Instead \u2014 blocked + project channels deleted and rugged the coin.',
  handle: '@Layi_crypt_',
  link: 'https://x.com/Layi_crypt_/status/2033085413439525373',
  highlights: ['blocked', 'deleted', 'rugged'],
};

const clientStory = {
  label: 'THE CLIENT',
  color: '#4A9EFF',
  text: 'Got ripped off after being paid for the service needed from @AMG_studio11 and expected him to deliver. He sent the sketch two days after 1st payment and asked for balance, which I did \u2014 hoping he\u2019s gonna deliver. Henceforth \u2014 nothing from him yet.',
  handle: '@unifyWeb3',
  link: 'https://x.com/unifyWeb3/status/2033616481506759161',
  highlights: ['ripped off', 'nothing from him yet'],
};

interface StoryProps {
  story: typeof workerStory;
  refEl: React.RefObject<HTMLDivElement | null>;
}

function StoryColumn({ story, refEl }: StoryProps) {
  return (
    <div
      ref={refEl}
      className="opacity-0 pl-5 py-2"
      style={{ borderLeft: `2px solid ${story.color}` }}
    >
      <div
        className="font-mono uppercase tracking-widest mb-4"
        style={{ fontSize: '11px', letterSpacing: '0.12em', color: story.color }}
      >
        {story.label}
      </div>

      <p className="font-mono text-base md:text-lg leading-relaxed text-gray-300 mb-4">
        {renderHighlightedText(story.text, story.highlights)}
      </p>

      <a
        href={story.link}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-sm hover:underline transition-colors"
        style={{ color: 'rgba(232,228,217,0.4)' }}
      >
        {story.handle}
      </a>
    </div>
  );
}

function renderHighlightedText(text: string, highlights: string[]) {
  // Build regex from highlight phrases
  const pattern = highlights.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const isHighlight = highlights.some(h => h.toLowerCase() === part.toLowerCase());
    if (isHighlight) {
      return (
        <span key={i} className="text-red-400 font-medium">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function Problem() {
  const sectionRef = useRef<HTMLElement>(null);
  const workerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 65%',
        toggleActions: 'play none none reverse',
      },
    });

    // Stagger the two columns
    if (workerRef.current) {
      tl.fromTo(
        workerRef.current,
        { opacity: 0, x: -30 },
        { opacity: 1, x: 0, duration: 0.7, ease: 'power2.out' },
        0
      );
    }
    if (clientRef.current) {
      tl.fromTo(
        clientRef.current,
        { opacity: 0, x: 30 },
        { opacity: 1, x: 0, duration: 0.7, ease: 'power2.out' },
        0.15
      );
    }

    // Closing text
    if (closingRef.current) {
      const headline = closingRef.current.querySelector('.closing-headline');
      const subtext = closingRef.current.querySelector('.closing-subtext');
      if (headline) {
        tl.fromTo(
          headline,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' },
          0.5
        );
      }
      if (subtext) {
        tl.fromTo(
          subtext,
          { opacity: 0 },
          { opacity: 1, duration: 0.6, ease: 'power2.out' },
          0.8
        );
      }
    }

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, []);

  return (
    <section ref={sectionRef} style={{ height: '200vh' }} className="bg-base relative">
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-5xl w-full">

          {/* Two-column stories */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-0 items-start">
            {/* Worker story */}
            <div className="md:pr-8">
              <StoryColumn story={workerStory} refEl={workerRef} />
            </div>

            {/* Vertical divider (desktop) / Horizontal divider (mobile) */}
            <div
              className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                width: '1px',
                height: '180px',
                backgroundColor: 'rgba(255,255,255,0.08)',
              }}
            />
            <div
              className="md:hidden w-full"
              style={{
                height: '1px',
                backgroundColor: 'rgba(255,255,255,0.08)',
              }}
            />

            {/* Client story */}
            <div className="md:pl-8">
              <StoryColumn story={clientStory} refEl={clientRef} />
            </div>
          </div>

          {/* Closing lines */}
          <div ref={closingRef} className="text-center mt-12 md:mt-16">
            <p
              className="closing-headline font-serif italic mb-3"
              style={{ fontSize: '24px', color: '#E8E4D9' }}
            >
              Both sides lose. Every day.
            </p>
            <p
              className="closing-subtext font-mono"
              style={{
                fontSize: '12px',
                color: 'rgba(232,228,217,0.4)',
                maxWidth: '480px',
                margin: '0 auto',
                lineHeight: 1.7,
              }}
            >
              It doesn't matter which side of the deal you're on. Without EQUALIZER, the other side always has the leverage.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
