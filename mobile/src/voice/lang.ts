import { getLocales } from 'expo-localization';

import table from './translations.json';

/**
 * Spanish and Hindi, for the adult CPR flow (a first step; every other line
 * is still said in English). The language is the one the rescuer speaks:
 * Devanagari is Hindi, Spanish words make it Spanish. The router stays an
 * English keyword router, so a Spanish or Hindi sentence is glossed into the
 * English words it listens for ("no respira" -> "not breathing").
 */

export type Lang = 'en' | 'es' | 'hi';

let current: Lang = 'en';
export const getLang = () => current;
export const setLang = (l: Lang) => {
  current = l;
};

const strip = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const ES_WORDS = /\b(no respira|respira|respirando|se desmayo|se cayo|desmayo|ayuda|mi papa|mi mama|mi padre|mi madre|esta|estoy|solo|sola|hermano|hermana|hijo|hija|abuelo|abuela|esposo|esposa|amigo|amiga|listo|alguien)\b/;

/** The language of something the rescuer said. */
export function detectLang(text: string): Lang {
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  if (/[¿¡ñ]/i.test(text) || ES_WORDS.test(strip(text))) return 'es';
  return 'en';
}

/** The recognizer's language: the conversation's, or else the phone's own if it is one Mayday speaks. */
export function recognizerLang(): string {
  const l = current !== 'en' ? current : (getLocales()[0]?.languageCode ?? 'en');
  return l === 'es' ? 'es-US' : l === 'hi' ? 'hi-IN' : 'en-US';
}

// Spanish (accents stripped) and Hindi phrases -> the English words the router knows.
const PEOPLE: [RegExp, string][] = [
  [/\bmi (papa|padre)\b|मेरे (पापा|पिताजी|पिता)/, 'my dad'],
  [/\bmi (mama|madre)\b|मेरी (मम्मी|माँ|मां|माता)/, 'my mom'],
  [/\bmi (esposo|marido)\b|मेरे पति/, 'my husband'],
  [/\bmi esposa\b|मेरी पत्नी/, 'my wife'],
  [/\bmi abuelo\b|मेरे दादा/, 'my grandpa'],
  [/\bmi abuela\b|मेरी दादी/, 'my grandma'],
  [/\bmi hijo\b|मेरा बेटा/, 'my son'],
  [/\bmi hija\b|मेरी बेटी/, 'my daughter'],
  [/\bmi hermano\b|मेरा भाई/, 'my brother'],
  [/\bmi hermana\b|मेरी बहन/, 'my sister'],
  [/\bmi amig[oa]\b|मेरा दोस्त/, 'my friend'],
];
const WORDS: [RegExp, string][] = [
  [/\b(se desmayo|se cayo|se desplomo|colapso)\b|गिर (गए|गई|गया)|बेहोश/, 'collapsed'],
  [/\b(no respira|no esta respirando|dejo de respirar|no puede respirar)\b|(साँस|सांस) नहीं/, 'not breathing'],
  [/\b(estoy sol[oa])\b|मैं अकेल[ाी]/, "i'm alone"],
  [/\balguien fue\b|कोई गया/, 'someone went'],
  [/\bsolo (con las )?manos\b|सिर्फ़? हाथ/, 'hands only'],
  [/^(listo|hecho|ya)\b|हो गया/, 'done'],
  [/^si\b|^(हाँ|हां|जी हाँ)/, 'yes'],
  [/^no\b(?! respira)|^नहीं/, 'no'],
];

/** The English the router listens for, from a Spanish or Hindi sentence (unchanged if English). */
export function gloss(text: string, lang: Lang = detectLang(text)): string {
  if (lang === 'en') return text;
  const t = lang === 'es' ? strip(text) : text;
  const who = PEOPLE.find(([re]) => re.test(t))?.[1];
  const said = WORDS.filter(([re]) => re.test(t)).map(([, en]) => en);
  if (!said.length) return text;
  return [who, said.join(' and ')].filter(Boolean).join(' ');
}

type Table = { es: Record<string, string>; hi: Record<string, string>; relations: Record<string, [string, string, 'm' | 'f']> };
const T = table as unknown as Table;

/** A line in the conversation's language, or the English line if it has no translation yet. */
export function tr(line: string, lang: Lang = current): string {
  if (lang === 'en') return line;
  const direct = T[lang][line];
  if (direct) return direct;
  // "Your dad isn't breathing. We'll do this together." (the opener, personalized)
  const m = /^Your (\w+) isn't breathing\. We'll do this together\.$/.exec(line);
  const rel = m && T.relations[m[1]];
  if (rel) {
    const [es, hi, g] = rel;
    return lang === 'es'
      ? `Tu ${es} no respira. Lo haremos juntos.`
      : `${g === 'f' ? 'आपकी' : 'आपके'} ${hi} साँस नहीं ${g === 'f' ? 'ले रहीं' : 'ले रहे'}। हम साथ मिलकर करेंगे।`;
  }
  return line;
}

/** Every translated line, for tools/render_voice.py's check and the tests. */
export function allTranslated(): { lang: Exclude<Lang, 'en'>; text: string }[] {
  const out: { lang: Exclude<Lang, 'en'>; text: string }[] = [];
  for (const lang of ['es', 'hi'] as const) {
    for (const v of Object.values(T[lang])) out.push({ lang, text: v });
    for (const rel of Object.keys(T.relations)) out.push({ lang, text: tr(`Your ${rel} isn't breathing. We'll do this together.`, lang) });
  }
  return out;
}
