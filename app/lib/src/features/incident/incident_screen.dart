import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../ai/commands.dart';
import '../../ai/mayday_ai.dart';
import '../../ai/speech.dart';
import '../../ai/voice_session.dart';
import '../../data/protocol_repository.dart';
import '../../design/tokens.dart';
import '../../domain/protocol.dart';
import '../../engine/incident_engine.dart';
import '../../services/emergency_call.dart';
import 'compression_coach.dart';
import 'handoff_screen.dart';
import 'incident_voice.dart';

/// Runs one incident. One instruction on screen at a time, one action, no nav
/// bar, no tabs, no back button — nothing to get lost in.
class IncidentScreen extends StatefulWidget {
  const IncidentScreen({
    super.key,
    required this.repository,
    required this.protocol,
    this.startStepId,
    this.ai,
    this.session,
  });

  final ProtocolRepository repository;
  final Protocol protocol;

  /// The assistant. Null means run the incident with no voice at all — which
  /// must remain a complete, usable experience, because during a 911 call the
  /// platform takes the microphone away whether we like it or not.
  final MaydayAi? ai;

  /// Injected in tests and in the screenshot build.
  final VoiceSession? session;

  /// Optional deep-link entry point, used only by the screenshot/demo define.
  final String? startStepId;

  @override
  State<IncidentScreen> createState() => _IncidentScreenState();
}

class _IncidentScreenState extends State<IncidentScreen> {
  late final IncidentEngine _engine;
  final EmergencyCall _dialer = EmergencyCall();
  String? _toast;

  VoiceSession? _voice;
  IncidentVoiceController? _coach;
  bool _ownsVoice = false;

  @override
  void initState() {
    super.initState();
    _engine = IncidentEngine(
      repository: widget.repository,
      protocol: widget.protocol,
      startStepId: widget.startStepId,
    )..addListener(_onEngineChanged);
    _startVoice();
  }

  /// Voice is bolted on beside the incident, never underneath it. Everything
  /// below fails soft: no assistant, no microphone, no text-to-speech engine —
  /// the protocol still runs, unchanged, on touch.
  void _startVoice() {
    final ai = widget.ai;
    if (ai == null && widget.session == null) return;

    final session = widget.session ?? ai!.newSession();
    _ownsVoice = widget.session == null;
    _voice = session..addListener(_onEngineChanged);

    final grammar =
        ai?.grammar ?? CommandGrammar(session.advisor.lexicon.normalizer);
    _coach = IncidentVoiceController(
      session: session,
      engine: _engine,
      grammar: grammar,
      actions: IncidentVoiceActions(
        next: _advance,
        alone: _engine.takeAloneBranch,
        call: () => unawaited(_placeCall()),
        timeline: _openHandoff,
      ),
    );
    unawaited(_coach!.start());
  }

