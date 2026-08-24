import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../design/tokens.dart';
import '../../engine/incident_engine.dart';

/// The EMS handoff card.
///
/// When paramedics arrive, the bystander is usually exhausted, frightened, and
/// a poor historian — and the single most valuable thing they hold is *timing*:
/// when the collapse happened, when compressions started, whether there was a
/// shock. Mayday timestamps all of it silently while the incident runs, so the
/// handoff is a glance instead of an interview.
///
/// Deliberately a different visual register from the incident screens: this one
/// is read calmly by a professional, not by a panicking bystander, so it is
/// dense and light-on-dark rather than enormous.
class HandoffScreen extends StatelessWidget {
  const HandoffScreen({super.key, required this.engine});

  final IncidentEngine engine;

  @override
  Widget build(BuildContext context) {
    final events = engine.timeline;

    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(
                  MSpace.gutter, MSpace.gap, MSpace.gutter, MSpace.gap),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: MColor.rule)),
              ),
              child: Row(
                children: [
                  Expanded(child: Text('EMS HANDOFF', style: MType.label)),
                  GestureDetector(
                    onTap: () => Navigator.of(context).pop(),
                    behavior: HitTestBehavior.opaque,
                    child: Text('CLOSE', style: MType.label),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(MSpace.gutter),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${engine.protocol.title.toUpperCase()} · '
                    '${engine.protocol.subtitle.toUpperCase()}',
                    style: MType.instructionSmall.copyWith(fontSize: 30),
                  ),
                  const SizedBox(height: MSpace.tight),
                  Text(
                    'Bystander-run protocol. Times are from first contact, '
                    'not wall clock.',
                    style: MType.detail,
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: MSpace.gutter),
                itemCount: events.length,
                itemBuilder: (context, i) {
                  final e = events[i];
                  final emphasised = e.kind == TimelineEventKind.callPlaced ||
                      e.kind == TimelineEventKind.callDelegated ||
                      e.kind == TimelineEventKind.compressionsStarted ||
                      e.kind == TimelineEventKind.aedUsed;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          width: 58,
                          child: Text(
                            e.stamp,
                            style: MType.citation.copyWith(
                              color: emphasised ? MColor.signal : MColor.textDim,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                e.label,
                                style: MType.detail.copyWith(
                                  color: emphasised
                                      ? MColor.text
                                      : MColor.textDim,
                                  fontSize: 16,
                                ),
                              ),
                              if (e.detail != null)
                                Text(e.detail!,
                                    style: MType.citation),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(MSpace.gutter),
              child: GestureDetector(
                onTap: () {
                  Clipboard.setData(ClipboardData(text: _asText()));
                  HapticFeedback.mediumImpact();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      backgroundColor: MColor.surfaceHigh,
                      content: Text('Handoff copied', style: MType.detail),
                    ),
                  );
                },
                child: Container(
                  constraints: const BoxConstraints(minHeight: 64),
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                      color: MColor.surface, borderRadius: MSpace.border),
                  child: Text('COPY FOR HANDOFF', style: MType.button),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _asText() {
    final b = StringBuffer()
      ..writeln('MAYDAY INCIDENT — ${engine.protocol.title} '
          '(${engine.protocol.subtitle})')
      ..writeln('Protocol revision ${engine.protocol.revision} '
          '(${engine.protocol.guidelineYear} guidelines)')
      ..writeln('Times from first contact.')
      ..writeln();
    for (final e in engine.timeline) {
      b.writeln('${e.stamp}  ${e.label}');
    }
    return b.toString();
  }
}
