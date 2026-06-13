import type { Theme } from '@/types';

/**
 * Corporate-theme extraction — fully client-side.
 *
 *   - Logo image  -> dominant colors via canvas pixel quantization.
 *   - PPT template -> the deck's own `<a:clrScheme>` accent colors + major font.
 *
 * Both paths return the same {@link Theme} shape, so the rest of the app never
 * cares where the palette came from.
 */

export const DEFAULT_THEME: Theme = {
  name: '기본 테마',
  colors: ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'],
  fontFamily: 'Pretendard, "Malgun Gothic", system-ui, sans-serif',
};

const toHex = (n: number) => n.toString(16).padStart(2, '0');
const rgbToHex = (r: number, g: number, b: number) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

/** Perceived luminance; used to drop near-white/near-black background pixels. */
const luminance = (r: number, g: number, b: number) =>
  (0.299 * r + 0.587 * g + 0.114 * b) / 255;

/**
 * Extract a palette from a raster logo. Pixels are bucketed into a coarse RGB
 * grid; the most populous, sufficiently saturated buckets become the palette.
 */
export async function extractFromImage(file: File): Promise<Theme> {
  const bitmap = await createImageBitmap(file);

  // Downscale: 64px is plenty for a dominant-color read and keeps it instant.
  const scale = Math.min(1, 64 / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { ...DEFAULT_THEME, name: file.name };
  ctx.drawImage(bitmap, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 200) continue; // skip transparent

    const lum = luminance(r, g, b);
    if (lum > 0.92 || lum < 0.08) continue; // skip white/black backgrounds
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max - min < 16 && lum > 0.85) continue; // skip pale greys

    // Quantize to a 5-bit-per-channel grid for grouping.
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }

  const colors = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(({ count, r, g, b }) =>
      rgbToHex(Math.round(r / count), Math.round(g / count), Math.round(b / count)),
    );

  return {
    name: file.name,
    colors: colors.length > 0 ? colors : DEFAULT_THEME.colors,
    fontFamily: DEFAULT_THEME.fontFamily,
  };
}

const ACCENT_RE = /<a:accent\d[^>]*>[\s\S]*?<a:srgbClr val="([0-9A-Fa-f]{6})"/g;
const MAJOR_FONT_RE = /<a:majorFont>[\s\S]*?<a:latin[^>]*typeface="([^"]+)"/;

/**
 * Extract a palette + heading font from a `.pptx`/`.potx` template by reading
 * its embedded theme part. A .pptx is just a zip of XML, parsed here in-browser.
 */
export async function extractFromPptx(file: File): Promise<Theme> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const themeFile = Object.keys(zip.files).find((p) =>
    /ppt\/theme\/theme\d+\.xml$/.test(p),
  );
  if (!themeFile) return { ...DEFAULT_THEME, name: file.name };

  const xml = await zip.files[themeFile].async('text');

  const colors: string[] = [];
  for (const match of xml.matchAll(ACCENT_RE)) colors.push(`#${match[1]}`);

  const font = xml.match(MAJOR_FONT_RE)?.[1];

  return {
    name: file.name,
    colors: colors.length > 0 ? colors : DEFAULT_THEME.colors,
    fontFamily: font ? `${font}, ${DEFAULT_THEME.fontFamily}` : DEFAULT_THEME.fontFamily,
  };
}

/** Dispatch on file type so callers can hand off any supported theme source. */
export async function extractTheme(file: File): Promise<Theme> {
  if (/\.(pptx|potx)$/i.test(file.name)) return extractFromPptx(file);
  return extractFromImage(file);
}