  void _onEngineChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _coach?.dispose();
    _voice?.removeListener(_onEngineChanged);
    if (_ownsVoice) _voice?.dispose();
    _engine
      ..removeListener(_onEngineChanged)
      ..dispose();
    super.dispose();
  }

  Future<void> _toggleMic() async {
    final session = _voice;
    if (session == null) return;
    HapticFeedback.selectionClick();
    if (session.state == VoiceState.listening) {
      await session.stopListening();
    } else {
      await session.startListening();
    }
  }

  void _advance() {
    HapticFeedback.selectionClick();
    _engine.advance();
  }

  void _choose(ProtocolChoice c) {
    HapticFeedback.mediumImpact();
    _engine.choose(c);
  }

  Future<void> _placeCall() async {
    HapticFeedback.heavyImpact();
    final outcome = await _dialer.dial();
    _engine.noteCallPlaced();
    if (!mounted) return;
    setState(() => _toast = outcome.message);
    _engine.advance();
  }

  void _openHandoff() {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => HandoffScreen(engine: _engine),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final step = _engine.step;

    return PopScope(
      // Leaving mid-incident should be deliberate, not a stray back-swipe.
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmExit();
      },
      child: Scaffold(
        body: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _TopStrip(engine: _engine, onExit: _confirmExit, onHandoff: _openHandoff),
              if (_voice case final voice?)
                _VoiceStrip(session: voice, onMic: _toggleMic),
              if (_toast != null) _Toast(text: _toast!),
              Expanded(child: _buildBody(step)),
              _CitationStrip(engine: _engine),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody(ProtocolStep step) {
    switch (step.kind) {
      case StepKind.compressions:
        return CompressionCoach(
          key: ValueKey(step.id),
          step: step,
          onAdvance: _advance,
          onStarted: _engine.noteCompressionsStarted,
          onSwapPrompt: _engine.noteRescuerSwapPrompted,
        );

      case StepKind.confirm:
        return _StepScaffold(
          step: step,
          actions: [
            for (final c in step.choices)
              _ActionButton(
                label: c.label,
                emphasis: c == step.choices.first,
                onTap: () => _choose(c),
              ),
          ],
        );

      case StepKind.cycle:
        return _CycleView(
          step: step,
          progress: _engine.cycleProgress,
          onTap: _advance,
          onAlternate: step.altNext == null ? null : _engine.takeAlternate,
        );

      case StepKind.delegate:
        return _StepScaffold(
          step: step,
          actions: [
            _ActionButton(
              label: 'DONE — SOMEONE IS CALLING',
              emphasis: true,
              onTap: () {
                _engine.noteCallDelegated();
                _advance();
              },
            ),
            if (step.aloneNext != null)
              _ActionButton(
                label: step.aloneLabel ?? "I'M ALONE",
                onTap: _engine.takeAloneBranch,
              ),
          ],
        );

      case StepKind.call911:
        return _StepScaffold(
          step: step,
          actions: [
            _ActionButton(
              label: 'CALL 911',
              emphasis: true,
              onTap: _placeCall,
            ),
            _ActionButton(label: 'ALREADY CALLED', onTap: _advance),
          ],
        );

      case StepKind.gotoProtocol:
        return _StepScaffold(
          step: step,
          actions: [
            _ActionButton(
              label: 'CONTINUE',
              emphasis: true,
              onTap: () {
                HapticFeedback.heavyImpact();
                _engine.jumpToTargetProtocol();
              },
            ),
          ],
        );

      case StepKind.terminal:
        return _StepScaffold(
          step: step,
          actions: [
            _ActionButton(
              label: 'SHOW EMS HANDOFF',
              emphasis: true,
              onTap: _openHandoff,
            ),
          ],
        );

      case StepKind.action:
        return _StepScaffold(
          step: step,
          fullScreenTap: _advance,
          actions: [
            _ActionButton(label: 'NEXT', emphasis: true, onTap: _advance),
          ],
        );
    }
  }

  Future<void> _confirmExit() async {
    final leave = await showDialog<bool>(
      context: context,
      barrierColor: Colors.black87,
      builder: (ctx) => Dialog(
        backgroundColor: MColor.surface,
        shape: const RoundedRectangleBorder(borderRadius: MSpace.border),
        child: Padding(
          padding: const EdgeInsets.all(MSpace.gutter),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('END THIS INCIDENT?',
                  style: MType.instructionSmall.copyWith(fontSize: 26)),
              const SizedBox(height: MSpace.tight),
              Text('The timeline is kept so you can hand it to EMS.',
                  style: MType.detail),
              const SizedBox(height: MSpace.gutter),
              _ActionButton(
                  label: 'KEEP GOING',
                  emphasis: true,
                  onTap: () => Navigator.of(ctx).pop(false)),
              _ActionButton(
                  label: 'END', onTap: () => Navigator.of(ctx).pop(true)),
            ],
          ),
        ),
      ),
    );
    if (leave == true && mounted) Navigator.of(context).pop();
  }
}

class _TopStrip extends StatelessWidget {
  const _TopStrip({
    required this.engine,
    required this.onExit,
    required this.onHandoff,
  });

