'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';

/**
 * Aceternity Container Scroll entrance. Tilt and scale are visual only: the live
 * app remains interactive at every angle, with native scrolling in each document.
 */
export function ContainerScroll({
  titleComponent,
  children,
}: {
  titleComponent: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'start 160px'],
  });
  const rotateX = useTransform(scrollYProgress, [0, 1], mobile ? [0, 0] : [24, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], mobile ? [0.95, 1] : [0.82, 1]);
  return (
    <div>
      {titleComponent}
      <div ref={ref} id="playground-app" tabIndex={-1} className="playground-scroll-anchor">
        <motion.div
          className="playground-scroll-surface origin-top"
          style={{
            rotateX: reduced ? 0 : rotateX,
            scale: reduced ? 1 : scale,
          }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
