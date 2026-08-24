import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// THE SAFETY INVARIANT, ENFORCED AS A TEST.
///
/// Mayday's central architectural claim is that time-critical protocols run as
/// deterministic on-device state machines with no language model anywhere in
/// the loop: zero added latency, zero hallucination surface. A claim like that
/// is worth nothing if it is only a convention — someone adds one convenient
/// import six weeks from now and the guarantee is gone with no visible change.
///
/// So it is a test. These files form the Tier A execution path, and the test
/// fails if any of them gains a dependency on an inference runtime, a network
/// client, or anything else that could make an instruction non-deterministic.
const _tierAPath = <String>[
  'lib/src/domain/protocol.dart',
  'lib/src/data/protocol_repository.dart',
  'lib/src/engine/incident_engine.dart',
  'lib/src/cpr/metronome.dart',
  'lib/src/cpr/compression_rate_detector.dart',
];

/// Package prefixes that must never appear on the Tier A path.
const _forbiddenImports = <String>[
  'flutter_gemma',
  'google_generative_ai',
  'tflite',
  'litert',
  'mediapipe',
  'onnxruntime',
  'llama',
  'openai',
  'anthropic',
  'langchain',
  'package:http',
  'package:dio',
  'dart:io', // no filesystem or sockets on the execution path either
];

void main() {
  group('Tier A determinism', () {
    test('no inference runtime or network client on the Tier A path', () {
      final violations = <String>[];

      for (final path in _tierAPath) {
        final file = File(path);
        expect(file.existsSync(), isTrue, reason: 'missing $path');

        for (final line in file.readAsLinesSync()) {
          final trimmed = line.trim();
          if (!trimmed.startsWith('import ') &&
              !trimmed.startsWith('export ')) {
            continue;
          }
          for (final forbidden in _forbiddenImports) {
            if (trimmed.contains(forbidden)) {
              violations.add('$path: $trimmed');
            }
          }
        }
      }

      expect(violations, isEmpty,
          reason: 'Tier A protocols must execute deterministically with no '
              'model and no network in the loop. Found:\n'
              '${violations.join('\n')}');
    });

    test('the Tier A path does not reference a model at all', () {
      // Belt and braces: catch a runtime reached through a re-export or a
      // dynamically resolved service rather than a direct import.
      final needles = ['Gemma', 'LlmInference', 'generateContent', 'inferenceEngine'];
      final violations = <String>[];

      for (final path in _tierAPath) {
        final text = File(path).readAsStringSync();
        for (final needle in needles) {
          // Ignore prose in doc comments; only flag real code references.
          for (final line in text.split('\n')) {
            final t = line.trim();
            if (t.startsWith('//') || t.startsWith('///') || t.startsWith('*')) {
              continue;
            }
            if (t.contains(needle)) violations.add('$path: $t');
          }
        }
      }

      expect(violations, isEmpty, reason: violations.join('\n'));
    });
  });
}
