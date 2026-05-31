import gsap from 'gsap';
import { useEffect, useRef } from 'react';

export function useHomeEntranceAnimation() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return undefined;

    const ctx = gsap.context(() => {
      gsap.from('.canvas-home-hero-badge', {
        opacity: 0,
        y: 16,
        duration: 0.55,
        ease: 'power2.out',
      });

      gsap.from('.canvas-home-hero h1', {
        opacity: 0,
        y: 24,
        duration: 0.7,
        delay: 0.08,
        ease: 'power3.out',
      });

      gsap.from('.canvas-home-hero-subtitle', {
        opacity: 0,
        y: 20,
        duration: 0.65,
        delay: 0.16,
        ease: 'power2.out',
      });

      gsap.from('.canvas-home-hero-cta', {
        opacity: 0,
        y: 18,
        duration: 0.6,
        delay: 0.24,
        ease: 'back.out(1.4)',
      });

      gsap.from('.canvas-home-hero-visual', {
        opacity: 0,
        x: 40,
        scale: 0.94,
        duration: 0.85,
        delay: 0.12,
        ease: 'power3.out',
      });

      gsap.from('.canvas-home-section-header', {
        opacity: 0,
        y: 18,
        duration: 0.55,
        delay: 0.35,
        ease: 'power2.out',
      });

      gsap.from('.canvas-home-project-card', {
        opacity: 0,
        duration: 0.55,
        stagger: 0.07,
        delay: 0.42,
        ease: 'power2.out',
      });

      gsap.from('.canvas-home-features > h2', {
        opacity: 0,
        y: 16,
        duration: 0.5,
        delay: 0.55,
        ease: 'power2.out',
      });

      gsap.from('.canvas-home-feature-card', {
        opacity: 0,
        y: 20,
        duration: 0.55,
        stagger: 0.08,
        delay: 0.62,
        ease: 'power2.out',
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return rootRef;
}
