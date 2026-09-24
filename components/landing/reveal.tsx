'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Reveal a section as it enters the viewport.
 *
 * Three rules this follows, because they are what separates motion that makes
 * a page feel considered from motion that makes it feel cheap:
 *
 * 1. The element occupies its final space from the first paint. Only opacity
 *    and transform change, so nothing reflows, the page never grows a
 *    horizontal scrollbar, and Cumulative Layout Shift stays at zero.
 * 2. It reveals once and then stops observing. A section that re-animates
 *    every time you scroll past it is a section you end up scrolling past
 *    faster.
 * 3. It fails visible, never hidden. Without JavaScript, without
 *    IntersectionObserver, or with reduced motion asked for, the content is
 *    simply there — the CSS in `globals.css` resolves `.reveal` to its final
 *    state and this component sets it immediately.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  className,
}: {
  children: ReactNode;
  as?: ElementType;
  /** Milliseconds of stagger. Kept small; a long queue reads as a wait. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    // Already on screen at mount (a deep link, or a short page): show it
    // without waiting for a scroll that may never come.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    );

    observer.observe(element);

    /**
     * A backstop, because invisible content is a far worse failure than an
     * unanimated one. If the observer has not fired within a second and a half
     * — a tab restored in the background, a headless capture that never
     * scrolls, a browser that throttles observers — show the content anyway.
     */
    const backstop = window.setTimeout(() => {
      setShown(true);
      observer.disconnect();
    }, 1500);

    return () => {
      window.clearTimeout(backstop);
      observer.disconnect();
    };
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn('reveal', shown && 'is-visible', className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