  final IncidentEngine engine;
  final VoidCallback onExit;
  final VoidCallback onHandoff;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(
          MSpace.gutter, MSpace.gap, MSpace.gutter, MSpace.gap),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: MColor.rule)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              '${engine.protocol.title.toUpperCase()} · '
              '${engine.protocol.subtitle.toUpperCase()}',
              style: MType.label.copyWith(color: MColor.textDim),
            ),
          ),
          GestureDetector(
            onTap: onHandoff,
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MSpace.gap),
              child: Text('TIMELINE', style: MType.label),
            ),
          ),
          GestureDetector(
            onTap: onExit,
            behavior: HitTestBehavior.opaque,
            child: Text('END', style: MType.label),
          ),
        ],
      ),
    );
  }
}

class _Toast extends StatelessWidget {
  const _Toast({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: MColor.surfaceHigh,
      padding: const EdgeInsets.symmetric(
          horizontal: MSpace.gutter, vertical: MSpace.tight),
      child: Text(text, style: MType.citation.copyWith(color: MColor.textDim)),
    );
  }
}

/// The standard step layout: instruction enormous, detail small, actions at the
/// bottom where a thumb already is.
class _StepScaffold extends StatelessWidget {
  const _StepScaffold({
    required this.step,
    required this.actions,
    this.fullScreenTap,
  });

  final ProtocolStep step;
  final List<Widget> actions;
  final VoidCallback? fullScreenTap;

  @override
  Widget build(BuildContext context) {
    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(MSpace.gutter),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Semantics(
                  liveRegion: true,
                  child: Text(
                    step.instruction,
                    style: step.instruction.length > 18
                        ? MType.instructionSmall
                        : MType.instruction,
                  ),
                ),
                if (step.detail.isNotEmpty) ...[
                  const SizedBox(height: MSpace.gap),
                  Text(step.detail, style: MType.detail),
                ],
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(
              MSpace.gutter, 0, MSpace.gutter, MSpace.gap),
          child: Column(children: actions),
        ),
      ],
    );

    if (fullScreenTap == null) return body;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: fullScreenTap,
      child: body,
    );
  }
}

class _CycleView extends StatelessWidget {
  const _CycleView({
    required this.step,
    required this.progress,
    required this.onTap,
    this.onAlternate,
  });

  final ProtocolStep step;
  final int progress;
  final VoidCallback onTap;
  final VoidCallback? onAlternate;

