import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis: Lenis | null = null;

/** Weighted scrolling on wheels and trackpads. Touch keeps the phone's own scrolling. */
export function startSmoothScroll() {
  if (prefersReducedMotion()) return () => {};
  const instance = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, anchors: { offset: 0 } });
  lenis = instance;
  instance.on('scroll', ScrollTrigger.update);
  const tick = (time: number) => instance.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return () => {
    gsap.ticker.remove(tick);
    instance.destroy();
    lenis = null;
  };
}

export const holdScroll = (held: boolean) => (held ? lenis?.stop() : lenis?.start());

export function scrollToSection(selector: string) {
  const target = document.querySelector<HTMLElement>(selector);
  if (!target) return;
  if (lenis) lenis.scrollTo(target, { duration: 1.6, force: true });
  else target.scrollIntoView();
}
