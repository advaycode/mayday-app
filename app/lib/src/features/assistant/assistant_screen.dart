import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../ai/advisor.dart';
import '../../ai/knowledge.dart';
import '../../ai/mayday_ai.dart';
import '../../ai/speech.dart';
import '../../ai/voice_session.dart';
import '../../data/protocol_repository.dart';
import '../../design/tokens.dart';
import '../../design/widgets.dart';
import '../incident/incident_screen.dart';

/// "Ask Mayday" — the talk-to-it screen.
///
/// One question at a time, one answer, the source underneath it. Two ways in
/// and they are the same underneath: speak, or type. Typing is not a
/// second-class fallback — the microphone is unavailable during a call by
/// platform design (research/DECISIONS.md D1), so a path that always works has
/// to exist and has to be good.
class AssistantScreen extends StatefulWidget {
  const AssistantScreen({
    super.key,
    required this.repository,
    required this.ai,
    this.session,
    this.autoListen = true,
  });

  final ProtocolRepository repository;
  final MaydayAi ai;

  /// Injected in tests and in the screenshot build.
  final VoiceSession? session;
  final bool autoListen;

  @override
  State<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends State<AssistantScreen> {
  late final VoiceSession _session;
  late final bool _ownsSession;
  final TextEditingController _input = TextEditingController();

  @override
  void initState() {
    super.initState();
    _ownsSession = widget.session == null;
    _session = widget.session ?? widget.ai.newSession();
    _session.addListener(_onSessionChanged);
    _session.initialize();
  }

  void _onSessionChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _session.removeListener(_onSessionChanged);
    if (_ownsSession) _session.dispose();
    _input.dispose();
    super.dispose();
  }

  Future<void> _toggleListening() async {
    HapticFeedback.selectionClick();
    if (_session.state == VoiceState.listening) {
      await _session.stopListening();
    } else {
      await _session.startListening();
    }
  }

  Future<void> _submit(String text) async {
    if (text.trim().isEmpty) return;
    _input.clear();
    FocusScope.of(context).unfocus();
    await _session.ask(text);
  }

  void _start(String protocolId) {
    final protocol = widget.repository.byId(protocolId);
    if (protocol == null) return;
    HapticFeedback.heavyImpact();
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => IncidentScreen(
        repository: widget.repository,
        protocol: protocol,
        ai: widget.ai,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final guidance = _session.latest;

    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _TopStrip(session: _session, onClose: () => Navigator.of(context).pop()),
            Expanded(
              child: guidance == null
                  ? _EmptyState(
                      suggestions: widget.ai.advisor.suggestions(),
                      onPick: _submit,
                      partial: _session.partial,
                    )
                  : _AnswerView(
                      guidance: guidance,
                      partial: _session.partial,
                      onStart: _start,
                    ),
            ),
            if (guidance != null) _sourceStrip(guidance),
            _Composer(
              controller: _input,
              session: _session,
              onSubmit: _submit,
              onMic: _toggleListening,
            ),
          ],
        ),
      ),
    );
  }

  Widget _sourceStrip(Guidance guidance) {
    final sourceId = guidance.sourceId;
    if (sourceId == null) return const SizedBox.shrink();
    final source = widget.repository.sourceById(sourceId);
    if (source == null) return const SizedBox.shrink();

    return MSourceStrip(
      publisher: source.publisher,
      verified: guidance.verified,
      title: source.title,
      quote: guidance.quote,
      citation: source.citation,
      verificationNote: guidance.verificationNote,
      paraphrased: guidance.quoteKind == QuoteKind.paraphrase,
    );
  }
}

class _TopStrip extends StatelessWidget {
  const _TopStrip({required this.session, required this.onClose});

  final VoiceSession session;
  final VoidCallback onClose;

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
          const Expanded(child: MLabel('ASK MAYDAY · OFFLINE')),
          MLabel(
            session.mic.label,
            color: session.mic.canListen ? MColor.textDim : MColor.warn,
          ),
          const SizedBox(width: MSpace.gap),
          GestureDetector(
            onTap: onClose,
            behavior: HitTestBehavior.opaque,
            child: const MLabel('CLOSE'),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.suggestions,
    required this.onPick,
    required this.partial,
  });

  final List<String> suggestions;
  final ValueChanged<String> onPick;
  final String partial;

  @override
  Widget build(BuildContext context) {
    if (partial.isNotEmpty) return _Partial(text: partial);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(MSpace.gutter),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: MSpace.gap),
          Text('WHAT CAN\nYOU SEE?', style: MType.instruction),
          const SizedBox(height: MSpace.gap),
          Text(
            'Say it in your own words. Answers come from the 2025 guidelines '
            'and every one shows you the line it came from.',
            style: MType.detail,
          ),
          const SizedBox(height: MSpace.gutter),
          const MLabel('TRY'),
          for (final suggestion in suggestions)
            MButton(label: suggestion.toUpperCase(), onTap: () => onPick(suggestion)),
        ],
      ),
    );
  }
}

class _Partial extends StatelessWidget {
  const _Partial({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(MSpace.gutter),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const MLabel('LISTENING'),
          const SizedBox(height: MSpace.gap),
          Text(text, style: MType.instructionSmall.copyWith(color: MColor.textDim)),
        ],
      ),
    );
  }
}

class _AnswerView extends StatelessWidget {
  const _AnswerView({
    required this.guidance,
    required this.partial,
    required this.onStart,
  });

