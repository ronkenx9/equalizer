import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const stats = [
  { number: '1 in 2', label: 'invoices are currently overdue', color: '#D4A017' },
  { number: '$250B', label: 'creator economy — most unpaid on time', color: '#E8E4D9' },
  { number: '56%', label: 'of freelancers are owed money right now', color: '#4A9EFF' },
];

export function Stats() {
  const sectionRef = useRef<HTMLElement>(null);
  const statRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!sectionRef.current) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 80%',
        toggleActions: 'play none none reverse',
      },
    });

    statRefs.current.forEach((el, i) => {
      if (!el) return;
      const numEl = el.querySelector('.stat-number');
      const labelEl = el.querySelector('.stat-label');

      tl.fromTo(
        el,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' },
        i * 0.1
      );

      if (numEl) {
        tl.fromTo(
          numEl,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
          i * 0.1 + 0.1
        );
      }
      if (labelEl) {
        tl.fromTo(
          labelEl,
          { opacity: 0 },
          { opacity: 1, duration: 0.5, ease: 'power2.out' },
          i * 0.1 + 0.3
        );
      }
    });

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="w-full"
      style={{ backgroundColor: '#0A0A14', padding: '60px 40px' }}
    >
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-center gap-8 md:gap-0">
        {stats.map((stat, i) => (
          <div key={i} className="flex items-center w-full md:w-auto">
            <div
              ref={(el) => { statRefs.current[i] = el; }}
              className="flex-1 text-center px-6 md:px-12 py-4 opacity-0"
            >
              <div
                className="stat-number font-serif mb-3"
                style={{ fontSize: '48px', color: stat.color, lineHeight: 1.1 }}
              >
                {stat.number}
              </div>
              <div
                className="stat-label font-mono uppercase"
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.1em',
                  color: 'rgba(232,228,217,0.5)',
                  maxWidth: '200px',
                  margin: '0 auto',
                }}
              >
                {stat.label}
              </div>
            </div>

            {/* Vertical divider between stats — hidden on mobile, hidden after last */}
            {i < stats.length - 1 && (
              <>
                {/* Desktop vertical divider */}
                <div
                  className="hidden md:block"
                  style={{
                    width: '1px',
                    height: '60px',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    flexShrink: 0,
                  }}
                />
                {/* Mobile horizontal divider */}
                <div
                  className="md:hidden w-24 mx-auto"
                  style={{
                    height: '1px',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                  }}
                />
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
