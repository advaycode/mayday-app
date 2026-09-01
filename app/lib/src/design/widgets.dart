import 'package:flutter/material.dart';

import 'tokens.dart';

/// The standard action. Flat, hard-edged, at least 72 high, one emphasis per
/// screen — see the rules in [MColor].
class MButton extends StatefulWidget {
  const MButton({
    super.key,
    required this.label,
    required this.onTap,
    this.emphasis = false,
    this.detail,
    this.minHeight = 72,
  });

  final String label;
  final String? detail;
  final VoidCallback? onTap;
  final bool emphasis;
  final double minHeight;

  @override
  State<MButton> createState() => _MButtonState();
}

class _MButtonState extends State<MButton> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null;
    final bg = widget.emphasis
        ? (_down ? MColor.signalPressed : MColor.signal)
        : (_down ? MColor.surfaceHigh : MColor.surface);

    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.label,
      child: GestureDetector(
        onTapDown: enabled ? (_) => setState(() => _down = true) : null,
        onTapCancel: enabled ? () => setState(() => _down = false) : null,
        onTapUp: enabled ? (_) => setState(() => _down = false) : null,
        onTap: widget.onTap,
        child: Opacity(
          opacity: enabled ? 1 : 0.4,
          child: Container(
            margin: const EdgeInsets.only(top: 8),
            constraints: BoxConstraints(minHeight: widget.minHeight),
            alignment: Alignment.center,
            decoration: BoxDecoration(color: bg, borderRadius: MSpace.border),
            padding: const EdgeInsets.symmetric(
                horizontal: MSpace.gap, vertical: MSpace.gap),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(widget.label,
                    textAlign: TextAlign.center, style: MType.button),
                if (widget.detail != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    widget.detail!,
                    textAlign: TextAlign.center,
                    style: MType.label.copyWith(
                      color: widget.emphasis ? Colors.white70 : MColor.textFaint,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A small all-caps section marker.
class MLabel extends StatelessWidget {
  const MLabel(this.text, {super.key, this.color});

  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) =>
      Text(text, style: MType.label.copyWith(color: color));
}

/// The citation footer: publisher, verification state, and the quoted text the
/// answer rests on. Tapping opens the full source.
///
/// This is the answer to "how do you know that?", and it is deliberately
/// attached to *every* answer surface in the app rather than hidden in an about
/// page. An assistant that cannot show its source is asking to be trusted on
/// nothing.
class MSourceStrip extends StatelessWidget {
  const MSourceStrip({
    super.key,
    required this.publisher,
    required this.verified,
    this.title,
    this.quote,
    this.citation,
    this.verificationNote,
    this.paraphrased = false,
  });

  final String publisher;
  final bool verified;
  final String? title;
  final String? quote;
  final String? citation;
  final String? verificationNote;
  final bool paraphrased;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: quote == null ? null : () => _openSheet(context),
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
                '$publisher · ${verified ? 'verified' : 'unconfirmed'}'
                '${paraphrased ? ' · paraphrase' : ''}',
                style: MType.citation.copyWith(
                    color: verified ? MColor.textFaint : MColor.warn),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (quote != null) const MLabel('SOURCE'),
          ],
        ),
      ),
    );
  }

  void _openSheet(BuildContext context) {
    showModalBottomSheet<void>(
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
              const MLabel('SOURCE'),
              const SizedBox(height: MSpace.tight),
              if (title != null) Text(title!, style: MType.button),
              const SizedBox(height: MSpace.gap),
              Text('"$quote"',
                  style: MType.detail.copyWith(color: MColor.text)),
              if (citation != null) ...[
                const SizedBox(height: MSpace.gap),
                Text(citation!, style: MType.citation),
              ],
              if (!verified) ...[
                const SizedBox(height: MSpace.gap),
                Container(
                  padding: const EdgeInsets.all(MSpace.gap),
                  color: MColor.surfaceHigh,
                  child: Text(
                    '${paraphrased ? 'PARAPHRASE — ' : ''}NOT YET CONFIRMED '
                    'against the primary source. ${verificationNote ?? ''}',
                    style: MType.citation.copyWith(color: MColor.warn),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
