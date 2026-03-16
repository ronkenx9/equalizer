"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ScalesSceneProps {
  scrollProgress?: number;
  small?: boolean;
}

export default function ScalesScene({ scrollProgress = 0, small = false }: ScalesSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(scrollProgress);
  const cleanupRef = useRef<(() => void) | null>(null);

  progressRef.current = scrollProgress;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x080810, 0.012);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, small ? 1 : 0.5, small ? 6 : 8);
    camera.lookAt(0, small ? 0.5 : 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Materials
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc, metalness: 0.9, roughness: 0.1,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x888899, metalness: 0.7, roughness: 0.15, transparent: true, opacity: 0.6,
    });

    // Pillar
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3, 16), chromeMat);
    pillar.position.set(0, -0.5, 0);
    scene.add(pillar);

    // Base plate
    const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.1, 32), chromeMat);
    basePlate.position.set(0, -2, 0);
    scene.add(basePlate);

    // Pivot
    const pivot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), chromeMat);
    pivot.position.set(0, 1, 0);
    scene.add(pivot);

    // Beam
    const beam = new THREE.Mesh(new THREE.BoxGeometry(4, 0.06, 0.06), chromeMat);
    beam.position.set(0, 1, 0);
    scene.add(beam);

    // Create pan + chains
    function createPan(): THREE.Group {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.08, 24), glassMat));
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.02, 8, 32), chromeMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.04;
      g.add(rim);
      return g;
    }

    function createChains(x: number): THREE.Mesh[] {
      const chainMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.2 });
      const chains: THREE.Mesh[] = [];
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.5, 4), chainMat);
        chain.position.set(x + Math.cos(angle) * 0.3, 0.25, Math.sin(angle) * 0.3);
        scene.add(chain);
        chains.push(chain);
      }
      return chains;
    }

    const leftPan = createPan();
    leftPan.position.set(-1.8, -0.5, 0);
    scene.add(leftPan);

    const rightPan = createPan();
    rightPan.position.set(1.8, -0.5, 0);
    scene.add(rightPan);

    const leftChains = createChains(-1.8);
    const rightChains = createChains(1.8);

    // Particles
    const particleCount = 150;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(particleCount * 3);
    const pVel = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 2 - 1.8;
      pPos[i * 3 + 1] = Math.random() * 2 - 1;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 1;
      pVel[i * 3] = (Math.random() - 0.5) * 0.008;
      pVel[i * 3 + 1] = -Math.random() * 0.015 - 0.005;
      pVel[i * 3 + 2] = (Math.random() - 0.5) * 0.008;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xD4A017, size: 0.03, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // Lights
    const ambient = new THREE.AmbientLight(0x222233, 0.4);
    scene.add(ambient);
    const amberLight = new THREE.PointLight(0xD4A017, 2, 12);
    amberLight.position.set(-3, 2, 2);
    scene.add(amberLight);
    const blueLight = new THREE.PointLight(0x4A9EFF, 2, 12);
    blueLight.position.set(3, 2, 2);
    scene.add(blueLight);
    const top = new THREE.DirectionalLight(0xffffff, 0.4);
    top.position.set(0, 5, 3);
    scene.add(top);

    // Equilibrium line (appears at balance)
    const lineGeo = new THREE.PlaneGeometry(6, 0.003);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xD4A017, transparent: true, opacity: 0 });
    const eqLine = new THREE.Mesh(lineGeo, lineMat);
    eqLine.position.set(0, -0.5, 0.5);
    scene.add(eqLine);

    let mouseX = 0;
    const onMouse = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouse);

    let animId = 0;
    function animate() {
      animId = requestAnimationFrame(animate);
      const t = performance.now() * 0.001;
      const sp = progressRef.current;

      // Beam tilt: -0.3 (left heavy) → 0 (balanced) with back.out easing simulation
      const maxTilt = small ? 0 : -0.3;
      // Custom easing: overshoot slightly then settle
      let eased = sp;
      if (sp > 0.8 && sp < 1) {
        const over = (sp - 0.8) / 0.2;
        eased = 0.8 + 0.2 * (1 + 2.7 * Math.pow(over - 1, 3) + 1.7 * Math.pow(over - 1, 2));
      }
      const tilt = maxTilt * (1 - Math.min(eased, 1));
      beam.rotation.z = tilt;

      const leftY = 1 - 1.8 * Math.sin(-tilt) - 1.5;
      const rightY = 1 + 1.8 * Math.sin(-tilt) - 1.5;
      leftPan.position.y = leftY;
      rightPan.position.y = rightY;
      leftPan.position.x = -1.8;
      rightPan.position.x = 1.8;

      leftChains.forEach((c, i) => {
        const angle = (i / 3) * Math.PI * 2;
        c.position.set(-1.8 + Math.cos(angle) * 0.3, (1 + leftY) / 2, Math.sin(angle) * 0.3);
        c.scale.y = Math.max(0.1, Math.abs(1 - leftY) / 1.5);
      });
      rightChains.forEach((c, i) => {
        const angle = (i / 3) * Math.PI * 2;
        c.position.set(1.8 + Math.cos(angle) * 0.3, (1 + rightY) / 2, Math.sin(angle) * 0.3);
        c.scale.y = Math.max(0.1, Math.abs(1 - rightY) / 1.5);
      });

      // Parallax
      scene.rotation.y += (mouseX * 0.26 - scene.rotation.y) * 0.05;

      // Particles
      const pOpacity = Math.max(0, 1 - sp * 2.5);
      pMat.opacity = pOpacity * 0.6;
      const posArr = pGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        posArr[i * 3 + 1] += pVel[i * 3 + 1];
        posArr[i * 3] += pVel[i * 3];
        if (posArr[i * 3 + 1] < -2.5) {
          posArr[i * 3] = (Math.random() - 0.5) * 1.5 - 1.8;
          posArr[i * 3 + 1] = leftY + Math.random() * 0.5;
          posArr[i * 3 + 2] = (Math.random() - 0.5) * 1;
        }
      }
      pGeo.attributes.position.needsUpdate = true;

      // Equilibrium line fades in near balance
      lineMat.opacity = sp > 0.85 ? (sp - 0.85) / 0.15 * 0.5 : 0;

      // Light warmth
      amberLight.intensity = 1.5 + sp * 0.5;
      blueLight.intensity = 2 - sp * 0.5;
      ambient.intensity = 0.3 + sp * 0.4;

      // Subtle float
      beam.position.y = 1 + Math.sin(t * 0.5) * 0.015;

      renderer.render(scene, camera);
    }
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    cleanupRef.current = () => {
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      pGeo.dispose();
      pMat.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };

    return () => cleanupRef.current?.();
  }, [small]);

  return <div ref={containerRef} className="w-full h-full" />;
}
