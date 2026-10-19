const SYSTEM = `You adapt spoken first-aid instructions for a frightened bystander helping someone.
For each line: refer to the patient with the given relation or pronoun instead of they, them, their. Keep it calm, plain and short.
Keep every action, body part, number and negation exactly as written. Never add a new action, body part, object or number. Never drop one.
You speak to the rescuer, never to the patient. 12 words or fewer per line. Return exactly as many lines as you were given, in the same order.
Reply as JSON: {"lines": [...]}`;
const lines = ["Tap their shoulders and shout.","Do they respond?","Lay them flat on their back, on the floor.","Kneel beside their chest.","Watch their chest.","Are they breathing normally?","Heel of one hand on the center of the chest.","Other hand on top. Lock your elbows.","Don't lift to look.","If they stop responding, tell me."];
const prompt = `Patient: the rescuer's dad (he). The rescuer is panicking: be extra calm.\n\n${JSON.stringify({ lines })}`;
const models = process.argv.slice(2);
const out = {};
for (const model of models) {
  const t = Date.now();
  const r = await fetch('http://127.0.0.1:11434/api/chat', { method: 'POST', body: JSON.stringify({ model, stream: false, format: 'json', keep_alive: '30m', options: { temperature: 0.1 }, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }] }) });
  const j = await r.json();
  let parsed = null; try { parsed = JSON.parse(j.message.content).lines; } catch {}
  out[model] = { ms: Date.now() - t, lines: parsed };
  console.log(model, Date.now() - t, 'ms', JSON.stringify(parsed));
}
(await import('node:fs')).writeFileSync('adapt_samples.json', JSON.stringify({ input: lines, pronoun: 'he', relation: 'dad', out }, null, 2));
