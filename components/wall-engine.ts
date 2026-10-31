import type { Title } from '@/lib/types';

const INK = '#09090b';
const PAPER = '#f0ece4';
const INTRO_MS = 1300;
const FLOOR_GAP = 34;
const SPREAD = 1.3;
const MIN_TICK_GAP = 62;
const STRIPE_ART_HEIGHT = 96;
const ACCENT_TINT = 0.65;

type Stripe = { title: Title; art: HTMLCanvasElement; x: number; w: number; tx: number; tw: number; a: number; ta: number; on: boolean };
type Callbacks = { onFocus: (title: Title | null) => void; onPick: (title: Title) => void };

// Height follows the rating, curved so the gap between an 8 and a 10 is easy to see.
const heightShare = (rating: number | null) => (rating === null ? 0.14 : 0.18 + 0.82 * Math.pow(rating / 10, 2.6));

// Each stripe is a soft column of light, drawn once and then only scaled.
function stripeArt(colours: string[], accent: string) {
  const art = document.createElement('canvas');
  art.width = 1;
  art.height = STRIPE_ART_HEIGHT;
  const ctx = art.getContext('2d')!;
  const fill = ctx.createLinearGradient(0, 0, 0, STRIPE_ART_HEIGHT);
  colours.forEach((colour, i) => fill.addColorStop(i / (colours.length - 1), colour));
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, 1, STRIPE_ART_HEIGHT);
  // Keeps each colour's brightness but pulls its hue toward the accent, so neighbouring
  // stripes read as one band of the spectrum instead of a noisy mix.
  ctx.globalCompositeOperation = 'color';
  ctx.globalAlpha = ACCENT_TINT;
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 1, STRIPE_ART_HEIGHT);
  return art;
}

export class WallEngine {
  private ctx: CanvasRenderingContext2D;
  private glow: CanvasRenderingContext2D;
  private stripes = new Map<string, Stripe>();
  private visible: Stripe[] = [];
  private group?: (title: Title) => string;
  private focused = -1;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private floor = 0;
  private start = 0;
  private frame = 0;
  private settle = 0;
  private running = false;
  private observer: ResizeObserver;
  private reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private fonts = { mono: 'monospace', display: 'sans-serif' };

  constructor(
    private stage: HTMLElement,
    private canvas: HTMLCanvasElement,
    ambient: HTMLCanvasElement,
    titles: Title[],
    private callbacks: Callbacks,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.glow = ambient.getContext('2d')!;
    for (const title of titles) {
      this.stripes.set(title.id, { title, art: stripeArt(title.colours, title.accent), x: 0, w: 0, tx: 0, tw: 0, a: 1, ta: 1, on: false });
    }
    const style = getComputedStyle(stage);
    this.fonts = { mono: style.getPropertyValue('--mono'), display: style.getPropertyValue('--display') };
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(stage);
    stage.addEventListener('pointermove', this.handleMove);
    stage.addEventListener('pointerleave', this.handleLeave);
    stage.addEventListener('click', this.handleClick);
    stage.addEventListener('keydown', this.handleKey);
    stage.addEventListener('blur', this.handleLeave);
    this.measure();
    this.start = performance.now();
    this.settle = window.setTimeout(() => this.draw(this.start + INTRO_MS * 2), INTRO_MS + 200);
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    clearTimeout(this.settle);
    this.observer.disconnect();
    this.stage.removeEventListener('pointermove', this.handleMove);
    this.stage.removeEventListener('pointerleave', this.handleLeave);
    this.stage.removeEventListener('click', this.handleClick);
    this.stage.removeEventListener('keydown', this.handleKey);
    this.stage.removeEventListener('blur', this.handleLeave);
  }

  show(titles: Title[], group?: (title: Title) => string) {
    const firstShow = !this.visible.length;
    for (const stripe of this.stripes.values()) stripe.on = false;
    this.visible = titles.map((title) => {
      const stripe = this.stripes.get(title.id)!;
      stripe.on = true;
      return stripe;
    });
    this.group = group;
    this.focused = -1;
    this.layout();
    if (firstShow) for (const s of this.visible) Object.assign(s, { x: s.tx, w: s.tw });
    this.kick();
  }

  private measure() {
    this.width = this.stage.clientWidth;
    this.height = this.stage.clientHeight;
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.floor = Math.round(this.height * 0.83);
  }

  private resize() {
    if (this.stage.clientWidth === this.width && this.stage.clientHeight === this.height) return;
    this.measure();
    this.layout();
    this.kick();
  }

  private layout() {
    const count = this.visible.length || 1;
    const grow = Math.max(1, Math.max(54, this.width * 0.06) / (this.width / count) - 1);
    const weights = this.visible.map((_, i) =>
      1 + (this.focused < 0 ? 0 : grow * Math.exp(-((i - this.focused) ** 2) / (2 * SPREAD * SPREAD))),
    );
    const scale = this.width / weights.reduce((a, b) => a + b, 0);
    let x = 0;
    this.visible.forEach((stripe, i) => {
      stripe.tx = x;
      stripe.tw = weights[i] * scale;
      stripe.ta = this.focused < 0 || i === this.focused ? 1 : 0.6;
      x += stripe.tw;
    });
    for (const stripe of this.stripes.values()) {
      if (!stripe.on) {
        stripe.tw = 0;
        stripe.ta = 0;
      }
    }
  }

