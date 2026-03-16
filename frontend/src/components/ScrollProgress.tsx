import { motion, useScroll, useSpring } from 'motion/react';

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleY = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <div className="scroll-progress">
      <motion.div
        className="scroll-progress-bar h-full"
        style={{ scaleY }}
      />
    </div>
  );
}
