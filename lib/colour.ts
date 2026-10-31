export function hexToHsl(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;
  if (!delta) return { h: 0, s: 0, l: l * 100 };
  const s = delta / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const value = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

const HUE_BAND = 14;
const NEUTRAL = 12;

/** Sort position around the colour wheel: dark to light within each band, greys at the end. */
export function hueKey(hex: string) {
  const { h, s, l } = hexToHsl(hex);
  if (s < NEUTRAL) return 100000 + l;
  return Math.floor(((h + 20) % 360) / HUE_BAND) * 1000 + l;
}

const NAMES: [number, string][] = [
  [15, 'Ember'], [45, 'Amber'], [75, 'Gold'], [150, 'Moss'], [175, 'Jade'],
  [215, 'Ocean'], [250, 'Night blue'], [300, 'Violet'], [340, 'Plum'], [361, 'Rose'],
];

export function colourName(hex: string) {
  const { h, s } = hexToHsl(hex);
  if (s < NEUTRAL) return 'Graphite';
  return NAMES.find(([limit]) => h < limit)![1];
}

export const stripes = (colours: string[], direction = '90deg') =>
  `linear-gradient(${direction},${colours
    .map((c, i) => `${c} ${((i / colours.length) * 100).toFixed(2)}% ${(((i + 1) / colours.length) * 100).toFixed(2)}%`)
    .join(',')})`;

export const glow = (colours: string[], direction = '180deg') => `linear-gradient(${direction},${colours.join(',')})`;
