import * as T from 'three';
import { random } from '../../shared/model.mjs';

// Small, shared botanical sprays. Cutout texels retain individual leaf edges
// while a single card carries an entire twig instead of one diamond per leaf.
const textures = new Map();
export function foliageTexture(conifer = false, canopy = false) {
  const key = `${conifer}:${canopy}`;
  if (textures.has(key)) return textures.get(key);
  const size = 256,
    pixels = new Uint8Array(size * size * 4),
    rng = random(`foliage-spray:${conifer}`);
  const leaf = (cx, cy, length, width, angle, shade) => {
    // Broad overlapping clusters survive minification better than isolated
    // twig leaves. Close-up foliage retains the original botanical outline.
    if (canopy) {
      length *= 1.2;
      width *= 1.65;
    }
    const c = Math.cos(angle),
      s = Math.sin(angle),
      radius = Math.ceil(length * size);
    for (
      let y = Math.max(0, Math.floor(cy * size) - radius);
      y < Math.min(size, cy * size + radius);
      y++
    )
      for (
        let x = Math.max(0, Math.floor(cx * size) - radius);
        x < Math.min(size, cx * size + radius);
        x++
      ) {
        const dx = (x + 0.5) / size - cx,
          dy = (y + 0.5) / size - cy;
        const u = (dx * c + dy * s) / length,
          v = (-dx * s + dy * c) / width;
        const shape = Math.abs(v) / Math.max(0.001, 1 - u * u);
        if (Math.abs(u) >= 1 || shape >= 1) continue;
        const alpha = Math.min(
          1,
          (1 - shape) * width * size * 2,
          (1 - Math.abs(u)) * length * size * 2,
        );
        const vein = Math.abs(v) < 0.055 ? 1.16 : 1;
        const light = shade * vein * (0.83 + Math.max(0, 1 - v * v) * 0.17) * (v < 0 ? 0.91 : 1.04);
        const base = conifer ? [67, 93, 65] : [100, 123, 61];
        const i = (y * size + x) * 4;
        for (let k = 0; k < 3; k++) pixels[i + k] = Math.min(255, base[k] * light);
        pixels[i + 3] = Math.max(pixels[i + 3], Math.round(alpha * 255));
      }
  };
  // Pairs follow branching stems, with overlapping leaf pairs along every twig.
  for (let stem = 0; stem < (conifer ? 9 : 7); stem++) {
    const angle = stem * 2.399 + rng() * 0.35;
    const reach = 0.22 + rng() * 0.16;
    const origin = { x: 0.5 + Math.cos(angle) * 0.04, y: 0.5 + Math.sin(angle) * 0.04 };
    for (let i = 1; i <= (conifer ? 13 : 5); i++) {
      const t = i / (conifer ? 13 : 5);
      for (const side of [-1, 1]) {
        const turn = angle + side * (conifer ? 0.6 : 0.8);
        const length = conifer ? 0.055 + rng() * 0.022 : 0.055 + rng() * 0.025;
        const x = origin.x + Math.cos(angle) * reach * t + Math.cos(turn) * length * 0.62;
        const y = origin.y + Math.sin(angle) * reach * t + Math.sin(turn) * length * 0.62;
        leaf(x, y, length, length * (conifer ? 0.2 : 0.43), turn, 0.78 + rng() * 0.42);
      }
    }
  }
  // Extend leaf color into transparent texels so mip filtering has no black fringe.
  for (let i = 0; i < pixels.length; i += 4)
    if (!pixels[i + 3]) {
      pixels[i] = conifer ? 67 : 100;
      pixels[i + 1] = conifer ? 93 : 123;
      pixels[i + 2] = conifer ? 65 : 61;
    }
  const texture = new T.DataTexture(pixels, size, size, T.RGBAFormat);
  texture.colorSpace = T.SRGBColorSpace;
  // Preserve cutout coverage as individual leaves become subpixel. Ordinary
  // averaged alpha mipmaps otherwise erase an entire sparse crown at altitude.
  const cutoff = 0.3 * 255;
  const coverage =
    pixels.reduce((sum, value, i) => sum + (i % 4 === 3 && value >= cutoff ? 1 : 0), 0) /
    (size * size);
  const mipmaps = [{ data: pixels, width: size, height: size }];
  let previous = pixels,
    width = size;
  while (width > 1) {
    const nextWidth = width / 2,
      next = new Uint8Array(nextWidth * nextWidth * 4);
    for (let y = 0; y < nextWidth; y++)
      for (let x = 0; x < nextWidth; x++) {
        for (let channel = 0; channel < 4; channel++) {
          let sum = 0;
          for (let dy = 0; dy < 2; dy++)
            for (let dx = 0; dx < 2; dx++)
              sum += previous[((y * 2 + dy) * width + x * 2 + dx) * 4 + channel];
          next[(y * nextWidth + x) * 4 + channel] = Math.round(sum / 4);
        }
      }
    // Always downsample the unadjusted alpha; scaling must not accumulate.
    previous = next.slice();
    const alphas = Array.from({ length: nextWidth * nextWidth }, (_, i) => next[i * 4 + 3]).sort(
      (a, b) => b - a,
    );
    const target = Math.max(1, Math.round(coverage * alphas.length));
    const scale = (cutoff + 1) / Math.max(1, alphas[target - 1]);
    for (let i = 3; i < next.length; i += 4) next[i] = Math.min(255, Math.round(next[i] * scale));
    mipmaps.push({ data: next, width: nextWidth, height: nextWidth });
    width = nextWidth;
  }
  texture.mipmaps = mipmaps;
  texture.generateMipmaps = false;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  textures.set(key, texture);
  return texture;
}
