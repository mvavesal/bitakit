'use client';

// Magic UI Border Beam (MIT): retain its border mask and CSS motion path. Native CSS owns
// the animation; Motion's visibility observer pauses it outside the viewport.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useInView } from 'motion/react';

/** Decorative perimeter light. Hidden pages and offscreen instances pause without a frame loop. */
export function BorderBeam({
  size = 100,
  duration = 18,
  delay = 0,
}: {
  size?: number;
  duration?: number;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref);
  const [pageVisible, setPageVisible] = useState(true);
  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className="site-border-beam pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent mask-[linear-gradient(transparent,transparent),linear-gradient(#000,#000)] mask-intersect [mask-clip:padding-box,border-box]"
    >
      <span
        className="site-border-beam-light absolute aspect-square"
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            '--beam-duration': `${duration}s`,
            '--beam-delay': `${-delay}s`,
            animationPlayState: inView && pageVisible ? 'running' : 'paused',
          } as CSSProperties
        }
      />
    </span>
  );
}
