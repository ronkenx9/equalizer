import { useEffect, useState } from 'react';

export function Cursor() {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    // Don't register on touch devices
    if ('ontouchstart' in window) return;

    let rafId: number;
    let pending = { x: -100, y: -100 };

    const onMove = (e: MouseEvent) => {
      pending = { x: e.clientX, y: e.clientY };
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => setPosition(pending));
    };

    const onOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      setIsHovering(!!(target.closest('a') || target.closest('button')));
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseover', onOver, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      className={`custom-cursor ${isHovering ? 'hover' : ''}`}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    />
  );
}
