import bleeding from './corpus/bleeding.json';
import burns from './corpus/burns.json';
import choking from './corpus/choking.json';
import chokingInfant from './corpus/choking_infant.json';
import cprAdult from './corpus/cpr_adult.json';
import cprChild from './corpus/cpr_child.json';
import cprInfant from './corpus/cpr_infant.json';
import opioidOverdose from './corpus/opioid_overdose.json';
import recoveryPosition from './corpus/recovery_position.json';
import sourcesFile from './corpus/sources.json';
import stroke from './corpus/stroke.json';
import { Protocol, SourceFile, type Source, type Step } from './schema';

/**
 * The bundled protocol library. Every file is validated against the schema
 * when the app starts: a malformed protocol fails loudly in development and
 * in the test suite, never silently in front of a rescuer.
 */
const raw = [cprAdult, cprChild, cprInfant, choking, chokingInfant, bleeding, burns, stroke, opioidOverdose, recoveryPosition];

export const protocols: Record<string, Protocol> = Object.fromEntries(
  raw.map((p) => {
    const parsed = Protocol.parse(p);
    return [parsed.id, parsed];
  }),
);

export const sources: Record<string, Source> = Object.fromEntries(
  SourceFile.parse(sourcesFile).sources.map((s) => [s.id, s]),
);

export function getProtocol(id: string): Protocol {
  const p = protocols[id];
  if (!p) throw new Error(`Unknown protocol: ${id}`);
  return p;
}

export function getStep(protocolId: string, stepId: string): Step {
  const step = getProtocol(protocolId).steps.find((s) => s.id === stepId);
  if (!step) throw new Error(`Unknown step: ${protocolId}#${stepId}`);
  return step;
}

/** Protocols shown in the library, in the order a bystander is most likely to need them. */
export const libraryOrder = [
  'cpr_adult',
  'cpr_child',
  'cpr_infant',
  'choking',
  'choking_infant',
  'bleeding',
  'stroke',
  'opioid_overdose',
  'burns',
  'recovery_position',
];

export * from './schema';
