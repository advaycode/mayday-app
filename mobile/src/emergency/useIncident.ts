import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { audio } from '@/audio/engine';
import systemLines from '@/audio/systemLines.json';
import { haptic } from '@/design/haptics';
import { summaryLine, type LogEntry } from '@/incident/log';
import { getFix, type Fix } from '@/location/location';
import { canGoBack, currentStep, reduce, type Effect, type EngineEvent, type EngineState, type Slots } from '@/protocols/engine';
import { protocols, sources } from '@/protocols';
import type { Intent, Step } from '@/protocols/schema';
import { askModel, online } from '@/ai/proxy';
import { getLive, resetLive } from '@/sensors/live';
import { ANSWER_THRESHOLD, answer, guideFor, isQuestion, passagesFor, rank } from '@/voice/answer';
import { dispatchAsk, dispatchLines } from '@/voice/dispatchTalk';
import { echoKind, echoOverlap, isEchoPartial, withoutReassurance } from '@/voice/echo';
import { routeWithModel } from '@/voice/llmRouter';
import { afterOpen, sensorAsk, sensorReply } from '@/voice/sensorTalk';
import { normalizeUtterance, route } from '@/voice/router';
import { assess, currentState, NUDGE_SUFFIX, personalConfirm, personalize, voiceRate } from '@/voice/adapt';
import { since, trace } from '@/voice/trace';
import { choicesOf, pickHeard, quickAnswer } from '@/voice/understand';
import { announcement, categoryOf, cuesIn, grade, type Level, type Observation } from '@/triage/severity';
import { detectLang, gloss, setLang } from '@/voice/lang';
import { hearRescuer, prepare, resetVoice, say, sinceHeard, voiceContext } from '@/voice/voice';
import type { ProtocolId, QuestionId, RouterSlots } from '@/voice/routerSchema';

/**
 * The incident controller: everything that happens between opening help and
 * handing over to paramedics. Mayday never calls 911; the person does.
 *
 *   - the protocol engine (pure, in src/protocols/engine.ts), with Back
 *   - what the person says, routed to a protocol or a command
 *   - what we say back, adapted to who is being helped and how the
 *     rescuer sounds (src/voice/voice.ts)
 *   - the timestamped incident log for the handoff
 */

export type Phase = 'intake' | 'protocol' | 'handoff';

