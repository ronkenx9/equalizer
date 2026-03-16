import { useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import { Scales3D } from './Scales3D';
import { useMobile } from '../hooks/useMobile';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function CameraAnimator() {
  const { camera } = useThree();
  useEffect(() => {
    const tl = gsap.timeline({
      scrollTrigger: { trigger: '#hero-section', start: 'top top', end: 'bottom bottom', scrub: 1 }
    });
    tl.to(camera.position, { z: 15, duration: 0.7 }, 0);
    tl.to(camera.position, { z: 17, duration: 0.3, ease: 'power1.out' }, 0.7);
    return () => { tl.scrollTrigger?.kill(); tl.kill(); };
  }, [camera]);
  return null;
}

export function Hero() {
  const textRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const isMobile = useMobile();
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    const tl = gsap.timeline({
      scrollTrigger: { trigger: '#hero-section', start: 'top top', end: 'bottom bottom', scrub: 1 }
    });
    if (textRef.current) {
      const words = textRef.current.querySelectorAll('.word');
      tl.fromTo(words, { opacity: 0, y: 20 }, { opacity: 1, y: 0, stagger: 0.08, duration: 0.35 }, 0.3);
    }
    if (lineRef.current) {
      tl.fromTo(lineRef.current, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.1 }, 0.68);
    }
    return () => { tl.scrollTrigger?.kill(); tl.kill(); };
  }, []);

  return (
    <section id="hero-section" className={`relative bg-base ${isMobile ? 'h-[180vh]' : 'h-[250vh]'}`}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <div
          className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-700"
          style={{ opacity: canvasReady ? 1 : 0 }}
        >
          <Canvas
            camera={{ position: [0, 0, 15], fov: isMobile ? 55 : 45 }}
            dpr={isMobile ? 1 : [1, 2]}
            performance={{ min: 0.5 }}
            onCreated={() => setCanvasReady(true)}
          >
            <Scales3D mobile={isMobile} />
            <CameraAnimator />
            {isMobile ? (
              <ambientLight intensity={0.9} />
            ) : (
              <>
                <Environment preset="city" />
                <ContactShadows position={[0, -4.5, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
              </>
            )}
          </Canvas>
        </div>

        <div className="relative z-10 w-full pointer-events-none" style={{ position: 'absolute', top: '42%', transform: 'translateY(-50%)' }}>
          <h1 ref={textRef} className="font-serif text-3xl sm:text-5xl md:text-7xl lg:text-8xl tracking-tight text-white mb-6 flex flex-wrap justify-center gap-2 sm:gap-4 text-center px-4">
            {['The', 'deal', 'that', 'actually', 'holds'].map((word, i) => (
              <span key={i} className="word opacity-0 inline-block">{word}</span>
            ))}
          </h1>
          <div ref={lineRef} className="w-32 sm:w-48 h-px bg-amber-500 mx-auto opacity-0 origin-left" />
        </div>
      </div>
    </section>
  );
}
