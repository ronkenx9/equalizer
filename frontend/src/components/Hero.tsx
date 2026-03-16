import { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import { Scales3D } from './Scales3D';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/** Camera zoom-out from 70-100% scroll */
function CameraAnimator() {
  const { camera } = useThree();

  useEffect(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '#hero-section',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
      }
    });

    // Hold camera still 0-70%, then pull back 70-100%
    tl.to(camera.position, {
      z: 15,
      duration: 0.7,
    }, 0);
    tl.to(camera.position, {
      z: 17,
      duration: 0.3,
      ease: 'power1.out',
    }, 0.7);

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [camera]);

  return null;
}

export function Hero() {
  const textRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '#hero-section',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
      }
    });

    // Words fade in from 30-65% (before balance)
    if (textRef.current) {
      const words = textRef.current.querySelectorAll('.word');
      tl.fromTo(words,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, stagger: 0.08, duration: 0.35 },
        0.3
      );
    }

    // Line draws left-to-right at 70% (balance moment)
    if (lineRef.current) {
      tl.fromTo(lineRef.current,
        { scaleX: 0, opacity: 0 },
        { scaleX: 1, opacity: 1, duration: 0.1, ease: 'power2.out' },
        0.68
      );
    }

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, []);

  return (
    <section id="hero-section" className="relative h-[250vh] bg-base">
      <div className="sticky top-0 h-screen w-full overflow-hidden flex flex-col items-center justify-center">
        {/* 3D Canvas */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
            <Scales3D />
            <CameraAnimator />
            <Environment preset="city" />
            <ContactShadows position={[0, -4.5, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
          </Canvas>
        </div>

        {/* Overlay Content — headline sits at beam/pivot level (~45% from top) */}
        <div className="relative z-10 flex flex-col items-center w-full pointer-events-none" style={{ position: 'absolute', top: '42%', transform: 'translateY(-50%)' }}>
          <h1 ref={textRef} className="font-serif text-5xl md:text-7xl lg:text-8xl tracking-tight text-white mb-6 flex flex-wrap justify-center gap-4 text-center px-4">
            {['The', 'deal', 'that', 'actually', 'holds'].map((word, i) => (
              <span key={i} className="word opacity-0 inline-block">{word}</span>
            ))}
          </h1>

          <div ref={lineRef} className="w-48 h-px bg-amber-500 mx-auto opacity-0 origin-left" />
        </div>
      </div>
    </section>
  );
}
