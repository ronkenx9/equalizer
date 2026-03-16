import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/** Gold weight cube — slowly rotates, stays a cube always */
function Weight() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
  });

  const mat = { color: '#D4A017', metalness: 0.95, roughness: 0.05 };

  return (
    <group ref={groupRef} position={[0, -2.2, 0]}>
      <mesh>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshStandardMaterial {...mat} />
      </mesh>
    </group>
  );
}

/** Feather — realistic wispy feather laying flat on pan */
function Feather({ balanced }: { balanced: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const frozenRef = useRef(false);

  useEffect(() => {
    frozenRef.current = balanced;
  }, [balanced]);

  useFrame(({ clock }) => {
    if (groupRef.current && !frozenRef.current) {
      groupRef.current.rotation.y = Math.sin(clock.elapsedTime * (2 * Math.PI / 3)) * (3 * Math.PI / 180);
    } else if (groupRef.current && frozenRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, 0.05);
    }
  });

  const barbCount = 24;
  const barbs = [];

  for (let i = 0; i < barbCount; i++) {
    const t = i / (barbCount - 1); // 0 to 1 along spine
    const spinePos = -1.6 + t * 3.2; // longer spine

    // Feather shape: narrow at base, widest at ~35%, tapers to tip
    const widthCurve = Math.sin(t * Math.PI) * (t < 0.35 ? t / 0.35 : 1) * (t > 0.85 ? (1 - t) / 0.15 : 1);
    const barbLength = 0.5 + widthCurve * 1.2;
    const barbAngle = 0.2 + t * 0.12;

    const opacity = 0.5 + widthCurve * 0.45;

    // Left barb
    barbs.push(
      <mesh key={`l${i}`} position={[-barbLength * 0.35, spinePos, 0]} rotation={[0, 0, barbAngle]}>
        <planeGeometry args={[barbLength, 0.05]} />
        <meshStandardMaterial
          color="#F5F0E8"
          side={THREE.DoubleSide}
          transparent
          opacity={opacity}
          metalness={0.0}
          roughness={0.9}
        />
      </mesh>
    );
    // Right barb
    barbs.push(
      <mesh key={`r${i}`} position={[barbLength * 0.35, spinePos, 0]} rotation={[0, 0, -barbAngle]}>
        <planeGeometry args={[barbLength, 0.05]} />
        <meshStandardMaterial
          color="#F5F0E8"
          side={THREE.DoubleSide}
          transparent
          opacity={opacity}
          metalness={0.0}
          roughness={0.9}
        />
      </mesh>
    );
  }

  // Wispy tips at the top
  for (let i = 0; i < 7; i++) {
    const t = 0.8 + i * 0.028;
    const spinePos = -1.6 + t * 3.2;
    const offset = (i % 2 === 0 ? -1 : 1) * (0.15 + i * 0.04);
    barbs.push(
      <mesh key={`w${i}`} position={[offset, spinePos, 0.01]} rotation={[0, 0, offset > 0 ? -0.25 : 0.25]}>
        <planeGeometry args={[0.35, 0.025]} />
        <meshStandardMaterial
          color="#FFFFFF"
          side={THREE.DoubleSide}
          transparent
          opacity={0.35}
          metalness={0.0}
          roughness={1.0}
        />
      </mesh>
    );
  }

  return (
    // Lay flat on pan: rotated 90deg on X so it's horizontal, slight Z rotation for natural angle
    <group ref={groupRef} position={[0.3, -2.65, 0.2]} rotation={[Math.PI / 2, 0, Math.PI / 6]}>
      {/* Spine — thin tapered quill, long */}
      <mesh>
        <cylinderGeometry args={[0.012, 0.04, 3.4, 8]} />
        <meshStandardMaterial color="#D4CFC0" metalness={0.15} roughness={0.7} />
      </mesh>
      {/* Barbs */}
      {barbs}
      {/* Soft glow underneath feather */}
      <pointLight color="#E8E4D9" intensity={0.8} distance={3} position={[0, 0, -0.5]} />
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
          <Weight />
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
