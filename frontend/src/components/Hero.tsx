import { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { Scales3D } from './Scales3D';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function AnimatedLights() {
  const ambientLightRef = useRef<THREE.AmbientLight>(null);

  useEffect(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '#hero-section',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
      }
    });

    if (ambientLightRef.current) {
      const ambientColor = { r: 0.5, g: 0.6, b: 1.0 };
      const targetAmbientColor = { r: 1.0, g: 0.9, b: 0.8 };

      tl.to(ambientColor, {
        r: targetAmbientColor.r,
        g: targetAmbientColor.g,
        b: targetAmbientColor.b,
        duration: 1,
        onUpdate: () => {
          if (ambientLightRef.current) {
            ambientLightRef.current.color.setRGB(ambientColor.r, ambientColor.g, ambientColor.b);
          }
        }
      }, 0);
    }

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <>
      <ambientLight ref={ambientLightRef} intensity={0.5} color="#8099ff" />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
    </>
  );
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

    if (textRef.current) {
      const words = textRef.current.querySelectorAll('.word');
      tl.fromTo(words,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, stagger: 0.1, duration: 1 },
        0.5
      );
    }

    if (lineRef.current) {
      tl.fromTo(lineRef.current,
        { scaleX: 0, opacity: 0 },
        { scaleX: 1, opacity: 1, duration: 0.5 },
        0.8
      );

      const lineText = lineRef.current.nextElementSibling;
      if (lineText) {
        tl.fromTo(lineText,
          { opacity: 0 },
          { opacity: 1, duration: 0.5 },
          0.9
        );
      }
    }

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <section id="hero-section" className="relative h-[300vh] bg-base">
      <div className="sticky top-0 h-screen w-full overflow-hidden flex flex-col items-center justify-center">
        {/* 3D Canvas */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
            <AnimatedLights />
            <Scales3D />
            <Environment preset="city" />
            <ContactShadows position={[0, -4.5, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
          </Canvas>
        </div>

        {/* Overlay Content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full w-full pointer-events-none">
          <div className="absolute top-1/4 left-1/4 transform -translate-x-1/2 -translate-y-1/2 text-amber-500 font-mono text-sm tracking-widest opacity-50">
            BRAND
          </div>
          <div className="absolute top-1/4 right-1/4 transform translate-x-1/2 -translate-y-1/2 text-blue-500 font-mono text-sm tracking-widest opacity-50">
            CREATOR
          </div>

          <div className="mt-auto mb-32 text-center">
            <h1 ref={textRef} className="font-serif text-5xl md:text-7xl lg:text-8xl tracking-tight text-white mb-8 flex flex-wrap justify-center gap-4">
              {['The', 'deal', 'that', 'actually', 'holds'].map((word, i) => (
                <span key={i} className="word opacity-0 inline-block">{word}</span>
              ))}
            </h1>

            <div ref={lineRef} className="w-64 h-px bg-green-500 mx-auto opacity-0 origin-center" />
            <p className="mt-4 font-mono text-green-500 text-sm tracking-widest uppercase opacity-0">
              Equalizer Line
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
