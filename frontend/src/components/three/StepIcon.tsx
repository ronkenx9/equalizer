"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

interface StepIconProps {
  type: "detect" | "lock" | "evaluate" | "release";
}

export default function StepIcon({ type }: StepIconProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const size = 200;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
    camera.position.z = 4;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    let mesh: THREE.Mesh | THREE.Group;
    let pulseScale = false;

    const configs = {
      detect: {
        geometry: new THREE.IcosahedronGeometry(1, 0),
        color: 0xD4A017,
        glow: 0xD4A017,
        wireframe: false,
      },
      lock: {
        geometry: new THREE.BoxGeometry(1.2, 1.2, 1.2),
        color: 0x4A9EFF,
        glow: 0x4A9EFF,
        wireframe: true,
      },
      evaluate: {
        geometry: new THREE.OctahedronGeometry(1, 0),
        color: 0xE8E8EC,
        glow: 0xE8E8EC,
        wireframe: false,
      },
      release: {
        geometry: new THREE.SphereGeometry(0.9, 24, 24),
        color: 0x3DB87A,
        glow: 0x3DB87A,
        wireframe: false,
      },
    };

    const cfg = configs[type];

    if (type === "lock") {
      // Cube with wireframe overlay
      const group = new THREE.Group();
      const solidMat = new THREE.MeshStandardMaterial({
        color: cfg.color, metalness: 0.6, roughness: 0.3, transparent: true, opacity: 0.3,
      });
      const solidMesh = new THREE.Mesh(cfg.geometry, solidMat);
      group.add(solidMesh);

      const wireMat = new THREE.MeshBasicMaterial({ color: cfg.color, wireframe: true });
      const wireMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), wireMat);
      group.add(wireMesh);

      mesh = group;
    } else if (type === "release") {
      pulseScale = true;
      const mat = new THREE.MeshStandardMaterial({
        color: cfg.color, metalness: 0.5, roughness: 0.3, transparent: true, opacity: 0.7,
      });
      mesh = new THREE.Mesh(cfg.geometry, mat);
    } else {
      const mat = new THREE.MeshStandardMaterial({
        color: cfg.color, metalness: 0.6, roughness: 0.3,
      });
      mesh = new THREE.Mesh(cfg.geometry, mat);
    }
    scene.add(mesh);

    // Glow light
    const pointLight = new THREE.PointLight(cfg.glow, 1.5, 8);
    pointLight.position.set(1, 1, 2);
    scene.add(pointLight);

    const ambient = new THREE.AmbientLight(0x222233, 0.5);
    scene.add(ambient);

    let animId = 0;
    function animate() {
      animId = requestAnimationFrame(animate);
      const t = performance.now() * 0.001;

      mesh.rotation.y = t * 0.5;
      mesh.rotation.x = Math.sin(t * 0.3) * 0.2;

      if (pulseScale) {
        const pulse = 1 + Math.sin(t * 2) * 0.08;
        mesh.scale.setScalar(pulse);
      }

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [type]);

  return <div ref={containerRef} className="w-[200px] h-[200px] mx-auto" />;
}
