"use client";

// Motion for the landing page: one LazyMotion root (only the DOM animation features load), and
// small pieces that react to the cursor. Every effect is off with reduced motion, and cursor
// effects only run with a mouse or trackpad.
import { LazyMotion, MotionConfig, domAnimation, m, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef, useSyncExternalStore } from "react";

export function MotionRoot({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

const finePointer = "(pointer: fine)";
const subscribe = (onChange: () => void) => {
  const media = matchMedia(finePointer);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};

// A mouse or trackpad (false on the server and on touch screens)
export function useFinePointer(): boolean {
  return useSyncExternalStore(subscribe, () => matchMedia(finePointer).matches, () => false);
}

// Section headings rise in once as they scroll into view. Without JavaScript the
// <noscript> rule on the page keeps them visible.
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <m.div
      data-reveal
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </m.div>
  );
}

// Tilts its contents a few degrees towards the cursor, wherever it is on the page
export function Tilt({ children, className, max = 8 }: { children: React.ReactNode; className?: string; max?: number }) {
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const rotateX = useSpring(0, { stiffness: 120, damping: 18 });
  const rotateY = useSpring(0, { stiffness: 120, damping: 18 });

  useEffect(() => {
    if (!fine || reduce) return;
    const move = (e: PointerEvent) => {
      rotateY.set((e.clientX / innerWidth - 0.5) * max * 2);
      rotateX.set(-(e.clientY / innerHeight - 0.5) * max * 1.5);
    };
    addEventListener("pointermove", move);
    return () => {
      removeEventListener("pointermove", move);
      rotateX.set(0);
      rotateY.set(0);
    };
  }, [fine, reduce, max, rotateX, rotateY]);

  return (
    <m.div className={className} style={{ rotateX, rotateY, transformPerspective: 1100 }}>
      {children}
    </m.div>
  );
}

// The main call to action leans a few pixels towards the cursor
export function Magnetic({ children, className }: { children: React.ReactNode; className?: string }) {
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const x = useSpring(0, { stiffness: 220, damping: 15 });
  const y = useSpring(0, { stiffness: 220, damping: 15 });
  const on = fine && !reduce;

  return (
    <m.span
      ref={ref}
      className={`inline-flex ${className ?? ""}`}
      style={{ x, y }}
      onPointerMove={(e) => {
        if (!on || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set(Math.max(-6, Math.min(6, (e.clientX - r.left - r.width / 2) * 0.15)));
        y.set(Math.max(-6, Math.min(6, (e.clientY - r.top - r.height / 2) * 0.3)));
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </m.span>
  );
}
