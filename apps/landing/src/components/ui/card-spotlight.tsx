// Aceternity Card Spotlight (free registry component). Adapted: theme card colors instead of a
// fixed black card, the logo's gold dots, the standard Card geometry, and the
// three.js effect loaded only when it is first needed.
'use client';

import { useMotionValue, motion, useMotionTemplate, useReducedMotion } from 'motion/react';
import React, { MouseEvent as ReactMouseEvent, useState } from 'react';
import dynamic from 'next/dynamic';
import { cn } from 'cn';
import { Card } from '@bitakit/ui/components';

// The WebGL dots (three.js) load on the first hover, not with the page.
const CanvasRevealEffect = dynamic(
  () => import('@/components/ui/canvas-reveal-effect').then((module) => module.CanvasRevealEffect),
  { ssr: false },
);

export const CardSpotlight = ({
  children,
  radius = 350,
  color = 'color-mix(in srgb, var(--primary) 12%, transparent)',
  className,
  ...props
}: {
  radius?: number;
  color?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) => {
  const reduced = useReducedMotion();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  function handleMouseMove({ currentTarget, clientX, clientY }: ReactMouseEvent<HTMLDivElement>) {
    let { left, top } = currentTarget.getBoundingClientRect();

    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  // Mounted on the first hover and kept, so the dots fade out with the glow instead of cutting off.
  const [hovered, setHovered] = useState(false);
  const [running, setRunning] = useState(false);
  const handleMouseEnter = () => {
    setHovered(true);
    setRunning(true);
  };
  return (
    <Card
      className={cn('group/spotlight spotlight-card relative overflow-hidden', className)}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      <motion.div
        aria-hidden="true"
        onTransitionEnd={(event) => {
          if (
            event.propertyName === 'opacity' &&
            !event.currentTarget.parentElement?.matches(':hover')
          )
            setRunning(false);
        }}
        className="pointer-events-none absolute z-0 -inset-px rounded-card opacity-0 transition-opacity duration-700 ease-out group-hover/spotlight:opacity-60 motion-reduce:transition-none"
        style={{
          backgroundColor: color,
          maskImage: useMotionTemplate`
            radial-gradient(
              ${radius}px circle at ${mouseX}px ${mouseY}px,
              white,
              transparent 80%
            )
          `,
        }}
      >
        {hovered && !reduced && (
          <CanvasRevealEffect
            active={running}
            animationSpeed={0.6}
            containerClassName="bg-transparent absolute inset-0 pointer-events-none opacity-30"
            colors={[
              [180, 134, 66],
              [145, 108, 59],
              [201, 158, 87],
            ]}
            dotSize={5}
            totalSize={14}
            showGradient={false}
          />
        )}
      </motion.div>
      {/* Content above the spotlight layer. */}
      {children}
    </Card>
  );
};
