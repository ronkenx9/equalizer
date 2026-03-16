import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function Scales3D({ isBalanced = false }: { isBalanced?: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const leftPanRef = useRef<THREE.Group>(null);
  const rightPanRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!groupRef.current || !beamRef.current) return;

    if (isBalanced) {
      beamRef.current.rotation.z = 0;
      return;
    }

    // Initial state: heavily tilted left
    const initialRotationZ = Math.PI / 6; // 30 degrees
    beamRef.current.rotation.z = initialRotationZ;

    // Setup ScrollTrigger for the scales
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '#hero-section',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
      }
    });

    tl.to(beamRef.current.rotation, {
      z: 0,
      ease: 'power2.inOut',
    });

    return () => {
      tl.kill();
    };
  }, [isBalanced]);

  useFrame((state) => {
    if (!groupRef.current || !beamRef.current || !leftPanRef.current || !rightPanRef.current) return;

    // Mouse parallax
    const targetRotationY = (state.mouse.x * Math.PI) / 12;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotationY, 0.1);

    // Keep pans horizontal by counter-rotating them
    const beamRotation = beamRef.current.rotation.z;
    leftPanRef.current.rotation.z = -beamRotation;
    rightPanRef.current.rotation.z = -beamRotation;
  });

  const materialProps = {
    color: '#ffffff',
    metalness: 0.9,
    roughness: 0.1,
    envMapIntensity: 1,
  };

  return (
    <group ref={groupRef} position={[0, 0, 0]} scale={0.8}>
      {/* Base */}
      <mesh position={[0, -4, 0]}>
        <cylinderGeometry args={[1.5, 2, 0.5, 32]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>

      {/* Central Pillar */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.4, 8, 32]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>

      {/* Beam Group */}
      <group ref={beamRef as React.RefObject<THREE.Group>} position={[0, 3.5, 0]}>
        {/* Main Beam */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 8, 16]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>

        {/* Left Pan */}
        <group ref={leftPanRef as React.RefObject<THREE.Group>} position={[-4, 0, 0]}>
          {/* Strings */}
          <mesh position={[0, -1.5, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 3, 8]} />
            <meshStandardMaterial color="#888" />
          </mesh>
          {/* Pan */}
          <mesh position={[0, -3, 0]}>
            <cylinderGeometry args={[1.5, 1.5, 0.1, 32]} />
            <meshStandardMaterial {...materialProps} />
          </mesh>
          {/* Amber Light */}
          <pointLight color="#D4A017" intensity={2} distance={10} position={[0, -2, 0]} />
        </group>

        {/* Right Pan */}
        <group ref={rightPanRef as React.RefObject<THREE.Group>} position={[4, 0, 0]}>
          {/* Strings */}
          <mesh position={[0, -1.5, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 3, 8]} />
            <meshStandardMaterial color="#888" />
          </mesh>
          {/* Pan */}
          <mesh position={[0, -3, 0]}>
            <cylinderGeometry args={[1.5, 1.5, 0.1, 32]} />
            <meshStandardMaterial {...materialProps} />
          </mesh>
          {/* Blue Light */}
          <pointLight color="#4A9EFF" intensity={2} distance={10} position={[0, -2, 0]} />
        </group>
      </group>
    </group>
  );
}
