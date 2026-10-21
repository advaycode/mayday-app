import { Bed, Brain, Drop, Fire, Heartbeat, Pill, Wind } from 'phosphor-react-native';
import type { ComponentType } from 'react';

import type { Slots } from '@/protocols/engine';
import type { ProtocolId } from '@/voice/routerSchema';

import { tint, type TintName } from './tokens';

type IconType = ComponentType<{ size?: number; color?: string; weight?: 'regular' | 'fill' | 'bold' }>;

export type Emergency = {
  id: TintName;
  /** One or two words, what a bystander would say. */
  label: string;
  protocol: ProtocolId;
  /** What tapping the tile already tells us. */
  slots?: Slots;
  Icon: IconType;
};

/** The emergencies on Home, in the order people need them. */
export const EMERGENCIES: Emergency[] = [
  { id: 'cpr', label: 'Not breathing', protocol: 'cpr_adult', slots: { conscious: 'false', breathing: 'abnormal' }, Icon: Heartbeat },
  { id: 'choking', label: 'Choking', protocol: 'choking', Icon: Wind },
  { id: 'bleeding', label: 'Bleeding', protocol: 'bleeding', Icon: Drop },
  { id: 'burns', label: 'Burn', protocol: 'burns', Icon: Fire },
  { id: 'stroke', label: 'Stroke', protocol: 'stroke', Icon: Brain },
  { id: 'overdose', label: 'Overdose', protocol: 'opioid_overdose', Icon: Pill },
  // Passed out: the CPR protocol starts by checking, then goes to CPR or the recovery position.
  { id: 'recovery', label: 'Passed out', protocol: 'cpr_adult', Icon: Bed },
];

/** The color, icon and short name for a running protocol. */
export function emergencyFor(protocolId: string | null | undefined): { tint: (typeof tint)[TintName]; Icon: IconType; label: string } {
  const pick = (id: TintName, label: string) => {
    const e = EMERGENCIES.find((x) => x.id === id)!;
    return { tint: tint[id], Icon: e.Icon, label };
  };
  if (!protocolId) return pick('recovery', 'Help');
  if (protocolId.startsWith('cpr')) return pick('cpr', 'CPR');
  if (protocolId.startsWith('choking')) return pick('choking', 'Choking');
  if (protocolId === 'bleeding') return pick('bleeding', 'Bleeding');
  if (protocolId === 'burns') return pick('burns', 'Burn');
  if (protocolId === 'stroke') return pick('stroke', 'Stroke');
  if (protocolId === 'opioid_overdose') return pick('overdose', 'Overdose');
  return pick('recovery', 'Recovery');
}