export type IncidentState = {
  startedAt: number;
  phase: Phase;
  engine: EngineState | null;
  /** Facts known before a protocol started (the engine owns them after). */
  slots: Slots;
  log: LogEntry[];
  heard: { text: string; final: boolean } | null;
  /** The last thing said that Mayday acted on, shown briefly so the person knows it was heard. */
  understood: { text: string; at: number } | null;
  question: QuestionId | null;
  /** The last answer to an open question, with where it came from. */
  answerSource: string | null;
  fix: Fix | null;
  /** Bumped when the voice asks about 911: the screen opens the 911 card. */
  show911: number;
  /** What Mayday last answered, shown as a caption for a few seconds (a loud room can drown the voice). */
  reply: { lines: string[]; source: string | null; at: number } | null;
  /** What the rescuer said or tapped, for the severity grade (src/triage/severity.ts). */
  observations: Observation[];
  /** Per emergency, the highest severity evidence has reached: it never goes down. */
  sevPeak: Record<string, { level?: Level; degree?: Level }>;
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
    resetLive();
    return {
    startedAt: Date.now(),
    phase: 'intake',
    engine: null,
    slots: {},
    log: [{ at: Date.now(), text: 'Help started' }],
    heard: null,
    understood: null,
    question: null,
    answerSource: null,
    fix: null,
    show911: 0,
    reply: null,
    observations: [],
    sevPeak: {},
    };
  });
  const ref = useRef(state);
  ref.current = state;

  const update = useCallback((fn: (s: IncidentState) => IncidentState) => {
    ref.current = fn(ref.current);
    setState(ref.current);
  }, []);

  const log = useCallback((text: string, at = Date.now()) => update((s) => ({ ...s, log: [...s.log, { at, text }] })), [update]);

  // --- Severity -------------------------------------------------------------------
  // Graded after every answer and everything heard; a rise is said before the
  // next lines (or on its own), so it never cuts a step off.
  const announced = useRef<Record<string, { level: Level; degree: Level | null; guess: boolean }>>({});
  const pending = useRef<string[]>([]);
  const regrade = useCallback(() => {
    const s = ref.current;
    const pid = s.engine?.protocolId ?? null;
    const cat = categoryOf(pid);
    if (!cat || !pid) return;
    const g = grade(pid, (s.engine?.slots ?? s.slots) as Slots, s.log, s.observations, s.sevPeak[cat]);
    if (!g) return;
    const before = announced.current[cat] ?? null;
    if (!g.guess) {
      const peak = s.sevPeak[cat] ?? {};
      if (g.level !== peak.level || (g.degree ?? undefined) !== peak.degree) {
        update((x) => ({ ...x, sevPeak: { ...x.sevPeak, [cat]: { level: g.level, ...(g.degree ? { degree: g.degree } : {}) } } }));
      }
    }
    const news = announcement(before, g);
    announced.current[cat] = { level: g.level, degree: g.degree, guess: g.guess };
    if (before?.level !== g.level || before?.degree !== g.degree || before?.guess !== g.guess) {
      trace('severity', { category: g.category, level: g.level, name: g.name, degree: g.degree, guess: g.guess, action: g.action, signals: g.signals, said: news });
      if (!g.guess) log(`Severity: level ${g.level}${g.degree ? `, ${['', 'first', 'second', 'third'][g.degree]} degree burn` : ''}`);
    }
    pending.current.push(...news);
  }, [log, update]);

  /** Everything the incident says goes through here, so a severity change is said first. */
  const speak = useCallback((lines: string[], opts?: Parameters<typeof say>[1]) => {
    const news = pending.current.splice(0);
    return say([...news, ...lines], opts);
  }, []);

  /** Carry out what the engine asked for. */
  const run = useCallback(
    (effects: Effect[], prefix: string[] = []) => {
      const logs = effects.filter((e): e is Extract<Effect, { type: 'log' }> => e.type === 'log');
      if (logs.length) update((s) => ({ ...s, log: [...s.log, ...logs.map((e) => ({ at: e.at, text: e.text }))] }));
      const enter = effects.find((e): e is Extract<Effect, { type: 'enter' }> => e.type === 'enter');
      const lines = [...prefix, ...effects.flatMap((e) => (e.type === 'say' ? e.lines : []))];
      if (enter) {
        haptic('navigate');
        trace('step', {
          protocol: enter.protocolId,
          step: enter.step.id,
          stepKind: enter.step.kind,
          text: enter.step.text,
          skipped: logs.filter((e) => e.text.includes('already known')).map((e) => e.text),
          revisit: enter.reentry,
        });
        // Phrase the next steps for this patient while this one runs.
        const st = ref.current.engine;
        if (st && (voiceContext().relation || voiceContext().pronoun !== 'they')) prepare(upcoming(st.protocolId, enter.step.id));
      }
      regrade();
      // The CPR coach speaks its own intro so the first count lands exactly
      // after it; everything else is spoken here.
      if (enter?.step.kind === 'cpr') {
        if (prefix.length) speak(prefix);
        return;
      }
      if (lines.length || pending.current.length) speak(lines);
    },
    [regrade, speak, update],
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

  /** Back one step (the engine forgets that step's answer and asks again). */
  const back = useCallback(() => {
    if (!canGoBack(ref.current.engine)) return;
    audio()?.stopSpeech();
    dispatch({ type: 'back', at: Date.now() });
  }, [dispatch]);

  // --- Hearing -----------------------------------------------------------------

  // Quick answers: a short answer that leads to more care ("no", "not breathing",
  // "done") is acted on once it has held still for a moment, without waiting
  // for the recognizer to close the sentence (which can take a second or more).
  // The final transcript of the same answer is then skipped.
  const committed = useRef<{ text: string; at: number } | null>(null);
  const earlyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hearRef = useRef<(text: string, alternatives?: string[]) => void>(() => {});

  const hearPartial = useCallback((text: string) => {
    if (isEchoPartial(text, recentlySaid())) return;
    // Barge-in: the person is talking, so we stop talking.
    if (text.split(' ').length >= 2) audio()?.stopSpeech();
    update((s) => ({ ...s, heard: { text, final: false } }));
    if (earlyTimer.current) clearTimeout(earlyTimer.current);
    earlyTimer.current = null;
    const s = ref.current;
    if (s.phase === 'protocol' && s.engine && quickAnswer(text, currentStep(s.engine))) {
      earlyTimer.current = setTimeout(() => {
        earlyTimer.current = null;
        trace('quick-answer', { text });
        hearRef.current(text);
        committed.current = { text: normalizeUtterance(text), at: Date.now() };
      }, 450);
    }
  }, [update]);

  // Heard clearly, but nothing to act on: say so, and ask again with the options. Never silence.
  const lastNotCaught = useRef(0);
  const notCaught = useCallback(() => {
    const s = ref.current;
    const step = s.engine ? currentStep(s.engine) : null;
    if (!step || step.kind === 'cpr' || step.kind === 'timer' || step.kind === 'hold') return;
    if (Date.now() - lastNotCaught.current < 9000) return;
    lastNotCaught.current = Date.now();
    const answers = choicesOf(step);
    // "Yes or no?" only where the buttons say yes and no.
    const yesNo = answers.some((c) => /^yes\b/i.test(c.label)) && answers.some((c) => /^no\b/i.test(c.label));
    const question = step.say[step.say.length - 1];
    const lines = step.kind === 'ask' ? [L.notCaught, question, yesNo ? NUDGE_SUFFIX : L.sayOrTap] : step.kind === 'do' ? [L.notCaught, L.sayDone] : [L.notCaught];
    trace('not-caught', { step: step.id, lines });
    say(lines, { calm: false });
  }, []);

  const hear = useCallback(
    (top: string, alternatives: string[] = []) => {
      if (earlyTimer.current) clearTimeout(earlyTimer.current);
      earlyTimer.current = null;
      // The same answer, already acted on while it was being said.
      const early = committed.current;
      committed.current = null;
      if (early && Date.now() - early.at < 4000 && normalizeUtterance(top).startsWith(early.text)) return;
      const t0 = performance.now();
      const recent = recentlySaid();
      // The echo check compares English words; Hindi has none, so it is compared as written.
      const devanagari = detectLang(top) === 'hi';
      const overlap = devanagari ? (recent.some((l) => l.includes(top.trim())) ? 1 : 0) : echoOverlap(top, recent);
      const kind = devanagari ? (overlap ? 'echo' : 'clear') : echoKind(top, recent);
      if (kind === 'echo') {
        trace('heard', { raw: top, clean: normalizeUtterance(top), echo: overlap, dropped: true });
        return;
      }
      // The recognizer's best guess, or a runner-up Mayday can act on (never one that reassures).
      const s0 = ref.current;
      const pid0 = s0.engine?.protocolId ?? null;
      const picked = alternatives.length
        ? pickHeard(
            [top, ...alternatives],
            { inProtocol: s0.phase === 'protocol' && !!s0.engine, known: (s0.engine?.slots ?? s0.slots) as RouterSlots },
            s0.engine ? currentStep(s0.engine) : null,
            (t) => !!dispatchAsk(t) || (isQuestion(t) && (rank(t, pid0)[0]?.score ?? 0) >= ANSWER_THRESHOLD),
          )
        : { text: top, index: 0 };
      const text = picked.text;
      const suspect = kind === 'suspect';
      // Only clear speech counts as evidence: a suspect transcript may be our own voice.
      if (kind === 'clear') update((x) => ({ ...x, observations: [...x.observations, { text, via: 'voice', at: Date.now() }] }));
      regrade();
      try {
        act();
      } finally {
        if (pending.current.length) speak([]);
      }
      function act() {
      // Spanish or Hindi: the conversation switches language, and the router hears the English gloss.
      const lang = detectLang(text);
      if (lang !== 'en') setLang(lang);
      const en = gloss(text, lang);
      hearRescuer(en);
      update((s) => ({ ...s, heard: { text, final: true } }));
      const ack = () => update((x) => ({ ...x, understood: { text, at: Date.now() } }));
      const s = ref.current;
      const inProtocol = s.phase === 'protocol' && !!s.engine;
      const known = s.engine?.slots ?? s.slots;
      const routed = route(en, { inProtocol, known: known as RouterSlots });
      const r = suspect ? withoutReassurance(routed) : routed;
      trace('heard', { raw: text, clean: normalizeUtterance(text), echo: overlap, dropped: false, suspect, alternatives, picked: picked.index });
      trace('route', { protocol: r.protocol_id, intent: r.intent, slots: r.slots, confidence: r.confidence, urgent: r.urgent, next: r.next_question, inProtocol, ms: since(t0) });
      const read = assess(text);
      const vc = voiceContext();
      trace('rescuer', {
        distress: read.distress,
        confusion: read.confusion,
        distressSignals: read.distressSignals,
        confusionSignals: read.confusionSignals,
        state: currentState(vc),
        stateAt: vc.stateAt,
        relation: vc.relation,
        pronoun: vc.pronoun,
        alone: vc.alone,
        rate: voiceRate(vc),
      });

      // "What do I tell 911?", "where am I?", "call 911": the script, and the 911 card.
      // Nothing is ever dialed. In intake, an emergency in the same breath comes first.
      const ask911 = dispatchAsk(text);
      if (ask911 && (inProtocol || !(r.protocol_id && (r.urgent || r.confidence >= 0.7)))) {
        ack();
        const summary = summaryLine(s.log, (s.engine?.slots ?? s.slots) as Slots, s.engine?.protocolId ?? null);
        const cur = s.engine ? currentStep(s.engine) : null;
        const lines = [...dispatchLines(ask911, s.fix, summary), ...(cur?.kind === 'ask' ? cur.say.slice(-1) : [])];
        if (ask911 !== 'where') update((x) => ({ ...x, show911: x.show911 + 1 }));
        else update((x) => ({ ...x, reply: { lines, source: null, at: Date.now() } }));
        trace('dispatch-talk', { ask: ask911, lines });
        log(`Asked about 911: "${text}"`);
        speak(lines);
        return;
      }

      if (!inProtocol) {
        // Life threat or a confident match: start now. Nothing waits on a model.
        if (r.protocol_id && (r.urgent || r.confidence >= 0.7)) {
          log(`Heard: "${text}"`);
          ack();
          startProtocol(r.protocol_id, r.slots, 'voice');
          return;
        }
        const guide = guideFor(text);
        if (guide) {
          ack();
          log(`Guidance: ${guide.id.replace('guide_', '').replace('_', ' ')}`);
          trace('guide', { id: guide.id, lines: guide.say });
          update((x) => ({ ...x, slots: { ...x.slots, ...r.slots }, reply: { lines: guide.say.map((l) => personalize(l, voiceContext().pronoun)), source: sources[guide.source]?.title ?? guide.source, at: Date.now() } }));
          speak(guide.say);
          return;
        }
        update((x) => ({ ...x, slots: { ...x.slots, ...r.slots }, question: r.next_question }));
        // Unsure. Ask a fixed question now, and (if online) let the model take a look.
        speak([r.next_question === 'age' ? L.askAge : L.askWhat]);
        routeWithModel(text, { phase: 'intake', slots: known }).then((m) => {
          if (m && m.protocol_id && m.confidence >= 0.75 && ref.current.phase === 'intake') {
            log(`Heard: "${text}" (model)`);
            ack();
            startProtocol(m.protocol_id, m.slots, 'voice');
          }
        });
        return;
      }

      // In a protocol.
      if (Object.keys(r.slots).length) dispatch({ type: 'setSlots', slots: r.slots, at: Date.now() });
      if (r.intent === 'ems_here') {
        ack();
        handoff();
        return;
      }
      if (r.intent === 'tired') {
        ack();
        speak(['Switch with someone if you can. Keep going.']);
        log('Rescuer tired');
        return;
      }
      // A fact that answers the question on screen answers it: "he's gasping" or
      // "he's gone blue" at "Breathing normally?", "he's out cold" at "Do they respond?".
      const onScreen = s.engine ? currentStep(s.engine) : null;
      if (!r.intent && onScreen?.kind === 'ask' && onScreen.slot) {
        const value = r.slots[onScreen.slot as keyof RouterSlots];
        const choice = value !== undefined ? onScreen.choices.find((c) => c.value === value) : undefined;
        if (choice) {
          ack();
          dispatch({ type: 'choose', choiceId: choice.id, at: Date.now() });
          return;
        }
      }
      // The phone's sensors: "check his breathing", "what did the phone see?", "how am I doing?".
      if (!r.intent || r.intent === 'next' || r.intent === 'repeat' || r.intent === 'what_now') {
        const cur = s.engine ? currentStep(s.engine) : null;
        const where = { stepKind: cur?.kind ?? null, breathingStep: cur?.kind === 'ask' && cur.slot === 'breathing' };
        const ask = sensorAsk(text, where);
        const reply = ask ? sensorReply(ask, getLive(), where) : null;
        if (ask && reply) {
          ack();
          let lines = reply.lines;
          let opened: string | null = null;
          if (reply.openCheck) {
            opened = getLive().phoneCheck?.() ?? 'unavailable';
            lines = afterOpen(opened as 'started' | 'needs-tap' | 'unavailable');
          }
          trace('sensor-talk', { ask, why: reply.why, opened, lines });
          log(`Asked the phone: "${text}" (${reply.why}${opened ? `, check ${opened}` : ''})`);
          if (lines.length) speak(lines);
          return;
        }
      }
      // A question we have a cited answer for is answered, even if it starts
      // with "what" ("what's an AED?" is not "what?").
      const best = !r.intent && isQuestion(text) ? rank(text, s.engine?.protocolId ?? null)[0] : undefined;
      const answerable = !!best && best.score >= ANSWER_THRESHOLD;
      // Lost ("what?", "I don't understand") or panicking ("I'm scared"): the same
      // step again, slower, and after panic with "I'm right here with you." first.
      const vc0 = voiceContext();
      const struggling = (vc0.state === 'confused' || vc0.state === 'panicked') && vc0.stateAt > Date.now() - 1000;
      const intent = r.intent ?? (!answerable && struggling ? 'repeat' : null);
      if (intent) {
        const effects = dispatch({ type: 'intent', intent: intent as Intent, at: Date.now() });
        if (!effects.some((e) => e.type === 'unhandled')) return ack();
      }
      // "No, he's not responding" to "Is he breathing normally?": the leading word answers the question.
      const lead = normalizeUtterance(en).match(/^(no|nope|nah|yes|yeah|yep|yup)\b/);
      if (lead && intent !== 'yes' && intent !== 'no' && !(suspect && lead[1].startsWith('y'))) {
        const effects = dispatch({ type: 'intent', intent: lead[1].startsWith('n') ? 'no' : 'yes', at: Date.now() });
        if (!effects.some((e) => e.type === 'unhandled')) return ack();
      }
      // A new, more serious emergency mid-protocol ("now he's not breathing").
      if (r.urgent && r.protocol_id && s.engine && !s.engine.protocolId.startsWith(r.protocol_id.split('_')[0])) {
        log(`Heard: "${text}"`);
        ack();
        startProtocol(r.protocol_id, r.slots, 'voice');
        return;
      }
      if (isQuestion(text)) {
        ack();
        const ranked = rank(text, s.engine?.protocolId ?? null).slice(0, 4);
        trace('answer', { question: text, threshold: ANSWER_THRESHOLD, candidates: ranked.map((c) => ({ id: c.card.id, score: c.score })), chosen: ranked[0] && ranked[0].score >= ANSWER_THRESHOLD ? ranked[0].card.id : null });
        const step = s.engine ? currentStep(s.engine) : null;
        const inCompressions = step?.kind === 'cpr';
        // Then back to where we were: the question on screen, asked again.
        const reask = step?.kind === 'ask' ? step.say.slice(-1) : [];
        log(`Asked: "${text}"`);
        const offline = () => {
          const a = answer(text, s.engine?.protocolId ?? null, inCompressions);
          update((x) => ({ ...x, answerSource: a.kind === 'card' ? a.source : null, reply: { lines: a.lines.map((l) => personalize(l, voiceContext().pronoun)), source: a.kind === 'card' ? a.source : null, at: Date.now() } }));
          speak([...a.lines, ...reask]);
        };
        if (!online()) return offline();
        // Online: Claude may rephrase, but only from the cited answer cards we picked.
        const passages = passagesFor(text, s.engine?.protocolId ?? null);
        if (!passages.length) return offline();
        askModel(text, passages, inCompressions).then((m) => {
          if (!m || !m.grounded) return offline();
          const cited = passages.find((p) => p.id === m.cite[0]);
          update((x) => ({ ...x, answerSource: cited?.source ?? null, reply: { lines: m.say, source: cited?.source ?? null, at: Date.now() } }));
          speak([...m.say, ...reask]);
        });
        return;
      }
      // Nothing to act on. If it told us how bad it is (severity) or a fact, that was enough;
      // otherwise say we did not catch it, rather than going quiet.
      const told = Object.keys(r.slots).length > 0 || (!!categoryOf(s.engine?.protocolId) && cuesIn(categoryOf(s.engine?.protocolId)!, en));
      if (kind === 'clear' && !told && !pending.current.length) notCaught();
      }
    },
    // handoff is stable (defined below with useCallback); referenced lazily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, log, notCaught, regrade, speak, startProtocol, update],
  );

  hearRef.current = hear;

  /** A tap on "what do you see?" in the severity card: evidence, like something said. */
  const observe = useCallback(
    (text: string) => {
      update((x) => ({ ...x, observations: [...x.observations, { text, via: 'tap', at: Date.now() }] }));
      log(`Severity check: ${text}`);
      regrade();
      if (pending.current.length) speak([]);
    },
    [log, regrade, speak, update],
  );

  /** Back from the paramedic screen to whatever was running. */
  const resume = useCallback(() => update((s) => ({ ...s, phase: s.engine ? 'protocol' : 'intake' })), [update]);

  const handoff = useCallback(() => {
    update((s) => ({ ...s, phase: 'handoff' }));
    log('Paramedics arrived');
    speak([L.emsHere]);
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
  // Not while something else has the floor (the phone is measuring the chest).
  const quiet = useRef(false);
  const setQuiet = useCallback((on: boolean) => {
    quiet.current = on;
  }, []);
  const askKey = step?.kind === 'ask' ? `${state.engine?.protocolId}#${step.id}#${state.engine?.trail.length}` : null;
  useEffect(() => {
    if (!askKey || !step || step.kind !== 'ask') return;
    const yesNo = step.choices.some((c) => c.intents.includes('yes')) && step.choices.some((c) => c.intents.includes('no'));
    const question = step.say[step.say.length - 1];
    if (!yesNo || !question) return;
    const timer = setTimeout(() => {
      if (!quiet.current && sinceHeard() >= 9000 && ref.current.phase === 'protocol') speak([question, NUDGE_SUFFIX], { calm: false });
    }, 10_000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askKey]);
  const slots = state.engine?.slots ?? state.slots;

  // The 911 script's live lines (the address, what happened) are voiced ahead
  // of time, whenever they change, so "what do I tell 911?" is answered at once.
  const summary911 = summaryLine(state.log, slots as Slots, state.engine?.protocolId ?? null);
  const fix = state.fix;
  useEffect(() => {
    if (!fix?.address) return;
    const t = setTimeout(() => audio()?.preload([...dispatchLines('script', fix, summary911), ...dispatchLines('where', fix, '')]), 1500);
    return () => clearTimeout(t);
  }, [fix, summary911]);
  // The severity grade for the screen (the same grade regrade() announces).
  const severity = useMemo(() => {
    const pid = state.engine?.protocolId ?? null;
    const cat = categoryOf(pid);
    return cat ? grade(pid, slots as Slots, state.log, state.observations, state.sevPeak[cat]) : null;
  }, [state.engine?.protocolId, slots, state.log, state.observations, state.sevPeak]);

  return {
    state,
    step,
    setQuiet,
    slots,
    severity,
    startProtocol,
    setAge,
    dispatch,
    back,
    canBack: canGoBack(state.engine),
    hear,
    hearPartial,
    observe,
    handoff,
    resume,
    log,
  };
}

export type Incident = ReturnType<typeof useIncident>;
