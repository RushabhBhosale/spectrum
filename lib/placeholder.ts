import { hslToHex } from './colour';
import type { Category } from './types';

// Stand-in colours for titles `npm run colours` hasn't reached yet. Each category keeps
// its own mood and each title gets a stable palette from its name.
const MOODS: Record<Category, { hues: number[]; s: [number, number]; l: [number, number] }> = {
  Anime: { hues: [352, 14, 36, 205, 268], s: [62, 90], l: [28, 68] },
  'K-drama': { hues: [338, 188, 206, 28], s: [28, 56], l: [44, 76] },
  'C-drama': { hues: [156, 2, 44, 174], s: [38, 70], l: [20, 50] },
  'J-drama': { hues: [12, 330, 48, 196], s: [34, 62], l: [36, 70] },
  'Web series': { hues: [216, 162, 44, 4], s: [18, 46], l: [9, 36] },
  'Hindi series': { hues: [28, 42, 18, 340], s: [56, 84], l: [26, 56] },
};

function seeded(text: string) {
  let seed = [...text].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261);
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function placeholderColours(name: string, type: Category) {
  const random = seeded(name);
  const between = ([low, high]: [number, number]) => low + random() * (high - low);
  const pick = (list: number[]) => list[Math.floor(random() * list.length)];
  const mood = MOODS[type];
  const main = pick(mood.hues) + between([-9, 9]);
  const second = pick(mood.hues) + between([-9, 9]);
  const saturation = between(mood.s);
  const lightness = between(mood.l);
  const colours = [hslToHex((main + 360) % 360, saturation, lightness)];
  for (let c = 1; c < 7; c++) {
    const hue = c % 3 === 2 ? second : main + between([-8, 8]);
    colours.push(hslToHex((hue + 360) % 360, saturation + between([-8, 8]), Math.max(6, Math.min(84, lightness + between([-16, 16])))));
  }
  return colours;
}
