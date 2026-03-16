import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function Problem() {
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const finalLineRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !textRef.current || !finalLineRef.current) return;

    const chars = textRef.current.querySelectorAll('.char');
    const highlights = textRef.current.querySelectorAll('.highlight');

    // Play naturally when scrolled into view — not tied to scroll speed
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 65%',
        toggleActions: 'play none none reverse',
      }
    });

    tl.fromTo(chars,
      { opacity: 0 },
      { opacity: 1, stagger: 0.02, duration: 0.1, ease: 'none' }
    )
    .to(highlights, {
      color: '#FF6B6B',
      duration: 0.5,
      stagger: 0.2,
      ease: 'power2.inOut',
    })
    .fromTo(finalLineRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 1, ease: 'power2.out' },
      '+=0.5'
    );

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, []);

  const tweetText = "I delivered the assets. They blocked me, rugged the payment, and deleted their account.";
  const wordsToHighlight = ['blocked', 'rugged', 'deleted'];

  return (
    // 200vh tall — inner div CSS sticky so user must scroll through before moving on
    <section ref={sectionRef} style={{ height: '200vh' }} className="bg-base relative">
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center px-4">
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
