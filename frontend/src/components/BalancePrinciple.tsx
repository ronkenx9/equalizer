import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Scales3D } from './Scales3D';

function BalancedScales() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
  });

  return (
    <group ref={groupRef} scale={1.2}>
      <Scales3D isBalanced={true} />
    </group>
  );
}

export function BalancePrinciple() {
  return (
    <section className="relative min-h-screen bg-base flex items-center justify-center overflow-hidden py-24">
      {/* Ghost 3D Background */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
        <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
          <ambientLight intensity={0.2} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={0.5} />
          <BalancedScales />
        </Canvas>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
        <h2 className="font-serif text-4xl md:text-6xl lg:text-7xl leading-tight text-white">
          "EQUALIZER doesn't pick a winner — it enforces what both parties already agreed to, before either had reason to lie."
        </h2>
      </div>
    </section>
  );
}
