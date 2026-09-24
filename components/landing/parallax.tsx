'use client';

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';

/**
 * Scroll-linked motion.
 *
 * Elements drift as the page scrolls — the hero copy a little slower than the
 * page, the photograph a little faster — which is what gives a landing page
 * depth rather than the feeling of a flat sheet sliding past.
 *
 * Three decisions worth knowing about:
 *
 * 1. One listener, not one per element. Every `Parallax` on the page registers
 *    into a shared set and a single passive scroll handler, throttled to one
 *    animation frame, moves all of them. Ten of these cost the same as one.
 * 2. Transform only, and only within a few dozen pixels. Nothing reflows,
 *    nothing overlaps its neighbour, and no element can drift far enough from
 *    where it was laid out to leave the viewport or cause a horizontal
 *    scrollbar.
 * 3. It does nothing at all under `prefers-reduced-motion`, and nothing before
 *    hydration. The page is complete and readable without it; this is
 *    decoration on top of a page that already works.
 */

type Entry = { element: HTMLElement; speed: number; max: number };

const entries = new Set<Entry>();
let frame = 0;
let listening = false;

function apply() {
  frame = 0;
  const middle = window.innerHeight / 2;

  for (const entry of entries) {
    const rect = entry.element.getBoundingClientRect();

    // Skip anything comfortably off screen: its transform cannot be seen, and
    // writing to it would only cost layout work.
    if (rect.bottom < -200 || rect.top > window.innerHeight + 200) continue;

    const centre = rect.top + rect.height / 2;
    const offset = (middle - centre) * entry.speed;
    const clamped = Math.max(-entry.max, Math.min(entry.max, offset));
    entry.element.style.transform = `translate3d(0, ${clamped.toFixed(2)}px, 0)`;
  }
}

function schedule() {
  if (frame) return;
  frame = requestAnimationFrame(apply);
}

function register(entry: Entry) {
  entries.add(entry);
  if (!listening) {
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    listening = true;
  }
  schedule();

  return () => {
    entries.delete(entry);
    entry.element.style.transform = '';
    if (entries.size === 0 && listening) {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      listening = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}

export function Parallax({
  children,
  as: Tag = 'div',
  /**
   * How far the element drifts per pixel of scroll. Positive moves it against
   * the scroll (it appears to lag behind the page); negative moves it with the
   * scroll (it appears to run ahead). Values past about 0.15 stop reading as
   * depth and start reading as a glitch.
   */
  speed = 0.06,
  /** Never drift further than this from the laid-out position. */
  max = 40,
  className,
}: {
  children: ReactNode;
  as?: ElementType;
  speed?: number;
  max?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    element.style.willChange = 'transform';
    const unregister = register({ element, speed, max });

    return () => {
      unregister();
      element.style.willChange = '';
    };
  }, [speed, max]);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
