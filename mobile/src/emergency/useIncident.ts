import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { audio } from '@/audio/engine';
import systemLines from '@/audio/systemLines.json';
import { CALL_COUNTDOWN_S } from '@/config';
import { haptic } from '@/design/haptics';
import type { LogEntry } from '@/incident/log';
import { getFix, type Fix } from '@/location/location';
import { currentStep, reduce, type Effect, type EngineEvent, type EngineState, type Slots } from '@/protocols/engine';
import { protocols } from '@/protocols';
import type { Intent, Step } from '@/protocols/schema';
import { askModel, online } from '@/ai/proxy';
import { answer, isQuestion, passagesFor } from '@/voice/answer';
import { isEcho } from '@/voice/echo';
import { routeWithModel } from '@/voice/llmRouter';
import { normalizeUtterance, route } from '@/voice/router';
import { NUDGE_SUFFIX, personalConfirm } from '@/voice/adapt';
import { hearRescuer, prepare, resetVoice, say, sinceHeard, voiceContext } from '@/voice/voice';
import type { ProtocolId, QuestionId, RouterSlots } from '@/voice/routerSchema';

import { placeCall, type CallHow } from './call';

/**
 * The incident controller: everything that happens between pressing the
 * emergency button and handing over to paramedics.
 *
 *   - the protocol engine (pure, in src/protocols/engine.ts)
 *   - the 911 countdown and call state
 *   - what the person says, routed to a protocol or a command
 *   - what we say back, adapted to who is being helped and how the
 *     rescuer sounds (src/voice/voice.ts)
 *   - the timestamped incident log for the handoff
 */

export type CallStatus = 'countdown' | 'calling' | 'cancelled' | 'delegated';
export type Phase = 'intake' | 'protocol' | 'handoff';

export type IncidentState = {
  startedAt: number;
  phase: Phase;
  engine: EngineState | null;
  /** Facts known before a protocol started (the engine owns them after). */
  slots: Slots;
  log: LogEntry[];
  call: { status: CallStatus; endsAt: number; placedAt: number | null; how: CallHow | null };
  heard: { text: string; final: boolean } | null;
  question: QuestionId | null;
  /** The last answer to an open question, with where it came from. */
  answerSource: string | null;
  fix: Fix | null;
};

const L = systemLines.lines;

/** The spoken lines of the steps after `stepId`, in order, for the model to phrase ahead of time. */
function upcoming(protocolId: string, stepId: string | null): string[] {
  const steps = protocols[protocolId]?.steps ?? [];
  const from = stepId ? steps.findIndex((s) => s.id === stepId) : -1;
  return steps.slice(from + 1).flatMap((s) => [...s.say, ...(s.kind === 'hold' || s.kind === 'cpr' ? s.reminders : [])]);
}

function recentlySaid(): string[] {
  return audio()?.recentlySaid() ?? [];
}