  @override
  Widget build(BuildContext context) {
    final total = step.count ?? 0;
    final remaining = (total - progress).clamp(0, total);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(MSpace.gutter),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(step.instruction, style: MType.instruction),
                  const SizedBox(height: MSpace.gap),
                  Text(step.detail, style: MType.detail),
                  const SizedBox(height: MSpace.gutter),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Semantics(
                        liveRegion: true,
                        label: '$remaining remaining',
                        child: Text('$remaining', style: MType.numeric),
                      ),
                      const SizedBox(width: MSpace.gap),
                      Text('LEFT', style: MType.label),
                    ],
                  ),
                  const SizedBox(height: MSpace.gap),
                  // Progress as discrete blocks, not a bar — countable at a glance.
                  Row(
                    children: [
                      for (var i = 0; i < total; i++)
                        Expanded(
                          child: Container(
                            height: 8,
                            margin: EdgeInsets.only(right: i == total - 1 ? 0 : 4),
                            color: i < progress ? MColor.signal : MColor.rule,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
                MSpace.gutter, 0, MSpace.gutter, MSpace.gap),
            child: Column(
              children: [
                _ActionButton(
                    label: 'TAP FOR EACH ONE', emphasis: true, onTap: onTap),
                if (onAlternate != null && step.altLabel != null)
                  _ActionButton(label: step.altLabel!, onTap: onAlternate!),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatefulWidget {
  const _ActionButton({
    required this.label,
    required this.onTap,
    this.emphasis = false,
  });

  final String label;
  final VoidCallback onTap;
  final bool emphasis;

  @override
  State<_ActionButton> createState() => _ActionButtonState();
}

class _ActionButtonState extends State<_ActionButton> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final bg = widget.emphasis
        ? (_down ? MColor.signalPressed : MColor.signal)
        : (_down ? MColor.surfaceHigh : MColor.surface);

    return Semantics(
      button: true,
      label: widget.label,
      child: GestureDetector(
        onTapDown: (_) => setState(() => _down = true),
        onTapCancel: () => setState(() => _down = false),
        onTapUp: (_) => setState(() => _down = false),
        onTap: widget.onTap,
        child: Container(
          margin: const EdgeInsets.only(top: 8),
          constraints: const BoxConstraints(minHeight: 72),
          alignment: Alignment.center,
          decoration: BoxDecoration(color: bg, borderRadius: MSpace.border),
          padding: const EdgeInsets.symmetric(
              horizontal: MSpace.gap, vertical: MSpace.gap),
          child: Text(
            widget.label,
            textAlign: TextAlign.center,
            style: MType.button,
          ),
        ),
      ),
    );
  }
}

/// The inline citation. Every instruction in Mayday can be traced to its
/// published source without leaving the screen it is on — which is the honest
/// answer to "how do you know this is correct?".
class _CitationStrip extends StatelessWidget {
  const _CitationStrip({required this.engine});

  final IncidentEngine engine;

  @override
  Widget build(BuildContext context) {
    final source = engine.currentSource;
    final step = engine.step;
    if (source == null) return const SizedBox.shrink();

    return GestureDetector(
      onTap: () => showModalBottomSheet<void>(
        context: context,
        backgroundColor: MColor.surface,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        builder: (_) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(MSpace.gutter),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('SOURCE', style: MType.label),
                const SizedBox(height: MSpace.tight),
                Text(source.title, style: MType.button),
                const SizedBox(height: MSpace.gap),
                Text('"${step.quote}"',
                    style: MType.detail.copyWith(color: MColor.text)),
                const SizedBox(height: MSpace.gap),
                Text(source.citation, style: MType.citation),
                if (!step.verified) ...[
                  const SizedBox(height: MSpace.gap),
                  Container(
                    padding: const EdgeInsets.all(MSpace.gap),
                    color: MColor.surfaceHigh,
                    child: Text(
                      'NOT YET CONFIRMED against the primary source. '
                      '${step.verificationNote ?? ''}',
                      style: MType.citation.copyWith(color: MColor.warn),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(
            horizontal: MSpace.gutter, vertical: MSpace.tight),
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: MColor.rule)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                '${source.publisher} · ${step.verified ? "verified" : "unconfirmed"}',
                style: MType.citation,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Text('SOURCE', style: MType.label),
          ],
        ),
      ),
    );
  }
}

/// A thin band showing whether the phone can hear, what it just heard, and what
/// it answered. Small on purpose: the instruction is the screen, and the voice
/// layer must never compete with it for attention.
class _VoiceStrip extends StatelessWidget {
  const _VoiceStrip({required this.session, required this.onMic});

  final VoiceSession session;
  final VoidCallback onMic;

  @override
  Widget build(BuildContext context) {
    final listening = session.state == VoiceState.listening;
    final heard = session.partial.isNotEmpty
        ? session.partial
        : session.latest?.display;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onMic,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(
            horizontal: MSpace.gutter, vertical: MSpace.tight),
        decoration: const BoxDecoration(
          color: MColor.surface,
          border: Border(bottom: BorderSide(color: MColor.rule)),
        ),
        child: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.only(right: MSpace.tight),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: listening
                    ? MColor.signal
                    : (session.mic.canListen ? MColor.textFaint : MColor.warn),
              ),
            ),
            Expanded(
              child: Text(
                heard ?? (listening ? 'Listening — say "next" or ask me anything' : session.mic.label),
                style: MType.citation.copyWith(
                  color: session.mic.canListen ? MColor.textDim : MColor.warn,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Text(listening ? 'STOP' : 'TALK', style: MType.label),
          ],
        ),
      ),
    );
  }
}
