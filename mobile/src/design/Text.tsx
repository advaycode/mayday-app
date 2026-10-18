import { Text as RNText, type TextProps } from 'react-native';

import { color, type as typeScale } from './tokens';

type Variant = keyof typeof typeScale;

export type Props = TextProps & {
  variant?: Variant;
  tone?: 'ink' | 'muted' | 'faint' | 'onSignal';
  /** Fixed-width digits so timers and counts do not jitter as they change. */
  tabular?: boolean;
};

const tones = {
  ink: color.ink,
  muted: color.inkMuted,
  faint: color.inkFaint,
  onSignal: color.onSignal,
} as const;

export function Text({ variant = 'body', tone = 'ink', tabular, style, ...rest }: Props) {
  return (
    <RNText
      {...rest}
      style={[
        typeScale[variant],
        { color: tones[tone] },
        tabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
    />
  );
}
