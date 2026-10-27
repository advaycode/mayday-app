import { detectLang, gloss, tr } from '@/voice/lang';
import { route } from '@/voice/router';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

describe('Spanish and Hindi, adult CPR', () => {
  const said = {
    es: 'Mi papá se desmayó y no respira.',
    hi: 'मेरे पापा गिर गए हैं और साँस नहीं ले रहे।',
  } as const;

  it('knows the language from what was said', () => {
    expect(detectLang(said.es)).toBe('es');
    expect(detectLang(said.hi)).toBe('hi');
    expect(detectLang("My dad collapsed and he's not breathing.")).toBe('en');
  });

  it('routes the glossed sentence to adult CPR', () => {
    for (const lang of ['es', 'hi'] as const) {
      expect(gloss(said[lang], lang)).toBe('my dad collapsed and not breathing');
      expect(route(gloss(said[lang], lang)).protocol_id).toBe('cpr_adult');
    }
  });

  it('answers in that language, personalized', () => {
    const opener = "Your dad isn't breathing. We'll do this together.";
    expect(tr(opener, 'es')).toBe('Tu papá no respira. Lo haremos juntos.');
    expect(tr(opener, 'hi')).toBe('आपके पापा साँस नहीं ले रहे। हम साथ मिलकर करेंगे।');
    expect(tr("I'm alone", 'hi')).toBe('मैं अकेला हूँ');
    expect(tr('Not translated yet.', 'es')).toBe('Not translated yet.');
  });
});
