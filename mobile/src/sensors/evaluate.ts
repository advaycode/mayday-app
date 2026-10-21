import { analyze, suggestAnswer, type BreathStatus } from './analyze';
import { SCENARIOS, simulate, type Scenario, type SimOptions } from './sim';

/**
 * Simulated bench tests: many simulated people per scenario, each with
 * different breathing, body shape, heart and sensor noise, run through the
 * same analysis the phone runs. Two modes, as in the app:
 *
 *   check  the 10-second "Breathing normally?" check in an emergency
 *   lab    the practice screen: 30 s of breathing, 10 s for the heartbeat
 */
export type TrialResult = {
  scenario: Scenario;
  expect: BreathStatus;
  status: BreathStatus;
  suggest: 'abnormal' | null;
  truthRate: number | null;
  rate: number | null;
  truthHeart: number | null;
  heart: number | null;
  heartFound: boolean;
};

export function trial(scenario: Scenario, seed: number, mode: 'check' | 'lab', sensor: Partial<SimOptions> = {}): TrialResult {
  const meta = SCENARIOS.find((s) => s.id === scenario)!;
  const seconds = mode === 'check' ? 11.5 : 32;
  const { samples, truth } = simulate({ scenario, seconds, seed, jitterMs: 2, dropRate: 0.01, ...sensor });
  const r = analyze(samples, { age: meta.age, window: mode === 'check' ? 10 : 30, heart: mode === 'lab', heartWindow: 10, sync: mode === 'lab' });
  const status = r?.breath.status ?? 'unknown';
  return {
    scenario,
    expect: truth.expect,
    status,
    suggest: r ? suggestAnswer(r.breath) : null,
    truthRate: truth.breathsPerMin,
    rate: r?.breath.perMin ?? null,
    truthHeart: truth.heartPerMin,
    heart: r?.heart?.perMin ?? null,
    heartFound: r?.heart?.status === 'found',
  };
}

const NOT_NORMAL: BreathStatus[] = ['none', 'irregular', 'seesaw'];

export type ScenarioStats = {
  scenario: Scenario;
  label: string;
  expect: BreathStatus;
  trials: number;
  /** Share with exactly the expected status. */
  correct: number;
  /** Share the analysis called regular breathing. Must be 0 for every not-breathing-normally scenario. */
  saidRegular: number;
  /** Share where the app would suggest "start CPR". */
  saidStartCpr: number;
  counts: Partial<Record<BreathStatus, number>>;
  /** Breathing rate error, breaths a minute (regular results only). */
  rateMae: number | null;
  /** Heartbeat found, and its error in beats a minute. */
  heartFound: number | null;
  heartMae: number | null;
};

export function evaluate(mode: 'check' | 'lab', trials: number, sensor: Partial<SimOptions> = {}, seed0 = 1): ScenarioStats[] {
  return SCENARIOS.map((sc) => {
    const results = Array.from({ length: trials }, (_, k) => trial(sc.id, seed0 + k * 7919, mode, sensor));
    const counts: Partial<Record<BreathStatus, number>> = {};
    for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;
    const rated = results.filter((r) => r.status === 'regular' && r.rate !== null && r.truthRate !== null);
    const hearts = results.filter((r) => r.truthHeart !== null);
    const found = hearts.filter((r) => r.heartFound);
    const share = (k: number) => Math.round((k / results.length) * 1000) / 1000;
    return {
      scenario: sc.id,
      label: sc.label,
      expect: sc.expect,
      trials: results.length,
      correct: share(results.filter((r) => r.status === r.expect || (NOT_NORMAL.includes(r.expect) && r.expect !== 'seesaw' && NOT_NORMAL.includes(r.status) && r.status !== 'seesaw')).length),
      saidRegular: share(results.filter((r) => r.status === 'regular').length),
      saidStartCpr: share(results.filter((r) => r.suggest === 'abnormal').length),
      counts,
      rateMae: rated.length ? Math.round((rated.reduce((s, r) => s + Math.abs(r.rate! - r.truthRate!), 0) / rated.length) * 100) / 100 : null,
      heartFound: mode === 'lab' ? (sc.heart ? share(found.length) : share(results.filter((r) => r.heartFound).length)) : null,
      heartMae: found.length ? Math.round((found.reduce((s, r) => s + Math.abs(r.heart! - r.truthHeart!), 0) / found.length) * 10) / 10 : null,
    };
  });
}
