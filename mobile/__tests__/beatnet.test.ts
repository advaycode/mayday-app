import { features, NETS, pickBeats, runNet } from '@/sensors/beatnet';
import { analyzeHeart } from '@/sensors/heart';

import fixture from './fixtures/beatnet-fixture.json';

/**
 * The heartbeat model as the app runs it must give the same answer as the
 * model that was trained and scored (tools/heart_ml/train.py): the same raw
 * window in, the same beat probabilities out. If the input preparation here
 * drifts from tools/heart_ml/dsp.py by even a filter detail, this fails.
 */
const maxDiff = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
};

describe('BeatNet in the app = BeatNet as trained', () => {
  it('accelerometer model, on a real recording (CEBS)', () => {
    const f = fixture.vibration;
    const prob = runNet(NETS.vibration, features(f.z, null, f.fs));
    expect(prob.length).toBe(f.prob.length);
    expect(maxDiff(prob, f.prob)).toBeLessThan(1e-3);
    expect(pickBeats(NETS.vibration, prob)).toEqual(pickBeats(NETS.vibration, Float64Array.from(f.prob)));
  });

  it('accelerometer + gyroscope model, on a simulated person', () => {
    const f = fixture.both;
    const prob = runNet(NETS.both, features(f.z, f.rot, f.fs));
    expect(prob.length).toBe(f.prob.length);
    expect(maxDiff(prob, f.prob)).toBeLessThan(1e-3);
    expect(pickBeats(NETS.both, prob)).toEqual(pickBeats(NETS.both, Float64Array.from(f.prob)));
  });

  it('is small and quick enough for a phone', () => {
    expect(NETS.vibration.params).toBeLessThan(10_000);
    expect(NETS.both.params).toBeLessThan(10_000);
    const f = fixture.both;
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) analyzeHeart(f.z, f.fs, false, f.rot);
    expect((performance.now() - t0) / 5).toBeLessThan(250);
  });
});
