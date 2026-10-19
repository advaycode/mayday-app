import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { Microphone, MicrophoneSlash, X } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { audio, unlockAudio } from '@/audio/engine';
import systemLines from '@/audio/systemLines.json';
import { CALL_COUNTDOWN_S, DEMO_MODE } from '@/config';
import { CprView } from '@/emergency/CprView';
import { Handoff } from '@/emergency/Handoff';
import { Intake } from '@/emergency/Intake';
import { CallPill, DemoBanner, TopBar } from '@/emergency/parts';
import { DispatcherSheet, MoreSheet } from '@/emergency/sheets';
import { ScanSheet } from '@/emergency/ScanSheet';
import { StepView } from '@/emergency/StepView';
import { useIncident } from '@/emergency/useIncident';
import { Glass } from '@/design/Glass';
import { haptic } from '@/design/haptics';
import { useDeviceInsets } from '@/design/insets';
import { Text } from '@/design/Text';
import { color, radius, space } from '@/design/tokens';
import { createListener, type ListenState } from '@/voice/listen';
import { rewriteTable, voiceContext } from '@/voice/voice';

/**
 * Emergency mode. Near-black, huge type, nothing to scroll, nothing that is
 * not needed right now. The screen arrives on the same red as the button
 * that opened it and fades to black, so it reads as one continuous action.
 */
export default function Emergency() {
  useKeepAwake();
  const insets = useDeviceInsets();
  const incident = useIncident();
  const { state, step } = incident;
  const [now, setNow] = useState(Date.now());
  const [sheet, setSheet] = useState<'dispatch' | 'more' | 'scan' | null>(null);
  const [listen, setListen] = useState<ListenState>('off');
  const [voicePaused, setVoicePaused] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const level = useSharedValue(0);
  const remaining = useSharedValue(1);
  const arrive = useSharedValue(0);

  // Arrive on red, settle to black.
  useEffect(() => {
    arrive.value = withTiming(1, { duration: 520, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  }, [arrive]);
  const bg = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(arrive.value, [0, 1], [color.signal, color.void]) }));

  // A clock for countdowns and call timers.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // The 911 countdown ring empties over five seconds; at zero, call.
  useEffect(() => {
    if (state.call.status === 'countdown') {
      remaining.value = 1;
      remaining.value = withTiming(0, { duration: CALL_COUNTDOWN_S * 1000, easing: Easing.linear });
    } else {
      remaining.value = withTiming(state.call.status === 'calling' ? 1 : 0, { duration: 300 });
    }
  }, [state.call.status, remaining]);

  const lastSecond = useRef(CALL_COUNTDOWN_S + 1);
  useEffect(() => {
    if (state.call.status !== 'countdown') return;
    const left = Math.ceil((state.call.endsAt - now) / 1000);
    if (left !== lastSecond.current && left > 0) {
      lastSecond.current = left;
      haptic('countdown');
    }
    if (now >= state.call.endsAt) {
      // Never cover the current step with a sheet: the call pill shows the
      // call, and one tap on it opens what to tell the dispatcher.
      incident.call();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, state.call.status]);

  // Listen from the first moment. Voice is a shortcut; every step also works by touch.
  const hear = useRef(incident.hear);
  hear.current = incident.hear;
  const partial = useRef(incident.hearPartial);
  partial.current = incident.hearPartial;
  useEffect(() => {
    unlockAudio();
    const l = createListener({
      onFinal: (t) => hear.current(t),
      onPartial: (t) => partial.current(t),
      onLevel: (v) => (level.value = withTiming(v, { duration: 120 })),
      onState: (s) => {
        setListen(s);
        if (s === 'interrupted') {
          setVoicePaused(true);
          audio()?.speak([systemLines.lines.micLost]);
        }
      },
    });
    const t = setTimeout(() => {
      audio()?.speak([systemLines.lines.intake]);
      l.start();
    }, 450);
    return () => {
      clearTimeout(t);
      l.stop();
      audio()?.stopSpeech();
    };
  }, [level]);

  // Coming back from the phone's dialer while a real call is up: the
  // microphone belongs to the call now, so say so and switch to touch.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && state.call.status === 'calling' && state.call.how !== 'simulated') {
        setVoicePaused(true);
        audio()?.speak([systemLines.lines.micLost]);
      }
    });
    return () => sub.remove();
  }, [state.call.status, state.call.how]);

  // Test hook for the web preview (demo builds only): lets an automated
  // browser "say" a sentence, the same way the speech recogniser would.
  useEffect(() => {
    if (Platform.OS !== 'web' || !DEMO_MODE) return;
    const w = window as unknown as { __mayday?: object };
    w.__mayday = {
      hear: (t: string) => hear.current(t),
      audio: () => {
        const a = audio();
        return a ? { state: (a.ctx as { state?: string }).state, time: a.now(), speaking: a.isSpeaking(), said: a.lastSpoken } : null;
      },
      voice: () => ({ ...voiceContext(), rewrites: rewriteTable() }),
    };
    return () => {
      delete w.__mayday;
    };
  }, []);

  const phase = showLog ? 'handoff' : state.phase;
  const stepKey = `${state.engine?.protocolId}#${state.engine?.stepId}#${state.engine?.trail.length}`;

  return (
    <Animated.View style={[styles.screen, { paddingTop: insets.top }, bg]}>
      <DemoBanner />

      {phase === 'intake' ? (
        <TopBar
          left={
            <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close emergency mode" hitSlop={8}>
              <Glass radius={radius.pill} style={styles.round}>
                <View style={styles.roundInner}>
                  <X size={22} color={color.ink} />
                </View>
              </Glass>
            </Pressable>
          }
          onLog={() => setShowLog(true)}
        />
      ) : (
        <TopBar left={<CallPill call={state.call} now={now} onPress={() => setSheet('dispatch')} />} onLog={() => setShowLog(true)} />
      )}

      <View style={{ flex: 1 }}>
        {phase === 'intake' && (
          <Intake incident={incident} now={now} remaining={remaining} level={level} listening={listen === 'listening'} onMore={() => setSheet('more')} />
        )}
        {phase === 'protocol' && step && step.kind === 'cpr' && <CprView key={stepKey} incident={incident} step={step} />}
        {phase === 'protocol' && step && step.kind !== 'cpr' && <StepView key={stepKey} incident={incident} step={step} />}
        {phase === 'handoff' && (
          <Handoff
            incident={incident}
            onBack={() => {
              setShowLog(false);
              if (state.phase === 'handoff') incident.resume();
            }}
          />
        )}
      </View>

      {phase === 'protocol' && (
        <View style={[styles.voice, { paddingBottom: insets.bottom }]}>
          {listen === 'listening' && !voicePaused ? (
            <Microphone size={16} color={color.inkMuted} weight="fill" />
          ) : (
            <MicrophoneSlash size={16} color={color.inkFaint} />
          )}
          <Text variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
            {voicePaused ? 'On call' : state.heard ? state.heard.text : ''}
          </Text>
        </View>
      )}
      {phase !== 'protocol' && <View style={{ height: insets.bottom }} />}

      <DispatcherSheet incident={incident} open={sheet === 'dispatch'} onClose={() => setSheet(null)} now={now} />
      <MoreSheet incident={incident} open={sheet === 'more'} onClose={() => setSheet(null)} onScan={() => setSheet('scan')} />
      <ScanSheet incident={incident} open={sheet === 'scan'} onClose={() => setSheet(null)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  round: { width: 44, height: 44 },
  roundInner: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  voice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[5],
    paddingTop: space[2],
    minHeight: 40,
  },
});
