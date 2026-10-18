import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera, Drop, Fire } from 'phosphor-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { audio } from '@/audio/engine';
import systemLines from '@/audio/systemLines.json';
import { scanPhoto, type ScanResult } from '@/ai/proxy';
import { Button } from '@/design/Button';
import { Sheet } from '@/design/Sheet';
import { Text } from '@/design/Text';
import { color, radius, space } from '@/design/tokens';

import type { Incident } from './useIncident';

/**
 * Photo check: point the camera at a burn or wound. The model describes what
 * it sees in hedged words ("This looks consistent with...") and suggests
 * which of our protocols fits. It never diagnoses and never gives the
 * instructions itself; the person taps to start the cited protocol.
 */
export function ScanSheet({ incident, open, onClose }: { incident: Incident; open: boolean; onClose: () => void }) {
  const [permission, request] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null | 'failed'>(null);

  const capture = async () => {
    if (!camera.current) return;
    setBusy(true);
    audio()?.speak([systemLines.lines.scanLooking]);
    try {
      const photo = await camera.current.takePictureAsync({ base64: true, quality: 0.5, skipProcessing: true });
      const r = photo?.base64 ? await scanPhoto(photo.base64.replace(/^data:image\/\w+;base64,/, '')) : null;
      setResult(r ?? 'failed');
      if (r?.suggested_protocol) {
        incident.log(`Photo check: ${r.observation}`);
      } else {
        audio()?.speak([systemLines.lines.scanUnsure]);
      }
    } catch {
      setResult('failed');
    } finally {
      setBusy(false);
    }
  };

  const start = (id: 'burns' | 'bleeding', severity: ScanResult['severity_hint']) => {
    onClose();
    setResult(null);
    incident.startProtocol(id, id === 'burns' && severity ? { burn_severity: severity } : {});
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <Text variant="caption" tone="muted">
        Photo check
      </Text>
      {!permission?.granted ? (
        <Button label="Allow camera" icon={Camera} onPress={request} />
      ) : result === null ? (
        <>
          <View style={styles.preview}>
            <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
            {busy && (
              <View style={styles.busy}>
                <ActivityIndicator color={color.ink} />
              </View>
            )}
          </View>
          <Button label={busy ? 'Looking' : 'Take photo'} kind="primary" icon={Camera} onPress={capture} />
        </>
      ) : result === 'failed' || !result.suggested_protocol ? (
        <>
          <Text variant="title">{result === 'failed' ? 'Photo check needs a connection.' : result.observation}</Text>
          <Text variant="body" tone="muted">
            Tap what you see instead.
          </Text>
          <View style={styles.row}>
            <Button label="Burn" icon={Fire} onPress={() => start('burns', null)} style={{ flex: 1 }} />
            <Button label="Bleeding" icon={Drop} onPress={() => start('bleeding', null)} style={{ flex: 1 }} />
          </View>
        </>
      ) : (
        <>
          <Text variant="title">{result.observation}</Text>
          <Text variant="caption" tone="faint">
            Not a diagnosis. Start the steps that match what you see.
          </Text>
          <Button
            size="emergency"
            kind="primary"
            icon={result.suggested_protocol === 'burns' ? Fire : Drop}
            label={result.suggested_protocol === 'burns' ? 'Burn steps' : 'Bleeding steps'}
            onPress={() => start(result.suggested_protocol!, result.severity_hint)}
          />
          <Button label="Retake" onPress={() => setResult(null)} />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  preview: { height: 280, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.sunken },
  busy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,5,5,0.4)' },
  row: { flexDirection: 'row', gap: space[3] },
});
