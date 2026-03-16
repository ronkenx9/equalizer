import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/** Gold ingot — wide, heavy, dense, slowly rotating */
function Weight() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
  });

  const mat = { color: '#D4A017', metalness: 0.98, roughness: 0.02 };
  const darkMat = { color: '#B8860B', metalness: 0.95, roughness: 0.05 };

  return (
    <group ref={groupRef} position={[0, -2.4, 0]}>
      {/* Main ingot body — wider than tall like a real gold bar */}
      <mesh>
        <boxGeometry args={[1.8, 0.6, 0.9]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* Engraved lines on top surface */}
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[1.4, 0.02, 0.05]} />
        <meshStandardMaterial {...darkMat} />
      </mesh>
      <mesh position={[0, 0.32, 0.2]}>
        <boxGeometry args={[1.4, 0.02, 0.05]} />
        <meshStandardMaterial {...darkMat} />
      </mesh>
      <mesh position={[0, 0.32, -0.2]}>
        <boxGeometry args={[1.4, 0.02, 0.05]} />
        <meshStandardMaterial {...darkMat} />
      </mesh>
      {/* Beveled edge highlights */}
      <mesh position={[0, -0.32, 0]}>
        <boxGeometry args={[1.9, 0.02, 1.0]} />
        <meshStandardMaterial {...darkMat} />
      </mesh>
    </group>
  );
}

/** Create a canvas texture of a feather — procedurally drawn */
function useFeatherTexture() {
  return useMemo(() => {
    const w = 256;
    const h = 512;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Clear transparent
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;

    // Draw spine (quill) — slight curve
    ctx.strokeStyle = '#E0D8C8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, h - 10);
    ctx.quadraticCurveTo(cx + 5, h * 0.5, cx - 2, 15);
    ctx.stroke();

    // Draw barbs — lines fanning out from spine
    const barbCount = 50;
    for (let i = 0; i < barbCount; i++) {
      const t = i / (barbCount - 1);
      const y = h - 20 - t * (h - 40);

      // Spine x at this y (follow the curve)
      const spineX = cx + 5 * (1 - t) * (1 - t) - 2 * t * t;

      // Width varies: narrow at base and tip, widest at ~35%
      const widthFactor = Math.sin(t * Math.PI) * (t < 0.35 ? t / 0.35 : 1) * (t > 0.85 ? (1 - t) / 0.15 : 1);
      const barbLen = 30 + widthFactor * 80;

      const alpha = 0.3 + widthFactor * 0.6;
      const angle = 0.15 + t * 0.1;

      // Left barb
      ctx.strokeStyle = `rgba(245, 240, 232, ${alpha})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(spineX, y);
      ctx.lineTo(spineX - barbLen * Math.cos(angle), y - barbLen * Math.sin(angle) * 0.3);
      ctx.stroke();

      // Right barb
      ctx.beginPath();
      ctx.moveTo(spineX, y);
      ctx.lineTo(spineX + barbLen * Math.cos(angle), y - barbLen * Math.sin(angle) * 0.3);
      ctx.stroke();
    }

    // Wispy tip barbs
    for (let i = 0; i < 8; i++) {
      const t = 0.88 + i * 0.015;
      const y = h - 20 - t * (h - 40);
      const spineX = cx - 2 * t * t;
      const side = i % 2 === 0 ? -1 : 1;
      const len = 15 + Math.random() * 25;
      ctx.strokeStyle = `rgba(255, 255, 255, 0.25)`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(spineX, y);
      ctx.lineTo(spineX + side * len, y - len * 0.2);
      ctx.stroke();
    }

    // Soft glow around the feather
    const gradient = ctx.createRadialGradient(cx, h * 0.45, 10, cx, h * 0.45, 120);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);
}

/** Feather — canvas-textured plane, clearly visible white feather on the pan */
function Feather({ balanced }: { balanced: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const frozenRef = useRef(false);
  const featherTexture = useFeatherTexture();

  useEffect(() => {
    frozenRef.current = balanced;
  }, [balanced]);

  useFrame(({ clock }) => {
    if (groupRef.current && !frozenRef.current) {
      // Gentle sway
      groupRef.current.rotation.z = Math.sin(clock.elapsedTime * (2 * Math.PI / 4)) * (3 * Math.PI / 180);
    } else if (groupRef.current && frozenRef.current) {
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, 0.05);
    }
  });

  return (
    <group ref={groupRef} position={[0.2, -2.55, 0.15]} rotation={[-0.26, 0.3, 0.15]}>
      {/* Feather plane with canvas texture */}
      <mesh>
        <planeGeometry args={[1.6, 3.2]} />
        <meshBasicMaterial
          map={featherTexture}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Soft white glow */}
      <pointLight color="#FFFFFF" intensity={1} distance={3} position={[0, 0, 0.5]} />
    </group>
  );
}

export function Scales3D({ isBalanced = false, mobile = false }: { isBalanced?: boolean; mobile?: boolean }) {
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

  // Reduce polygon counts on mobile
  const seg = mobile ? 12 : 32;
  const segSm = mobile ? 6 : 16;

  const scaleMat = {
    color: '#ffffff',
    metalness: mobile ? 0.5 : 0.9,
    roughness: mobile ? 0.5 : 0.1,
    envMapIntensity: mobile ? 0 : 1,
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
        <cylinderGeometry args={[1.5, 2, 0.5, seg]} />
        <meshStandardMaterial {...scaleMat} />
      </mesh>

      {/* Central Pillar */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.4, 8, seg]} />
        <meshStandardMaterial {...scaleMat} />
      </mesh>

      {/* Beam Group */}
      <group ref={beamRef as React.RefObject<THREE.Group>} position={[0, 3.5, 0]}>
        {/* Main Beam */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 8, segSm]} />
          <meshStandardMaterial {...scaleMat} />
        </mesh>

        {/* Left Pan — Weight */}
        <group ref={leftPanRef as React.RefObject<THREE.Group>} position={[-4, 0, 0]}>
          <mesh position={[0, -1.5, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 3, 6]} />
            <meshStandardMaterial color="#888" />
          </mesh>
          <mesh position={[0, -3, 0]}>
            <cylinderGeometry args={[1.5, 1.3, 0.4, seg]} />
            <meshStandardMaterial {...scaleMat} />
          </mesh>
          <mesh position={[0, -2.8, 0]}>
            <torusGeometry args={[1.5, 0.06, segSm, seg]} />
            <meshStandardMaterial {...scaleMat} />
          </mesh>
          <Weight />
          <pointLight color="#D4A017" intensity={2} distance={4} position={[0, -1.2, 0]} />
        </group>

        {/* Right Pan — Feather */}
        <group ref={rightPanRef as React.RefObject<THREE.Group>} position={[4, 0, 0]}>
          <mesh position={[0, -1.5, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 3, 6]} />
            <meshStandardMaterial color="#888" />
          </mesh>
          <mesh position={[0, -3, 0]}>
            <cylinderGeometry args={[1.5, 1.3, 0.4, seg]} />
            <meshStandardMaterial {...scaleMat} />
          </mesh>
          <mesh position={[0, -2.8, 0]}>
            <torusGeometry args={[1.5, 0.06, segSm, seg]} />
            <meshStandardMaterial {...scaleMat} />
          </mesh>
          <Feather balanced={atBalance} />
          <pointLight color="#4A9EFF" intensity={1.2} distance={4} position={[0, -1.2, 0]} />
        </group>
      </group>
    </group>
  );
}
