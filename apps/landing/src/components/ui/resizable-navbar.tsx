'use client';

// Aceternity Resizable Navbar, installed through its shadcn registry. Adapted to the
// central theme, reduced motion and semantic navigation. The host composes standard
// BitaKit buttons and a Radix Sheet for mobile keyboard and focus behavior.
import { useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';

export function Navbar({ children }: { children: ReactNode }) {
  const { scrollY } = useScroll();
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(scrollY.get() > 100), [scrollY]);
  useMotionValueEvent(scrollY, 'change', (latest) => setVisible(latest > 100));
  return (
    <header className="site-navbar">
      <motion.nav
        aria-label="Main"
        initial={false}
        animate={{ maxWidth: visible ? 920 : 1280, y: visible ? 8 : 0 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 200, damping: 40 }}
        data-compact={visible || undefined}
        className="site-nav-body"
      >
        {children}
      </motion.nav>
    </header>
  );
}

export function NavItems({
  items,
}: {
  items: { name: string; link: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[];
}) {
  return (
    <div className="site-nav-links">
      {items.map((item) => (
        <a href={item.link} key={item.link}>
          <span aria-hidden="true" className="site-nav-highlight" />
          <span className="relative flex items-center gap-2">
            <item.icon aria-hidden="true" className="size-4" />
            {item.name}
          </span>
        </a>
      ))}
    </div>
  );
}
