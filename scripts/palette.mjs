// Turns raw RGB pixels into a title's stripe colours. Pixels are clustered in OKLab,
// a colour space where distance matches how different two colours look.

const PALETTE_SIZE = 7;
const CLUSTERS = 20;
const ITERATIONS = 12;
const MIN_DISTANCE = 0.055;
const VIVID_BOOST = 6;
const VIVID_CHROMA = 0.15;
const MIN_ACCENT_CHROMA = 0.04;
const CHROMA_LIFT = 1.2;

function toLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function toGamma(c) {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, v)) * 255);
}

export function rgbToOklab(r, g, b) {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToHex([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return '#' + rgb.map((c) => toGamma(c).toString(16).padStart(2, '0')).join('');
}

const distance = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const chroma = (p) => Math.hypot(p[1], p[2]);

// Letterbox bars and blown-out whites say nothing about a title's colour.
const isBlankPixel = (p) => chroma(p) < 0.02 && (p[0] < 0.1 || p[0] > 0.97);

function seedCentres(samples) {
  const mean = [0, 1, 2].map((i) => samples.reduce((sum, p) => sum + p[i], 0) / samples.length);
  const centres = [samples.reduce((best, p) => (distance(p, mean) < distance(best, mean) ? p : best))];
  const nearest = samples.map((p) => distance(p, centres[0]));
  while (centres.length < CLUSTERS) {
    let far = 0;
    for (let i = 1; i < samples.length; i++) if (nearest[i] > nearest[far]) far = i;
    centres.push(samples[far]);
    for (let i = 0; i < samples.length; i++) nearest[i] = Math.min(nearest[i], distance(samples[i], samples[far]));
  }
  return centres.map((c) => [...c]);
}

function cluster(samples) {
  const centres = seedCentres(samples);
  const sizes = new Array(CLUSTERS).fill(0);
  for (let round = 0; round < ITERATIONS; round++) {
    const sums = centres.map(() => [0, 0, 0]);
    sizes.fill(0);
    for (const p of samples) {
      let best = 0;
      let bestDistance = Infinity;
      for (let c = 0; c < CLUSTERS; c++) {
        const d = distance(p, centres[c]);
        if (d < bestDistance) {
          best = c;
          bestDistance = d;
        }
      }
      sizes[best]++;
      for (let i = 0; i < 3; i++) sums[best][i] += p[i];
    }
    for (let c = 0; c < CLUSTERS; c++) {
      if (sizes[c]) centres[c] = sums[c].map((v) => v / sizes[c]);
    }
  }
  return centres.map((centre, c) => ({ centre, share: sizes[c] / samples.length }));
}

/**
 * @param {Uint8Array | Buffer} pixels flat RGB bytes from one or more images
 * @returns {{ colours: string[], accent: string }} stripe colours from light to dark,
 * and the single colour that best represents the title.
 */
export function extractPalette(pixels) {
  const all = [];
  for (let i = 0; i + 2 < pixels.length; i += 3) all.push(rgbToOklab(pixels[i], pixels[i + 1], pixels[i + 2]));
  if (!all.length) throw new Error('No pixels to read');
  const kept = all.filter((p) => !isBlankPixel(p));
  // A title that really is almost black keeps its darkness.
  const samples = kept.length >= all.length * 0.02 ? kept : all;

  // Vivid colours rank far above their size. Film stills are mostly skin, walls and
  // shadow, so ranking by size alone gives every title the same grey-beige palette.
  const ranked = cluster(samples)
    .filter((c) => c.share > 0)
    .map((c) => ({ ...c, score: c.share * (1 + VIVID_BOOST * Math.min(chroma(c.centre) / VIVID_CHROMA, 1)) }))
    .sort((a, b) => b.score - a.score);

  const picked = [];
  for (const { centre } of ranked) {
    if (picked.length === PALETTE_SIZE) break;
    if (picked.every((p) => distance(p, centre) >= MIN_DISTANCE)) picked.push(centre);
  }
  const accent = picked.find((p) => chroma(p) >= MIN_ACCENT_CHROMA) ?? picked[0];
  const lift = ([L, a, b]) => oklabToHex([L, a * CHROMA_LIFT, b * CHROMA_LIFT]);
  const colours = [...picked].sort((p, q) => q[0] - p[0]).map(lift);
  while (colours.length < PALETTE_SIZE) colours.push(colours[colours.length - 1]);
  return { colours, accent: lift(accent) };
}
