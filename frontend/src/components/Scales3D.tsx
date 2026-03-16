import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/** Gold weight cube — slowly rotates, morphs to sphere at balance */
function Weight({ balanced }: { balanced: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const cubeRef = useRef<THREE.Mesh>(null);
  const sphereRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
  });

  // Morph: cube fades out, sphere fades in
  useEffect(() => {
    if (!cubeRef.current || !sphereRef.current) return;
    if (balanced) {
      gsap.to(cubeRef.current.scale, { x: 0, y: 0, z: 0, duration: 0.8, ease: 'power2.inOut' });
      gsap.to(sphereRef.current.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'power2.inOut', delay: 0.2 });
    } else {
      cubeRef.current.scale.set(1, 1, 1);
      sphereRef.current.scale.set(0, 0, 0);
    }
  }, [balanced]);

  const mat = { color: '#D4A017', metalness: 0.95, roughness: 0.05 };

  return (
    <group ref={groupRef} position={[0, -2.2, 0]}>
      <mesh ref={cubeRef}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh ref={sphereRef} scale={[0, 0, 0]}>
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshStandardMaterial {...mat} />
      </mesh>
    </group>
  );
}

/** Feather — spine + barbs fanning out, gentle oscillation */
function Feather({ balanced }: { balanced: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const frozenRef = useRef(false);

  useEffect(() => {
    frozenRef.current = balanced;
  }, [balanced]);

  useFrame(({ clock }) => {
    if (groupRef.current && !frozenRef.current) {
      // Gentle oscillation ±4 degrees, period ~3s
      groupRef.current.rotation.z = Math.sin(clock.elapsedTime * (2 * Math.PI / 3)) * (4 * Math.PI / 180);
    } else if (groupRef.current && frozenRef.current) {
      // Lerp to still
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, 0.05);
    }
  });

  const barbMat = { color: '#E8E4D9', metalness: 0.0, roughness: 0.9 };
  const spineMat = { color: '#D4CFC0', metalness: 0.1, roughness: 0.8 };

  // Build barbs: 6 pairs fanning left/right from spine
  const barbs = [];
  for (let i = 0; i < 6; i++) {
    const yPos = -0.5 + i * 0.18;
    const angle = 0.35 + i * 0.03; // slight fan
    const scale = 0.6 + (i < 3 ? i * 0.15 : (5 - i) * 0.15); // wider in middle

    // Left barb
    barbs.push(
      <mesh key={`l${i}`} position={[-0.15, yPos, 0]} rotation={[0, 0, angle]} scale={[scale, 0.08, 0.02]}>
        <planeGeometry args={[0.5, 1]} />
        <meshStandardMaterial {...barbMat} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
    );
    // Right barb
    barbs.push(
      <mesh key={`r${i}`} position={[0.15, yPos, 0]} rotation={[0, 0, -angle]} scale={[scale, 0.08, 0.02]}>
        <planeGeometry args={[0.5, 1]} />
        <meshStandardMaterial {...barbMat} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
    );
  }

  return (
    <group ref={groupRef} position={[0, -2.2, 0]}>
      {/* Spine */}
      <mesh>
        <coneGeometry args={[0.06, 1.4, 8]} />
        <meshStandardMaterial {...spineMat} />
      </mesh>
      {/* Barbs */}
      {barbs}
    </group>
  );
}