  final Guidance guidance;
  final String partial;
  final ValueChanged<String> onStart;

  @override
  Widget build(BuildContext context) {
    if (partial.isNotEmpty) return _Partial(text: partial);

    final protocolId = guidance.protocolId;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(MSpace.gutter),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MLabel(
            '“${guidance.utterance}”'.toUpperCase(),
            color: MColor.textFaint,
          ),
          const SizedBox(height: MSpace.gap),
          Semantics(
            liveRegion: true,
            child: Text(
              guidance.display,
              style: guidance.display.length > 90
                  ? MType.detail.copyWith(fontSize: 24, color: MColor.text)
                  : MType.instructionSmall,
            ),
          ),
          const SizedBox(height: MSpace.gutter),

          if (guidance.kind == GuidanceKind.clarify)
            for (final option in guidance.options)
              MButton(
                label: option.label.toUpperCase(),
                emphasis: option == guidance.options.first,
                onTap: () => onStart(option.protocolId),
              )
          else if (guidance.offersProtocol && protocolId != null)
            MButton(
              label: 'START THIS NOW',
              emphasis: true,
              detail: guidance.kind == GuidanceKind.escalate
                  ? 'HEARD SOMETHING TIME-CRITICAL'
                  : null,
              onTap: () => onStart(protocolId),
            )
          else if (protocolId != null)
            MButton(
              label: 'OPEN THE FULL PROTOCOL',
              onTap: () => onStart(protocolId),
            ),

          const SizedBox(height: MSpace.gutter),
          _Confidence(guidance: guidance),
        ],
      ),
    );
  }
}

/// Shows the machinery. Which words matched, how sure the match was, and — when
/// the answer was a refusal — that the refusal was deliberate.
///
/// Most assistants hide this. In an app somebody might act on, a visible
/// confidence and a visible list of matched words is the difference between
/// "the phone said so" and "I can see why it said so".
class _Confidence extends StatelessWidget {
  const _Confidence({required this.guidance});

  final Guidance guidance;

  @override
  Widget build(BuildContext context) {
    final matched = guidance.matched.where((t) => !t.startsWith('not_')).toList()
      ..sort();
    final percent = (guidance.confidence * 100).round();

    return Container(
      padding: const EdgeInsets.all(MSpace.gap),
      decoration: const BoxDecoration(
        color: MColor.surface,
        borderRadius: MSpace.border,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MLabel(switch (guidance.kind) {
            GuidanceKind.escalate => 'MATCHED A TIME-CRITICAL PHRASE',
            GuidanceKind.coverageGap => 'NOT COVERED — ON PURPOSE',
            GuidanceKind.clarify => 'TWO READINGS · ASKING INSTEAD OF GUESSING',
            GuidanceKind.unknown => 'NO CONFIDENT MATCH · SAYING SO',
            _ => 'MATCH $percent%',
          }),
          if (matched.isNotEmpty) ...[
            const SizedBox(height: MSpace.tight),
            Text('on: ${matched.join(', ')}', style: MType.citation),
          ],
        ],
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.session,
    required this.onSubmit,
    required this.onMic,
  });

  final TextEditingController controller;
  final VoiceSession session;
  final ValueChanged<String> onSubmit;
  final VoidCallback onMic;

  @override
  Widget build(BuildContext context) {
    final listening = session.state == VoiceState.listening;
    final canListen = session.mic.canListen;

    return Container(
      padding: const EdgeInsets.fromLTRB(
          MSpace.gutter, MSpace.gap, MSpace.gutter, MSpace.gap),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: MColor.rule)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!canListen && session.mic.announcement != null)
            Padding(
              padding: const EdgeInsets.only(bottom: MSpace.tight),
              child: Text(session.mic.announcement!,
                  style: MType.citation.copyWith(color: MColor.warn)),
            ),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  style: MType.detail.copyWith(color: MColor.text),
                  cursorColor: MColor.signal,
                  textInputAction: TextInputAction.send,
                  onSubmitted: onSubmit,
                  decoration: InputDecoration(
                    isDense: true,
                    filled: true,
                    fillColor: MColor.surface,
                    hintText: 'Type what you can see',
                    hintStyle: MType.detail.copyWith(color: MColor.textFaint),
                    border: const OutlineInputBorder(
                      borderRadius: MSpace.border,
                      borderSide: BorderSide(color: MColor.rule),
                    ),
                    enabledBorder: const OutlineInputBorder(
                      borderRadius: MSpace.border,
                      borderSide: BorderSide(color: MColor.rule),
                    ),
                    focusedBorder: const OutlineInputBorder(
                      borderRadius: MSpace.border,
                      borderSide: BorderSide(color: MColor.signal),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: MSpace.gap, vertical: 18),
                  ),
                ),
              ),
              const SizedBox(width: MSpace.tight),
              GestureDetector(
                onTap: () => onSubmit(controller.text),
                behavior: HitTestBehavior.opaque,
                child: Container(
                  height: MSpace.minTarget,
                  width: MSpace.minTarget,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: MColor.surface,
                    borderRadius: MSpace.border,
                  ),
                  child: const Icon(Icons.arrow_upward,
                      color: MColor.text, size: 22),
                ),
              ),
            ],
          ),
          MButton(
            label: listening ? 'LISTENING — TAP TO STOP' : 'TALK',
            emphasis: listening,
            detail: canListen ? null : session.mic.label,
            onTap: canListen ? onMic : null,
          ),
        ],
      ),
    );
  }
}
