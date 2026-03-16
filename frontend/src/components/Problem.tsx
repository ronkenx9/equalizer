import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function Problem() {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const finalLineRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !textRef.current || !finalLineRef.current) return;

    const chars = textRef.current.querySelectorAll('.char');
    const highlights = textRef.current.querySelectorAll('.highlight');

    // Pin the section for 200vh of scroll so the user has to read it
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top top',
        end: '+=200%',
        pin: true,
        scrub: 0.8,
      }
    });

    // 0–40%: characters type in
    tl.fromTo(chars,
      { opacity: 0 },
      { opacity: 1, stagger: 0.015, duration: 0.4, ease: 'none' },
      0
    );

    // 40–70%: danger words flash red
    tl.to(highlights, {
      color: '#FF6B6B',
      duration: 0.15,
      stagger: 0.08,
      ease: 'power2.inOut',
    }, 0.4);

    // 70–100%: closing statement slides up
    tl.fromTo(finalLineRef.current,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' },
      0.68
    );

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, []);

  const tweetText = "I delivered the assets. They blocked me, rugged the payment, and deleted their account.";
  const wordsToHighlight = ['blocked', 'rugged', 'deleted'];

  return (
    <section ref={sectionRef} className="h-screen bg-base">
      <div ref={stickyRef} className="h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-3xl w-full">
          <div className="mb-8 font-mono text-sm text-gray-500">@Layi_crypt_</div>

          <div ref={textRef} className="font-mono text-2xl md:text-4xl leading-relaxed text-gray-300 mb-16">
            {tweetText.split(' ').map((word, i) => {
              const isHighlight = wordsToHighlight.some(w => word.toLowerCase().includes(w));
              return (
                <span key={i} className={`inline-block mr-3 ${isHighlight ? 'highlight transition-colors duration-300' : ''}`}>
                  {word.split('').map((char, j) => (
                    <span key={j} className="char opacity-0">{char}</span>
                  ))}
                </span>
              );
            })}
          </div>

          <p ref={finalLineRef} className="font-serif text-3xl md:text-5xl text-white opacity-0">
            This happens every day. <span className="text-amber-500">EQUALIZER</span> ends it.
          </p>
        </div>
      </div>
    </section>
  );
}
