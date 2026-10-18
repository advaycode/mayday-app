import { Canvas, Fill, Shader, Skia, useClock } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

/**
 * The presence indicator: a slow-breathing sphere of light.
 *
 * It is a single fragment shader (SkSL) run by Skia on the GPU, so it costs
 * almost nothing on the JS thread. Three inputs drive it:
 *   - time     a slow breath (one cycle every 6 s) and drifting inner texture
 *   - level    microphone amplitude, 0..1: the orb swells when you speak
 *   - pulse    a decaying 0..1 kick on every compression beat
 * Film grain on top keeps the gradient from banding on cheap panels.
 */
const source = Skia.RuntimeEffect.Make(`
uniform float2 res;
uniform float time;
uniform float level;
uniform float pulse;
uniform float3 tint;
uniform float energy;

float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }

float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + float2(1.0, 0.0)), u.x),
             mix(hash(i + float2(0.0, 1.0)), hash(i + float2(1.0, 1.0)), u.x), u.y);
}

float fbm(float2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

half4 main(float2 xy) {
  float2 uv = (xy - res * 0.5) / min(res.x, res.y);
  float r = length(uv);

  // One breath every 6 seconds: about ten breaths a minute.
  float breath = 0.5 + 0.5 * sin(time * 6.2831853 / 6.0);
  float radius = 0.24 + 0.018 * breath + 0.05 * level + 0.035 * pulse;

  // The rim wobbles very slightly, more when someone is speaking.
  float ang = atan(uv.y, uv.x);
  float wob = fbm(float2(cos(ang), sin(ang)) * 1.4 + time * (0.05 + 0.25 * energy));
  float edge = radius + (wob - 0.5) * (0.018 + 0.05 * level);

  // A soft-edged sphere of light: bright, slightly off-centre core, gentle
  // falloff, and only a whisper of drifting texture inside so it reads as
  // light rather than as a planet.
  float body = smoothstep(edge, edge - 0.22, r);
  float halo = exp(-max(r - edge, 0.0) * 9.0) * (0.16 + 0.3 * pulse + 0.25 * level);

  float flow = fbm(uv * 1.6 + float2(time * 0.03, -time * 0.024));
  float2 lightPos = float2(-0.05, -0.07) * radius / 0.24;
  float core = pow(max(0.0, 1.0 - length(uv - lightPos) / (edge * 1.05)), 2.2);
  float3 col = tint * (0.55 + 0.18 * flow) * body;
  col += tint * halo;
  col += mix(tint, float3(1.0, 0.985, 0.95), 0.6) * core * (0.55 + 0.25 * pulse);

  float alpha = clamp(body + halo, 0.0, 1.0);
  float grain = (hash(xy + fract(time) * 91.7) - 0.5) * 0.05;
  col = max(col + grain * alpha, 0.0);
  return half4(half3(col * alpha), half(alpha));
}
`)!;

type Props = {
  size: number;
  /** Microphone amplitude, 0..1. */
  level?: SharedValue<number>;
  /** Beat pulse, 0..1, set to 1 on each compression and decayed by the caller. */
  pulse?: SharedValue<number>;
  /** Light colour as RGB 0..1. */
  tint?: [number, number, number];
  /** 0 = calm drift, 1 = alert (faster inner motion). */
  energy?: number;
};

const WARM: [number, number, number] = [0.86, 0.78, 0.62];

export function Orb({ size, level, pulse, tint = WARM, energy = 0 }: Props) {
  const clock = useClock();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const uniforms = useDerivedValue(() => ({
    res: [size, size],
    time: reduceMotion ? 1.5 : clock.value / 1000,
    level: level?.value ?? 0,
    pulse: pulse?.value ?? 0,
    tint,
    energy,
  }));

  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Fill>
        <Shader source={source} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}