export function Scales3D({ isBalanced = false }: { isBalanced?: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const leftPanRef = useRef<THREE.Group>(null);
  const rightPanRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Group>(null);
  const balanceLightRef = useRef<THREE.PointLight>(null);
  const [atBalance, setAtBalance] = useState(false);

  useEffect(() => {
    if (!groupRef.current || !beamRef.current) return;

    if (isBalanced) {
      beamRef.current.rotation.z = 0;
      setAtBalance(true);
      return;
    }

    // Initial state: tilted left (weight side down) — 28 degrees
    const initialTilt = -28 * (Math.PI / 180);
    beamRef.current.rotation.z = initialTilt;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '#hero-section',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
      }
    });

    // Beam balances over first 70% of scroll
    tl.to(beamRef.current.rotation, {
      z: 0,
      duration: 0.7,
      ease: 'power2.inOut',
    }, 0);

    // Trigger balance state at 70%
    tl.call(() => setAtBalance(true), [], 0.7);
    // Undo if scrolling back
    tl.call(() => setAtBalance(false), [], 0.65);

    // Green balance pulse at 70%
    if (balanceLightRef.current) {
      tl.to(balanceLightRef.current, {
        intensity: 3,
        duration: 0.05,
        ease: 'power2.in',
      }, 0.67);
      tl.to(balanceLightRef.current, {
        intensity: 0,
        duration: 0.1,
        ease: 'power2.out',
      }, 0.72);
    }

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [isBalanced]);

  useFrame((state) => {
    if (!groupRef.current || !beamRef.current || !leftPanRef.current || !rightPanRef.current) return;

    // Mouse parallax — max 0.3 radians, lerp 0.05
    const targetRotationY = state.mouse.x * 0.15;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetRotationY,
      0.05
    );

    // Keep pans horizontal
    const beamRotation = beamRef.current.rotation.z;
    leftPanRef.current.rotation.z = -beamRotation;
    rightPanRef.current.rotation.z = -beamRotation;
  });

  const scaleMat = {
    color: '#ffffff',
    metalness: 0.9,
    roughness: 0.1,
    envMapIntensity: 1,
  };

  return (
    <group ref={groupRef} position={[0, 0, 0]} scale={0.8}>
      {/* Lighting */}
      <ambientLight color="#0A0A20" intensity={0.4} />
      <directionalLight color="#FFFFFF" intensity={0.6} position={[2, 4, 3]} />

      {/* Balance pulse light (green, center) */}
      <pointLight
        ref={balanceLightRef}
        color="#3DB87A"
        intensity={0}
        distance={15}
        position={[0, 0, 2]}
      />

      {/* Base */}
      <mesh position={[0, -4, 0]}>
        <cylinderGeometry args={[1.5, 2, 0.5, 32]} />
        <meshStandardMaterial {...scaleMat} />
      </mesh>

      {/* Central Pillar */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.4, 8, 32]} />
        <meshStandardMaterial {...scaleMat} />
      </mesh>

      {/* Beam Group */}
      <group ref={beamRef as React.RefObject<THREE.Group>} position={[0, 3.5, 0]}>
        {/* Main Beam */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 8, 16]} />
          <meshStandardMaterial {...scaleMat} />
        </mesh>

        {/* Left Pan — Weight */}
        <group ref={leftPanRef as React.RefObject<THREE.Group>} position={[-4, 0, 0]}>
          <mesh position={[0, -1.5, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 3, 8]} />
            <meshStandardMaterial color="#888" />
          </mesh>
          <mesh position={[0, -3, 0]}>
            <cylinderGeometry args={[1.5, 1.3, 0.4, 32]} />
            <meshStandardMaterial {...scaleMat} />
          </mesh>
          <mesh position={[0, -2.8, 0]}>
            <torusGeometry args={[1.5, 0.06, 16, 32]} />
            <meshStandardMaterial {...scaleMat} />
          </mesh>
          <Weight balanced={atBalance} />
          <pointLight color="#D4A017" intensity={2} distance={4} position={[0, -1.2, 0]} />
        </group>

        {/* Right Pan — Feather */}
        <group ref={rightPanRef as React.RefObject<THREE.Group>} position={[4, 0, 0]}>
          <mesh position={[0, -1.5, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 3, 8]} />
            <meshStandardMaterial color="#888" />
          </mesh>
          <mesh position={[0, -3, 0]}>
            <cylinderGeometry args={[1.5, 1.3, 0.4, 32]} />
            <meshStandardMaterial {...scaleMat} />
          </mesh>
          <mesh position={[0, -2.8, 0]}>
            <torusGeometry args={[1.5, 0.06, 16, 32]} />
            <meshStandardMaterial {...scaleMat} />
          </mesh>
          <Feather balanced={atBalance} />
          <pointLight color="#4A9EFF" intensity={1.2} distance={4} position={[0, -1.2, 0]} />
        </group>
      </group>
    </group>
  );
}
