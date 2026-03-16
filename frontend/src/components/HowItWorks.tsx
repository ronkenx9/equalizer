import { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function DetectIcon() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.01;
      meshRef.current.rotation.y += 0.01;
    }
  });
  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1.5, 0]} />
      <meshStandardMaterial color="#D4A017" wireframe emissive="#D4A017" emissiveIntensity={0.5} />
    </mesh>
  );
}

function LockIcon() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x -= 0.01;
      meshRef.current.rotation.y += 0.01;
    }
  });
  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#4A9EFF" wireframe emissive="#4A9EFF" emissiveIntensity={0.5} />
    </mesh>
  );
}

function EvaluateIcon() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.02;
    }
  });
  return (
    <mesh ref={meshRef}>
      <octahedronGeometry args={[1.5, 0]} />
      <meshStandardMaterial color="#ffffff" wireframe emissive="#ffffff" emissiveIntensity={0.5} />
    </mesh>
  );
}

function ReleaseIcon() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const scale = 1 + Math.sin(clock.elapsedTime * 2) * 0.1;
      meshRef.current.scale.set(scale, scale, scale);
    }
  });
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.5, 16, 16]} />
      <meshStandardMaterial color="#3DB87A" wireframe emissive="#3DB87A" emissiveIntensity={0.5} />
    </mesh>
  );
}

const steps = [
  {
    id: '01',
    title: 'DETECT',
    description: 'Agent reads your Telegram conversation. Spots the deal forming.',
    icon: <DetectIcon />,
    color: 'text-amber-500'
  },
  {
    id: '02',
    title: 'LOCK',
    description: 'Brand sends funds directly to the escrow contract. Agent never touches them.',
    icon: <LockIcon />,
    color: 'text-blue-500'
  },
  {
    id: '03',
    title: 'EVALUATE',
    description: 'Creator submits delivery. Agent reads it against the locked terms. Not quality — specificity.',
    icon: <EvaluateIcon />,
    color: 'text-white'
  },
  {
    id: '04',
    title: 'RELEASE',
    description: 'Silence = satisfied. 48 hours. Auto-release fires. No chasing.',
    icon: <ReleaseIcon />,
    color: 'text-green-500'
  }
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !containerRef.current || !progressBarRef.current) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        pin: true,
        scrub: 1,
        end: () => "+=" + containerRef.current!.offsetWidth,
      }
    });

    tl.to(containerRef.current, {
      x: () => -(containerRef.current!.scrollWidth - window.innerWidth),
      ease: "none"
    });

    tl.to(progressBarRef.current, {
      scaleX: 1,
      ease: "none"
    }, 0);

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, []);

  return (
    <section ref={sectionRef} id="how-it-works" className="h-screen bg-base overflow-hidden relative flex flex-col">
      <div className="absolute top-12 left-12 z-10">
        <h2 className="font-serif text-4xl text-white">How It Works</h2>
      </div>

      <div ref={containerRef} className="flex h-full w-[400vw]">
        {steps.map((step) => (
          <div key={step.id} className="step-panel w-screen h-full flex items-center justify-center flex-shrink-0 relative">
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center px-12">
              <div className="h-64 md:h-96 relative pointer-events-none">
                <Canvas camera={{ position: [0, 0, 5] }}>
                  <ambientLight intensity={0.5} />
                  <pointLight position={[10, 10, 10]} />
                  {step.icon}
                </Canvas>
              </div>
              <div>
                <div className={`font-mono text-xl mb-4 ${step.color}`}>{step.id} // {step.title}</div>
                <p className="font-sans text-2xl text-gray-300 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-800">
        <div ref={progressBarRef} className="h-full bg-amber-500 origin-left scale-x-0" />
      </div>
    </section>
  );
}