export function useIncident() {
  const [state, setState] = useState<IncidentState>(() => {
    resetVoice();
    return {
    startedAt: Date.now(),
    phase: 'intake',
    engine: null,
    slots: {},
    log: [{ at: Date.now(), text: 'Emergency mode started' }],
    call: { status: 'countdown', endsAt: Date.now() + CALL_COUNTDOWN_S * 1000, placedAt: null, how: null },
    heard: null,
    question: null,
    answerSource: null,
    fix: null,
    };
  });
  const ref = useRef(state);
  ref.current = state;

  const update = useCallback((fn: (s: IncidentState) => IncidentState) => {
    ref.current = fn(ref.current);
    setState(ref.current);
  }, []);

  const log = useCallback((text: string, at = Date.now()) => update((s) => ({ ...s, log: [...s.log, { at, text }] })), [update]);

  /** Carry out what the engine asked for. */
  const run = useCallback(
    (effects: Effect[], prefix: string[] = []) => {
      const logs = effects.filter((e): e is Extract<Effect, { type: 'log' }> => e.type === 'log');
      if (logs.length) update((s) => ({ ...s, log: [...s.log, ...logs.map((e) => ({ at: e.at, text: e.text }))] }));
      const enter = effects.find((e): e is Extract<Effect, { type: 'enter' }> => e.type === 'enter');
      const lines = [...prefix, ...effects.flatMap((e) => (e.type === 'say' ? e.lines : []))];
      if (enter) {
        haptic('navigate');
        // Phrase the next steps for this patient while this one runs.
        const st = ref.current.engine;
        if (st && (voiceContext().relation || voiceContext().pronoun !== 'they')) prepare(upcoming(st.protocolId, enter.step.id));
      }
      // The CPR coach speaks its own intro so the first count lands exactly
      // after it; everything else is spoken here.
      if (enter?.step.kind === 'cpr') {
        if (prefix.length) say(prefix);
        return;
      }
      if (lines.length) say(lines);
    },
    [update],
  );

  const dispatch = useCallback(
    (event: EngineEvent, prefix: string[] = []) => {
      const result = reduce(ref.current.engine, event);
      update((s) => ({ ...s, engine: result.state, answerSource: null }));
      run(result.effects, prefix);
      return result.effects;
    },
    [run, update],
  );

  // --- Starting a protocol -------------------------------------------------

  const startProtocol = useCallback(
    (protocolId: ProtocolId, extra: Slots = {}, from: 'voice' | 'tap' = 'tap') => {
      const slots = { ...ref.current.slots, ...extra };
      const confirmKey = protocolId.startsWith('cpr') && slots.breathing !== 'abnormal' ? 'cpr_check' : protocolId;
      const said = (systemLines.confirm as Record<string, string>)[confirmKey];
      // "Your dad isn't breathing." when we know who it is.
      const confirm = from === 'voice' && said ? [personalConfirm(said, voiceContext())] : [];
      if (voiceContext().relation || voiceContext().pronoun !== 'they') prepare(upcoming(protocolId, null));
      update((s) => ({ ...s, phase: 'protocol', slots, question: null }));
      dispatch({ type: 'start', protocolId, slots, at: Date.now() }, confirm);
    },
    [dispatch, update],
  );

  /** Switch adult/child/infant variant in place, keeping the step if it exists there. */
  const setAge = useCallback(
    (age: 'adult' | 'child' | 'infant') => {
      const s = ref.current;
      if (!s.engine) {
        update((x) => ({ ...x, slots: { ...x.slots, age_group: age } }));
        return;
      }
      const family = s.engine.protocolId.startsWith('cpr') ? 'cpr' : s.engine.protocolId.startsWith('choking') ? 'choking' : null;
      dispatch({ type: 'setSlots', slots: { age_group: age }, at: Date.now() });
      if (!family) return;
      const target = family === 'cpr' ? `cpr_${age}` : age === 'infant' ? 'choking_infant' : 'choking';
      if (target === s.engine.protocolId) return;
      log(`Age set to ${age}`);
      const sameStep = protocols[target].steps.some((st) => st.id === s.engine!.stepId);
      dispatch({ type: 'goto', ref: sameStep ? `@${target}#${s.engine.stepId}` : `@${target}`, at: Date.now() });
    },
    [dispatch, log, update],
  );

  // --- The call ------------------------------------------------------------

  const call = useCallback(async (): Promise<CallHow | null> => {
    if (ref.current.call.status === 'calling') return null;
    // Mark it immediately so a second tick of the countdown cannot dial twice.
    update((s) => ({ ...s, call: { ...s.call, status: 'calling', placedAt: Date.now() } }));
    const how = await placeCall();
    update((s) => ({ ...s, call: { ...s.call, status: 'calling', placedAt: Date.now(), how } }));
    log('Practice call (nothing dialed)');
    haptic('start');
    say([L.calling, L.speaker]);
    return how;
  }, [log, update]);

  const cancelCall = useCallback(() => {
    update((s) => ({ ...s, call: { ...s.call, status: 'cancelled' } }));
    log('911 countdown cancelled');
    say([L.callCancelled]);
  }, [log, update]);

  const delegateCall = useCallback(() => {
    update((s) => ({ ...s, call: { ...s.call, status: 'delegated' } }));
    log('Bystander calling 911');
    say([L.someoneCalling]);
  }, [log, update]);

  // --- Hearing -----------------------------------------------------------------

  const hearPartial = useCallback((text: string) => {
    if (isEcho(text, recentlySaid())) return;
    // Barge-in: the person is talking, so we stop talking.
    if (text.split(' ').length >= 2) audio()?.stopSpeech();
    update((s) => ({ ...s, heard: { text, final: false } }));
  }, [update]);

  const hear = useCallback(
    (text: string) => {
      if (isEcho(text, recentlySaid())) return;
      hearRescuer(text);
      update((s) => ({ ...s, heard: { text, final: true } }));
      const s = ref.current;
      const inProtocol = s.phase === 'protocol' && !!s.engine;
      const known = s.engine?.slots ?? s.slots;
      const r = route(text, { inProtocol, known: known as RouterSlots });

      if (!inProtocol) {
        // Life threat or a confident match: start now. Nothing waits on a model.
        if (r.protocol_id && (r.urgent || r.confidence >= 0.7)) {
          log(`Heard: "${text}"`);
          startProtocol(r.protocol_id, r.slots, 'voice');
          return;
        }
        update((x) => ({ ...x, slots: { ...x.slots, ...r.slots }, question: r.next_question }));
        // Unsure. Ask a fixed question now, and (if online) let the model take a look.
        say([r.next_question === 'age' ? L.askAge : L.askWhat]);
        routeWithModel(text, { phase: 'intake', slots: known }).then((m) => {
          if (m && m.protocol_id && m.confidence >= 0.75 && ref.current.phase === 'intake') {
            log(`Heard: "${text}" (model)`);
            startProtocol(m.protocol_id, m.slots, 'voice');
          }
        });
        return;
      }

      // In a protocol.
      if (Object.keys(r.slots).length) dispatch({ type: 'setSlots', slots: r.slots, at: Date.now() });
      if (r.intent === 'ems_here') {
        handoff();
        return;
      }
      if (r.intent === 'tired') {
        say(['Switch with someone if you can. Keep going.']);
        log('Rescuer tired');
        return;
      }
      // Lost ("what?", "I don't understand"): the same step again, slower.
      const intent = r.intent ?? (voiceContext().state === 'confused' && voiceContext().stateAt > Date.now() - 1000 ? 'repeat' : null);
      if (intent) {
        const effects = dispatch({ type: 'intent', intent: intent as Intent, at: Date.now() });
        if (!effects.some((e) => e.type === 'unhandled')) return;
      }
      // "No, he's not responding" to "Is he breathing normally?": the leading word answers the question.
      const lead = normalizeUtterance(text).match(/^(no|nope|nah|yes|yeah|yep|yup)\b/);
      if (lead && intent !== 'yes' && intent !== 'no') {
        const effects = dispatch({ type: 'intent', intent: lead[1].startsWith('n') ? 'no' : 'yes', at: Date.now() });
        if (!effects.some((e) => e.type === 'unhandled')) return;
      }
      // A new, more serious emergency mid-protocol ("now he's not breathing").
      if (r.urgent && r.protocol_id && s.engine && !s.engine.protocolId.startsWith(r.protocol_id.split('_')[0])) {
        log(`Heard: "${text}"`);
        startProtocol(r.protocol_id, r.slots, 'voice');
        return;
      }
      if (isQuestion(text)) {
        const step = s.engine ? currentStep(s.engine) : null;
        const inCompressions = step?.kind === 'cpr';
        log(`Asked: "${text}"`);
        const offline = () => {
          const a = answer(text, s.engine?.protocolId ?? null, inCompressions);
          if (a.kind === 'card') update((x) => ({ ...x, answerSource: a.source }));
          say(a.lines);
        };
        if (!online()) return offline();
        // Online: Claude may rephrase, but only from the cited answer cards we picked.
        const passages = passagesFor(text, s.engine?.protocolId ?? null);
        if (!passages.length) return offline();
        askModel(text, passages, inCompressions).then((m) => {
          if (!m || !m.grounded) return offline();
          const cited = passages.find((p) => p.id === m.cite[0]);
          update((x) => ({ ...x, answerSource: cited?.source ?? null }));
          say(m.say);
        });
      }
    },
    // handoff is stable (defined below with useCallback); referenced lazily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, log, startProtocol, update],
  );

  /** Back from the paramedic screen to whatever was running. */
  const resume = useCallback(() => update((s) => ({ ...s, phase: s.engine ? 'protocol' : 'intake' })), [update]);

  const handoff = useCallback(() => {
    update((s) => ({ ...s, phase: 'handoff' }));
    log('Paramedics arrived');
    say([L.emsHere]);
  }, [log, update]);

  // --- Location, once ---------------------------------------------------------
  useEffect(() => {
    let alive = true;
    getFix().then((fix) => alive && update((s) => ({ ...s, fix })));
    return () => {
      alive = false;
    };
  }, [update]);

  const step: Step | null = useMemo(() => (state.engine ? currentStep(state.engine) : null), [state.engine]);

  // --- Silence on a yes/no question: ask once more, shorter ----------------------
  const askKey = step?.kind === 'ask' ? `${state.engine?.protocolId}#${step.id}#${state.engine?.trail.length}` : null;
  useEffect(() => {
    if (!askKey || !step || step.kind !== 'ask') return;
    const yesNo = step.choices.some((c) => c.intents.includes('yes')) && step.choices.some((c) => c.intents.includes('no'));
    const question = step.say[step.say.length - 1];
    if (!yesNo || !question) return;
    const timer = setTimeout(() => {
      if (sinceHeard() >= 9000 && ref.current.phase === 'protocol') say([question, NUDGE_SUFFIX], { calm: false });
    }, 10_000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askKey]);
  const slots = state.engine?.slots ?? state.slots;

  return {
    state,
    step,
    slots,
    startProtocol,
    setAge,
    dispatch,
    call,
    cancelCall,
    delegateCall,
    hear,
    hearPartial,
    handoff,
    resume,
    log,
  };
}

export type Incident = ReturnType<typeof useIncident>;
