/**
 * The call.
 *
 * Mayday never calls 911. Not in a demo build, not in a store build, under no
 * circumstances. There is no code in this app that can dial or text any
 * number: the countdown and the call screen show what the flow looks like,
 * nothing is dialed, and the voice tells the person to call 911 themselves if
 * the emergency is real. __tests__/never911.test.ts fails the build if a way
 * to dial is ever added back.
 */
export type CallHow = 'simulated';

export async function placeCall(): Promise<CallHow> {
  return 'simulated';
}
