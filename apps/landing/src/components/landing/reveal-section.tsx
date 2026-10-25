'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/** Reveal each section once; no scroll listeners or motion-dependent content. */
export function RevealSection({
  children,
  ...props
}: {
  children: ReactNode;
  id: string;
  className: string;
  'aria-labelledby': string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      {...props}
      data-reveal=""
      initial={reduced ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: reduced ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  );
}
