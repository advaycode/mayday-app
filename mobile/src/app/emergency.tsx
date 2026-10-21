import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';

import { audio, unlockAudio } from '@/audio/engine';
import systemLines from '@/audio/systemLines.json';
import { DEMO_MODE } from '@/config';
import { CprView } from '@/emergency/CprView';
import { Handoff } from '@/emergency/Handoff';
import { Intake } from '@/emergency/Intake';
import { Dock, Progress, TopBar, Understood } from '@/emergency/parts';
import { DispatcherSheet, MoreSheet } from '@/emergency/sheets';
import { ScanSheet } from '@/emergency/ScanSheet';
import { StepView } from '@/emergency/StepView';
import { useIncident } from '@/emergency/useIncident';
import { EMERGENCIES, emergencyFor } from '@/design/emergencies';
import { useDeviceInsets } from '@/design/insets';
import { color } from '@/design/tokens';
import { protocols } from '@/protocols';
import { capabilities, online } from '@/ai/proxy';
import { createListener, type ListenState } from '@/voice/listen';
import { trace } from '@/voice/trace';
import { rewriteTable, voiceContext } from '@/voice/voice';

/**
 * Help, step by step. Three bands, the same on every step:
 *   top     close, what is happening (tap to change), say it again
 *   middle  one picture, one instruction, the answers as big buttons
 *   bottom  Back, Talk to Mayday, 911 (what to tell the dispatcher)
 *
 * Opened from Home either by Talk (listening straight away) or by an
 * emergency tile (the steps start straight away).
 */
export default function Emergency() {
  useKeepAwake();
  const insets = useDeviceInsets();
  const params = useLocalSearchParams<{ talk?: string; tile?: string }>();
  const incident = useIncident();
  const { state, step } = incident;
  const [sheet, setSheet] = useState<'dispatch' | 'more' | 'scan' | null>(null);
  const [listen, setListen] = useState<ListenState>('off');
  const [showLog, setShowLog] = useState(false);
  const level = useSharedValue(0);

  // --- Talk to Mayday: tap to listen, tap again to stop ---------------------------
  const hear = useRef(incident.hear);
  hear.current = incident.hear;
  const partial = useRef(incident.hearPartial);
  partial.current = incident.hearPartial;
  const listener = useRef<ReturnType<typeof createListener> | null>(null);
  useEffect(() => {
    unlockAudio();
    const l = createListener({
      onFinal: (t) => hear.current(t),
      onPartial: (t) => partial.current(t),
      onLevel: (v) => (level.value = withTiming(v, { duration: 120 })),
      onState: (s) => {
        setListen(s);
        if (s === 'interrupted') audio()?.speak([systemLines.lines.micLost]);
      },
    });
    listener.current = l;
    capabilities().then((c) =>
      trace('boot', { ...c, proxy: online(), listener: l.available ? 'speech recognition' : 'none (buttons)', voice: audio() ? 'audio engine' : 'system voice' }),
    );

    const tile = EMERGENCIES.find((e) => e.id === params.tile);
    const t = setTimeout(() => {
      if (tile) incident.startProtocol(tile.protocol, tile.slots);
      else {
        audio()?.speak([systemLines.lines.intake]);
        if (params.talk) l.start();
      }
    }, 300);
    return () => {
      clearTimeout(t);
      l.stop();
      audio()?.stopSpeech();
    };
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listening = listen === 'listening' || listen === 'starting';
  const talk = () => {
    const l = listener.current;
    if (!l) return;
    if (listening) {
      l.stop();
      return;
    }
    // Barge in: Mayday stops talking so it can hear you.
    audio()?.stopSpeech();
    if (!l.available) audio()?.speak([systemLines.lines.micLost]);
    l.start();
  };

  // Test hook for the web preview: lets an automated browser "say" a sentence,
  // the same way the speech recogniser would.
  useEffect(() => {
    if (Platform.OS !== 'web' || !DEMO_MODE) return;
    const w = window as unknown as { __mayday?: object };
    w.__mayday = {
      hear: (t: string) => hear.current(t),
      audio: () => {
        const a = audio();
        return a ? { state: a.state, time: a.now(), speaking: a.isSpeaking(), said: a.lastSpoken } : null;
      },
      voice: () => ({ ...voiceContext(), rewrites: rewriteTable() }),
    };
    return () => {
      delete w.__mayday;
    };
  }, []);

  const phase = showLog ? 'handoff' : state.phase;
  const stepKey = `${state.engine?.protocolId}#${state.engine?.stepId}#${state.engine?.trail.length}`;
  const protocolId = state.engine?.protocolId ?? null;
  const tone = emergencyFor(protocolId).tint;
  const steps = protocolId ? protocols[protocolId].steps : [];
  const index = step ? steps.findIndex((s) => s.id === step.id) : -1;
  const fraction = steps.length > 1 && index >= 0 ? (index + 1) / steps.length : 0;

  if (phase === 'handoff') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Handoff
          incident={incident}
          onBack={() => {
            setShowLog(false);
            if (state.phase === 'handoff') incident.resume();
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <TopBar
        protocolId={protocolId}
        onClose={() => router.back()}
        onSwitch={() => setSheet('more')}
        onRepeat={step ? () => incident.dispatch({ type: 'intent', intent: 'repeat', at: Date.now() }) : null}
      />
      {protocolId && <Progress fraction={fraction} tone={tone.hue} />}

      <View style={{ flex: 1 }}>
        {phase === 'intake' && <Intake incident={incident} level={level} listening={listening} />}
        {phase === 'protocol' && step && step.kind === 'cpr' && <CprView key={stepKey} incident={incident} step={step} />}
        {phase === 'protocol' && step && step.kind !== 'cpr' && <StepView key={stepKey} incident={incident} step={step} />}
      </View>

      <Understood understood={state.understood} />
      <Dock
        canBack={incident.canBack}
        onBack={incident.back}
        listening={listening}
        level={level}
        onTalk={talk}
        on911={() => setSheet('dispatch')}
        bottomInset={insets.bottom}
      />

      <DispatcherSheet incident={incident} open={sheet === 'dispatch'} onClose={() => setSheet(null)} />
      <MoreSheet incident={incident} open={sheet === 'more'} onClose={() => setSheet(null)} onScan={() => setSheet('scan')} />
      <ScanSheet incident={incident} open={sheet === 'scan'} onClose={() => setSheet(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.void },
});
