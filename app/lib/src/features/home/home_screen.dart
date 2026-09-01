import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../ai/mayday_ai.dart';
import '../../data/protocol_repository.dart';
import '../../design/tokens.dart';
import '../../domain/protocol.dart';
import '../assistant/assistant_screen.dart';
import '../incident/incident_screen.dart';

/// Cold start to actionable. One target, most of the screen, no onboarding,
/// no account, no splash. Everything else on this screen is small and quiet.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.repository, this.ai});

  final ProtocolRepository repository;

  /// Null when the assistant failed to load. The emergency button still works;
  /// only the "ask me anything" row disappears.
  final MaydayAi? ai;

  void _start(BuildContext context, Protocol protocol) {
    HapticFeedback.heavyImpact();
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) =>
          IncidentScreen(repository: repository, protocol: protocol, ai: ai),
    ));
  }

  void _ask(BuildContext context) {
    final ai = this.ai;
    if (ai == null) return;
    HapticFeedback.selectionClick();
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => AssistantScreen(repository: repository, ai: ai),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final tierA = repository.tierA.toList()
      ..sort((a, b) => a.title.compareTo(b.title));

    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  MSpace.gutter, MSpace.gutter, MSpace.gutter, 0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('MAYDAY', style: MType.label.copyWith(
                    color: MColor.text,
                    fontSize: 15,
                    letterSpacing: 3,
                  )),
                  Text('OFFLINE READY · ${repository.corpusRevision}',
                      style: MType.label),
                ],
              ),
            ),
            const SizedBox(height: MSpace.gutter),

            // The primary affordance. Deliberately enormous — precise tapping
            // fails with shaking hands.
            Expanded(
              flex: 5,
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: MSpace.gutter),
                child: _EmergencyButton(
                  onPressed: () => _showPicker(context, tierA),
                ),
              ),
            ),

            const SizedBox(height: MSpace.gutter),
            if (ai != null)
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: MSpace.gutter),
                child: _AskRow(onTap: () => _ask(context)),
              ),
            const SizedBox(height: MSpace.gutter),
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: MSpace.gutter),
              child: Text('OR GO STRAIGHT TO', style: MType.label),
            ),
            const SizedBox(height: MSpace.tight),
            Expanded(
              flex: 3,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(
                    horizontal: MSpace.gutter, vertical: MSpace.tight),
                itemCount: tierA.length,
                separatorBuilder: (_, _) => const SizedBox(height: 2),
                itemBuilder: (context, i) => _ProtocolRow(
                  protocol: tierA[i],
                  onTap: () => _start(context, tierA[i]),
                ),
              ),
            ),

            const _Disclaimer(),
          ],
        ),
      ),
    );
  }

  void _showPicker(BuildContext context, List<Protocol> protocols) {
    HapticFeedback.selectionClick();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: MColor.bg,
      barrierColor: Colors.black87,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: MSpace.gutter),
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: MSpace.gutter),
              child: Text('WHAT IS HAPPENING?', style: MType.label),
            ),
            const SizedBox(height: MSpace.gap),
            for (final p in protocols)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    MSpace.gutter, 0, MSpace.gutter, 2),
                child: _ProtocolRow(
                  protocol: p,
                  large: true,
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    _start(context, p);
                  },
                ),
              ),
            const SizedBox(height: MSpace.gutter),
          ],
        ),
      ),
    );
  }
}

class _EmergencyButton extends StatefulWidget {
  const _EmergencyButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  State<_EmergencyButton> createState() => _EmergencyButtonState();
}

class _EmergencyButtonState extends State<_EmergencyButton> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Start an emergency. Opens the list of emergencies.',
      child: GestureDetector(
        onTapDown: (_) => setState(() => _down = true),
        onTapCancel: () => setState(() => _down = false),
        onTapUp: (_) => setState(() => _down = false),
        onTap: widget.onPressed,
        child: Container(
          decoration: BoxDecoration(
            color: _down ? MColor.signalPressed : MColor.signal,
            borderRadius: MSpace.border,
          ),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('EMERGENCY',
                    textAlign: TextAlign.center,
                    style: MType.instruction.copyWith(fontSize: 56)),
                const SizedBox(height: MSpace.tight),
                Text('TAP TO START',
                    style: MType.label.copyWith(color: Colors.white70)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ProtocolRow extends StatelessWidget {
  const _ProtocolRow({
    required this.protocol,
    required this.onTap,
    this.large = false,
  });

  final Protocol protocol;
  final VoidCallback onTap;
  final bool large;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '${protocol.title}, ${protocol.subtitle}',
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          constraints: BoxConstraints(minHeight: large ? 84 : MSpace.minTarget),
          padding: const EdgeInsets.symmetric(
              horizontal: MSpace.gap, vertical: MSpace.gap),
          decoration: const BoxDecoration(
            color: MColor.surface,
            borderRadius: MSpace.border,
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      protocol.title.toUpperCase(),
                      style: large
                          ? MType.instructionSmall.copyWith(fontSize: 30)
                          : MType.button,
                    ),
                    Text(protocol.subtitle.toUpperCase(), style: MType.label),
                  ],
                ),
              ),
              Text('${protocol.guidelineYear}', style: MType.label),
            ],
          ),
        ),
      ),
    );
  }
}

class _Disclaimer extends StatelessWidget {
  const _Disclaimer();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          MSpace.gutter, MSpace.gap, MSpace.gutter, MSpace.gap),
      child: Text(
        'Mayday coaches you through published first-aid protocols. It is not a '
        'substitute for professional medical care or formal training, and it '
        'does not diagnose. In an emergency, call 911 first.',
        style: MType.citation,
      ),
    );
  }
}

/// The second way in. Small, quiet, and beside the emergency button rather than
/// competing with it — you should never have to describe an emergency to
/// something before it will help you, but being able to is what makes the app
/// useful to someone who does not yet know what they are looking at.
class _AskRow extends StatelessWidget {
  const _AskRow({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Ask Mayday. Describe what you can see and get an answer out loud.',
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          constraints: const BoxConstraints(minHeight: MSpace.minTarget),
          padding: const EdgeInsets.symmetric(
              horizontal: MSpace.gap, vertical: MSpace.gap),
          decoration: BoxDecoration(
            borderRadius: MSpace.border,
            border: Border.all(color: MColor.rule),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('ASK MAYDAY', style: MType.button),
                    Text('SAY WHAT YOU CAN SEE · WORKS OFFLINE',
                        style: MType.label),
                  ],
                ),
              ),
              const Icon(Icons.mic_none, color: MColor.textDim, size: 26),
            ],
          ),
        ),
      ),
    );
  }
}
