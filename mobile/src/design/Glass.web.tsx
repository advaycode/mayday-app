import { useEffect, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { radius as radii } from './tokens';

export type GlassProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  variant?: 'regular' | 'clear' | 'thick';
  tint?: string;
  interactive?: boolean;
};

/**
 * Liquid Glass for the web preview.
 *
 * A plain blur is frosted glass. What makes Apple's material read as *liquid*
 * is refraction at the rim: near the edge the glass bends light, so the
 * content behind it appears pulled toward the edge, like looking through the
 * curved side of a lens. We reproduce that with an SVG displacement filter
 * used as a CSS backdrop-filter:
 *
 *   1. For this element's exact size and corner radius, compute a signed
 *      distance to the rounded-rectangle edge for every pixel.
 *   2. Inside a thin bezel, write a displacement vector pointing inward,
 *      strongest at the rim and fading to zero, into the red (x) and green
 *      (y) channels of an image. 128 means "no displacement".
 *   3. feDisplacementMap uses that image to offset where each backdrop pixel
 *      is sampled from. The middle of the glass is untouched; only the rim
 *      bends.
 *
 * Chromium supports SVG filters inside backdrop-filter; other browsers get
 * the blur and the specular rim without refraction.
 */

const supportsRefraction =
  typeof navigator !== 'undefined' &&
  /Chrome|Chromium|Edg\//.test(navigator.userAgent) &&
  !/Firefox/.test(navigator.userAgent);

const SVG_NS = 'http://www.w3.org/2000/svg';
const filterCache = new Map<string, string>();
let defs: SVGDefsElement | null = null;

function ensureDefs(): SVGDefsElement {
  if (defs) return defs;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  defs = document.createElementNS(SVG_NS, 'defs');
  svg.appendChild(defs);
  document.body.appendChild(svg);
  return defs;
}

/** Signed distance from (px, py) to a rounded rectangle centred on the origin. Negative inside. */
function roundedRectSdf(px: number, py: number, hw: number, hh: number, r: number) {
  const qx = Math.abs(px) - hw + r;
  const qy = Math.abs(py) - hh + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - r;
}

function buildDisplacementMap(w: number, h: number, r: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(w, h);
  const hw = w / 2;
  const hh = h / 2;
  const bezel = Math.max(6, Math.min(20, Math.min(w, h) * 0.32));
  const eps = 0.75;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - hw;
      const py = y + 0.5 - hh;
      const d = roundedRectSdf(px, py, hw, hh, r);
      let dx = 0;
      let dy = 0;
      const depth = -d; // distance inward from the rim
      if (depth >= 0 && depth < bezel) {
        // Outward normal from the SDF gradient.
        const gx = roundedRectSdf(px + eps, py, hw, hh, r) - roundedRectSdf(px - eps, py, hw, hh, r);
        const gy = roundedRectSdf(px, py + eps, hw, hh, r) - roundedRectSdf(px, py - eps, hw, hh, r);
        const len = Math.hypot(gx, gy) || 1;
        // Lens profile: steepest at the rim, flat by the inner edge of the bezel.
        const t = 1 - depth / bezel;
        const strength = t * t;
        dx = (-gx / len) * strength;
        dy = (-gy / len) * strength;
      }
      const i = (y * w + x) * 4;
      img.data[i] = 128 + dx * 127;
      img.data[i + 1] = 128 + dy * 127;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

function useRefractionFilter(w: number, h: number, r: number, strengthPx: number): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    if (!supportsRefraction || w < 4 || h < 4) return;
    const W = Math.round(w);
    const H = Math.round(h);
    const R = Math.min(Math.round(r), Math.floor(Math.min(W, H) / 2));
    const key = `lg-${W}x${H}r${R}s${strengthPx}`;
    const cached = filterCache.get(key);
    if (cached) {
      setId(cached);
      return;
    }
    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', key);
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');
    filter.setAttribute('width', String(W));
    filter.setAttribute('height', String(H));
    filter.setAttribute('filterUnits', 'userSpaceOnUse');
    const feImage = document.createElementNS(SVG_NS, 'feImage');
    feImage.setAttribute('href', buildDisplacementMap(W, H, R));
    feImage.setAttribute('x', '0');
    feImage.setAttribute('y', '0');
    feImage.setAttribute('width', String(W));
    feImage.setAttribute('height', String(H));
    feImage.setAttribute('preserveAspectRatio', 'none');
    feImage.setAttribute('result', 'map');
    const feDisp = document.createElementNS(SVG_NS, 'feDisplacementMap');
    feDisp.setAttribute('in', 'SourceGraphic');
    feDisp.setAttribute('in2', 'map');
    feDisp.setAttribute('scale', String(strengthPx * 2));
    feDisp.setAttribute('xChannelSelector', 'R');
    feDisp.setAttribute('yChannelSelector', 'G');
    filter.appendChild(feImage);
    filter.appendChild(feDisp);
    ensureDefs().appendChild(filter);
    filterCache.set(key, key);
    setId(key);
  }, [w, h, r, strengthPx]);
  return id;
}

export function Glass({ children, style, radius = radii.lg, variant = 'regular', tint }: GlassProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const filterId = useRefractionFilter(size.w, size.h, radius, variant === 'clear' ? 14 : 10);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - size.w) > 0.5 || Math.abs(height - size.h) > 0.5) {
      setSize({ w: width, h: height });
    }
  };

  const blur = variant === 'clear' ? 3 : variant === 'thick' ? 28 : 14;
  const backdrop = `${filterId ? `url(#${filterId}) ` : ''}blur(${blur}px) saturate(1.7) brightness(1.06)`;

  return (
    <View onLayout={onLayout} style={[{ borderRadius: radius }, style]}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          pointerEvents: 'none',
          backdropFilter: backdrop,
          WebkitBackdropFilter: `blur(${blur}px) saturate(1.7)`,
          background:
            tint ??
            (variant === 'clear' ? 'rgba(242,239,232,0.025)' : variant === 'thick' ? 'rgba(22,21,19,0.88)' : 'rgba(242,239,232,0.06)'),
          // Rim light: a bright hairline on top where light hits the curve,
          // a fainter one underneath, and a soft shadow that lifts the glass.
          boxShadow: [
            'inset 0 1px 0.5px rgba(255,255,255,0.30)',
            'inset 0 -1px 1px rgba(255,255,255,0.08)',
            'inset 0 0 0 0.5px rgba(255,255,255,0.16)',
            '0 12px 32px rgba(5,4,3,0.38)',
            '0 2px 6px rgba(5,4,3,0.22)',
          ].join(', '),
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          pointerEvents: 'none',
          // Specular sheen: light falls from the top left and fades across the surface.
          background:
            'linear-gradient(155deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.03) 32%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.05) 100%)',
          mixBlendMode: 'screen',
        }}
      />
      {children}
    </View>
  );
}
