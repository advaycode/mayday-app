import { z } from 'zod';

import { Intent } from '@/protocols/schema';

/**
 * The one shape every router returns, whether it is the offline keyword
 * router or a language model behind the proxy. Model output is parsed with
 * this schema; anything that does not fit is thrown away, not "fixed".
 *
 * Note what is NOT in here: no free text that the app will speak. The model
 * picks from fixed lists (protocol ids, intents, question ids). It cannot
 * invent an instruction because there is no field to put one in.
 */
export const ProtocolId = z.enum([
  'cpr_adult',
  'cpr_child',
  'cpr_infant',
  'choking',
  'choking_infant',
  'bleeding',
  'burns',
  'stroke',
  'opioid_overdose',
  'recovery_position',
]);
export type ProtocolId = z.infer<typeof ProtocolId>;

export const QuestionId = z.enum(['age', 'what', 'breathing']);
export type QuestionId = z.infer<typeof QuestionId>;

export const RouterSlots = z
  .object({
    age_group: z.enum(['adult', 'child', 'infant']),
    conscious: z.enum(['true', 'false']),
    breathing: z.enum(['normal', 'abnormal']),
    severe_fbao: z.enum(['true', 'false']),
    wound_site: z.enum(['limb', 'junctional', 'torso']),
    burn_severity: z.enum(['major', 'minor']),
    has_naloxone: z.enum(['true', 'false']),
    others_present: z.enum(['true', 'false']),
  })
  .partial();
export type RouterSlots = z.infer<typeof RouterSlots>;

export const RouterOutput = z.object({
  /** Which protocol fits, or null if we cannot tell yet. */
  protocol_id: ProtocolId.nullable(),
  /** An in-protocol intent ("the AED is here"), or null. */
  intent: Intent.nullable(),
  slots: RouterSlots,
  confidence: z.number().min(0).max(1),
  /** If unsure, which fixed question to ask next. Never free text. */
  next_question: QuestionId.nullable(),
  /** True when a life-threat keyword fired: start the protocol now, do not wait for anything. */
  urgent: z.boolean(),
});
export type RouterOutput = z.infer<typeof RouterOutput>;

export const EMPTY: RouterOutput = {
  protocol_id: null,
  intent: null,
  slots: {},
  confidence: 0,
  next_question: null,
  urgent: false,
};