  private stripeHeight(stripe: Stripe) {
    return (this.floor - FLOOR_GAP) * heightShare(stripe.title.rating);
  }

  private draw(now: number) {
    const { ctx, width, height, floor, dpr } = this;
    const elapsed = this.reduceMotion ? Infinity : now - this.start;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    for (const stripe of this.stripes.values()) {
      if (stripe.w < 0.04) continue;
      const delay = width ? (stripe.x / width) * INTRO_MS * 0.55 : 0;
      const progress = Math.min(1, Math.max(0, (elapsed - delay) / (INTRO_MS * 0.45)));
      const rise = 1 - Math.pow(1 - progress, 3);
      if (rise <= 0) continue;
      const stripeHeight = this.stripeHeight(stripe) * rise;
      ctx.globalAlpha = stripe.a;
      ctx.drawImage(stripe.art, stripe.x, floor - stripeHeight, stripe.w + 0.6, stripeHeight);
    }
    ctx.globalAlpha = 1;

    this.glow.clearRect(0, 0, this.glow.canvas.width, this.glow.canvas.height);
    this.glow.drawImage(this.canvas, 0, 0, this.glow.canvas.width, this.glow.canvas.height);

    // The stripes reflect on a dark floor.
    ctx.save();
    ctx.setTransform(dpr, 0, 0, -dpr, 0, 2 * floor * dpr);
    ctx.globalAlpha = 0.3;
    ctx.drawImage(this.canvas, 0, 0, this.canvas.width, Math.floor(floor * dpr), 0, 0, width, floor);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fade = ctx.createLinearGradient(0, floor, 0, height);
    fade.addColorStop(0, 'rgba(9,9,11,.25)');
    fade.addColorStop(1, INK);
    ctx.fillStyle = fade;
    ctx.fillRect(0, floor, width, height - floor);

    if (this.group && elapsed > INTRO_MS) this.drawTicks();
    const focused = this.visible[this.focused];
    if (focused) {
      ctx.font = `400 22px ${this.fonts.display}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = PAPER;
      const labelX = Math.max(22, Math.min(width - 22, focused.x + focused.w / 2));
      ctx.fillText(focused.title.rating?.toFixed(1) ?? '–', labelX, floor - this.stripeHeight(focused) - 8);
    }
  }

  private drawTicks() {
    const { ctx, floor } = this;
    ctx.font = `500 11px ${this.fonts.mono}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = PAPER;
    let last: string | null = null;
    let lastX = -Infinity;
    for (const stripe of this.visible) {
      const label = this.group!(stripe.title);
      if (label === last) continue;
      last = label;
      if (stripe.x - lastX < MIN_TICK_GAP) continue;
      ctx.fillRect(stripe.x, floor + 1, 1, 8);
      ctx.fillText(label, stripe.x + 5, floor + 13);
      lastX = stripe.x;
    }
  }

  private tick = (now: number) => {
    const ease = this.reduceMotion ? 1 : 0.2;
    let moving = false;
    for (const s of this.stripes.values()) {
      const dx = s.tx - s.x;
      const dw = s.tw - s.w;
      const da = s.ta - s.a;
      if (Math.abs(dx) > 0.05 || Math.abs(dw) > 0.05 || Math.abs(da) > 0.01) moving = true;
      s.x += dx * ease;
      s.w += dw * ease;
      s.a += da * ease;
    }
    this.draw(now);
    if (moving || now - this.start < INTRO_MS + 80) this.frame = requestAnimationFrame(this.tick);
    else this.running = false;
  };

  private kick() {
    if (this.running) return;
    this.running = true;
    this.frame = requestAnimationFrame(this.tick);
  }

  private setFocus(index: number) {
    if (index === this.focused) return;
    this.focused = index;
    this.layout();
    this.kick();
    this.callbacks.onFocus(this.visible[index]?.title ?? null);
  }

  private indexAt(event: MouseEvent) {
    const box = this.stage.getBoundingClientRect();
    const count = this.visible.length;
    return Math.max(0, Math.min(count - 1, Math.floor(((event.clientX - box.left) / box.width) * count)));
  }

  private handleMove = (event: PointerEvent) => this.setFocus(this.indexAt(event));
  private handleLeave = () => this.setFocus(-1);
  private handleClick = (event: MouseEvent) => {
    const stripe = this.visible[this.indexAt(event)];
    if (stripe) this.callbacks.onPick(stripe.title);
  };
  private handleKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const move = event.key === 'ArrowRight' ? 1 : -1;
      this.setFocus(Math.max(0, Math.min(this.visible.length - 1, Math.max(0, this.focused) + move)));
    }
    if (event.key === 'Enter' && this.visible[this.focused]) this.callbacks.onPick(this.visible[this.focused].title);
  };
}
