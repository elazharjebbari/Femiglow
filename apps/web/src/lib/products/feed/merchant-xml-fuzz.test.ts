/**
 * Tests **property-based / fuzz** du sérialiseur Google Merchant XML.
 *
 * Pourquoi un fichier dédié ?
 *  - Les tests fonctionnels classiques (`merchant-xml.test.ts`) couvrent
 *    des **exemples** : « pour cette entrée précise, j'attends cette
 *    sortie ». Suffisant pour bloquer une régression connue, mais
 *    insuffisant pour les invariants de sécurité (« quelle que soit
 *    l'entrée, le XML produit reste bien formé »).
 *  - `fast-check` génère des centaines de cas de test aléatoires (1000
 *    runs par défaut) et explore l'espace Unicode complet : surrogate
 *    pairs, control chars, séquences de fermeture CDATA, mix de
 *    caractères XML interdits.
 *
 * Invariants testés ici :
 *  1. **escapeXml round-trip** — `decode(escapeXml(s)) === s` pour
 *     toute string Unicode. Garantit qu'on n'encode pas trop / pas
 *     assez (le double échappement et l'échappement partiel sont les
 *     deux bugs classiques).
 *  2. **escapeXml ne laisse aucun caractère XML interdit non échappé**
 *     dans la sortie (`<>&"'` doivent tous être encodés en entités).
 *  3. **escapeXml est idempotent sur le contrat « pas de caractères
 *     interdits restants »** : appliquer escapeXml deux fois n'introduit
 *     pas de nouveaux caractères interdits.
 *
 * Note : on ne teste pas l'idempotence stricte (`escape(escape(s)) ===
 * escape(s)`) parce qu'elle est fausse par design — `&` se ré-encode
 * en `&amp;` au deuxième passage. C'est le comportement attendu
 * (sinon, on ne pourrait pas distinguer `&amp;` saisi par l'utilisateur
 * d'un `&` qu'on doit encoder).
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { cdata, escapeXml, stripInvalidXmlChars } from './merchant-xml';

/**
 * Décode les 5 entités XML produites par `escapeXml`. Ordre crucial :
 * `&amp;` doit être décodé EN DERNIER, sinon `&amp;lt;` (qui représente
 * « &lt; » comme texte littéral) deviendrait `&lt;` puis `<` (perte
 * d'information).
 */
function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

describe('escapeXml — property-based (fast-check)', () => {
  it('round-trip : decodeXml(escapeXml(s)) === s pour toute string Unicode', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(decodeXml(escapeXml(s))).toBe(s);
      }),
      { numRuns: 1000 },
    );
  });

  it('ne laisse aucun caractère XML interdit non-encodé dans la sortie', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const escaped = escapeXml(s);
        // On retire d'abord les entités légitimes (&xxx;) avant de
        // chercher des caractères interdits résiduels — sinon le `&`
        // de `&amp;` lui-même déclencherait un faux positif.
        const stripped = escaped.replace(/&(amp|lt|gt|quot|apos);/g, '');
        expect(stripped).not.toMatch(/[<>&"']/);
      }),
      { numRuns: 1000 },
    );
  });

  it('round-trip survit aux strings Unicode complètes (surrogate pairs, emojis)', () => {
    // `fc.string({ unit: 'grapheme' })` couvre tout le BMP +
    // supplementary plane — emojis, idéogrammes CJK, séquences ZWJ. En
    // fast-check v4, le générateur `fullUnicodeString` historique a
    // été remplacé par cette option. C'est l'espace que peut traverser
    // une `description` admin éditée librement.
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme' }), (s) => {
        expect(decodeXml(escapeXml(s))).toBe(s);
      }),
      { numRuns: 1000 },
    );
  });

  it('produit toujours un output valide même sur strings exclusivement composées de chars dangereux', () => {
    // Plus tordu : que des caractères XML interdits, dans un ordre
    // arbitraire. On veut zéro caractère brut dans la sortie.
    const dangerousChar = fc.constantFrom('<', '>', '&', '"', "'");
    fc.assert(
      fc.property(fc.array(dangerousChar, { minLength: 1, maxLength: 50 }), (arr) => {
        const s = arr.join('');
        const escaped = escapeXml(s);
        const stripped = escaped.replace(/&(amp|lt|gt|quot|apos);/g, '');
        expect(stripped).toBe('');
        expect(decodeXml(escaped)).toBe(s);
      }),
      { numRuns: 500 },
    );
  });

  it('respecte le contrat « pas de caractères interdits restants » sur double passage', () => {
    // `escapeXml(escapeXml(s))` n'est pas idempotent (cf. note du
    // header), mais doit conserver l'invariant : pas de caractère XML
    // interdit non encodé dans la sortie.
    fc.assert(
      fc.property(fc.string(), (s) => {
        const doubleEscaped = escapeXml(escapeXml(s));
        const stripped = doubleEscaped.replace(/&(amp|lt|gt|quot|apos);/g, '');
        expect(stripped).not.toMatch(/[<>&"']/);
      }),
      { numRuns: 500 },
    );
  });
});

/**
 * Décode un payload `<![CDATA[…]]>` (potentiellement coupé en plusieurs
 * sections par la séquence d'échappement W3C `]]]]><![CDATA[>`) en
 * reconstituant la chaîne originale.
 *
 * Le pattern : `]]]]><![CDATA[>` représente un littéral `]]>` qui aurait
 * fermé prématurément le bloc. On le remplace par `]]>` pour reconstituer.
 * Ensuite on retire le wrapper `<![CDATA[ … ]]>`.
 */
function decodeCdata(wrapped: string): string {
  if (!wrapped.startsWith('<![CDATA[') || !wrapped.endsWith(']]>')) {
    throw new Error(`not a CDATA block: ${JSON.stringify(wrapped)}`);
  }
  const inner = wrapped.slice('<![CDATA['.length, -']]>'.length);
  // Reverse W3C escape : la fenêtre `]]]]><![CDATA[>` représente un
  // `]]>` littéral dans la chaîne d'origine.
  return inner.replace(/]]]]><!\[CDATA\[>/g, ']]>');
}

describe('cdata — property-based (fast-check)', () => {
  it('round-trip : decodeCdata(cdata(s)) === stripInvalidXmlChars(s)', () => {
    // Note : on compare au stripped, pas à l'input brut, parce que
    // `cdata` strip volontairement les control chars XML-invalides
    // avant le wrapping. Cf. doc de `stripInvalidXmlChars`.
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(decodeCdata(cdata(s))).toBe(stripInvalidXmlChars(s));
      }),
      { numRuns: 1000 },
    );
  });

  it('round-trip survit aux strings Unicode complètes (emojis, CJK, ZWJ)', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme' }), (s) => {
        expect(decodeCdata(cdata(s))).toBe(stripInvalidXmlChars(s));
      }),
      { numRuns: 1000 },
    );
  });

  it('produit un wrapper bien formé : commence par <![CDATA[ et finit par ]]>', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const wrapped = cdata(s);
        expect(wrapped.startsWith('<![CDATA[')).toBe(true);
        expect(wrapped.endsWith(']]>')).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it('aucun ]]> brut ne ferme prématurément le bloc — toute occurrence interne fait partie du pattern d\'échappement W3C', () => {
    // Invariant : dans le contenu *à l\'intérieur* du wrapper, toute
    // séquence `]]>` doit être suivie immédiatement de `<![CDATA[>`
    // (le pattern W3C qui réouvre le bloc). Une `]]>` orpheline
    // signifierait une fermeture prématurée → catastrophe XML.
    fc.assert(
      fc.property(fc.string(), (s) => {
        const wrapped = cdata(s);
        const inner = wrapped.slice('<![CDATA['.length, -']]>'.length);
        // Cherche toutes les occurrences de `]]>` dans le contenu
        // interne. Chaque occurrence DOIT être suivie de `<![CDATA[>`.
        let idx = 0;
        while ((idx = inner.indexOf(']]>', idx)) !== -1) {
          const after = inner.slice(idx + ']]>'.length, idx + ']]>'.length + '<![CDATA[>'.length);
          expect(after).toBe('<![CDATA[>');
          idx += ']]>'.length;
        }
      }),
      { numRuns: 1000 },
    );
  });

  it('round-trip survit aux séquences ]]> répétées (adversaire qui force la fermeture prématurée)', () => {
    // Génère des chaînes saturées de `]]>` partiels et complets.
    // Stress-test la robustesse de l'échappement W3C.
    const cdataAttack = fc.array(
      fc.constantFrom(']', ']]', ']]>', ']]]]', ']]]>', ']]]]>', 'a', 'b'),
      { minLength: 1, maxLength: 30 },
    );
    fc.assert(
      fc.property(cdataAttack, (parts) => {
        const s = parts.join('');
        expect(decodeCdata(cdata(s))).toBe(stripInvalidXmlChars(s));
      }),
      { numRuns: 500 },
    );
  });

  it('strip les control chars XML-invalides (U+0000..U+001F sauf TAB/LF/CR)', () => {
    // XML 1.0 (§2.2) interdit U+0000..U+0008, U+000B, U+000C,
    // U+000E..U+001F, *même dans CDATA*. On vérifie qu'aucun de ces
    // chars ne survit dans la sortie pour toute string incluant
    // potentiellement des control chars.
    const stringWithControlChars = fc.string({
      unit: fc.oneof(
        fc.constantFrom('\x00', '\x01', '\x07', '\x0B', '\x0C', '\x1F'),
        fc.constantFrom('a', 'é', ']', '>'),
      ),
    });
    fc.assert(
      fc.property(stringWithControlChars, (s) => {
        const wrapped = cdata(s);
        // Le contenu interne ne doit pas contenir de control chars
        // interdits. On regarde le wrapper entier — `<![CDATA[…]]>` ne
        // contient lui-même aucun control char.
        // eslint-disable-next-line no-control-regex
        expect(wrapped).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
      }),
      { numRuns: 1000 },
    );
  });

  it('préserve TAB (\\t), LF (\\n) et CR (\\r) — les 3 control chars XML-valides', () => {
    // XML 1.0 autorise explicitement ces 3 chars. On les distingue de
    // la plage interdite pour ne pas trop nettoyer (cas typique : une
    // description multilignes avec des `\n`).
    const validControls = fc.array(fc.constantFrom('\t', '\n', '\r', 'a', 'é'), {
      minLength: 1,
      maxLength: 30,
    });
    fc.assert(
      fc.property(validControls, (arr) => {
        const s = arr.join('');
        const wrapped = cdata(s);
        // Compte les TAB/LF/CR dans l'input vs dans le wrapper. Le
        // wrapper ne peut qu'en avoir AU MOINS autant (il ne devrait
        // pas en injecter, mais on tolère car le wrapping n'en ajoute
        // pas non plus). En pratique : compte exact.
        const countIn = (s.match(/[\t\n\r]/g) ?? []).length;
        const countOut = (wrapped.match(/[\t\n\r]/g) ?? []).length;
        expect(countOut).toBe(countIn);
      }),
      { numRuns: 500 },
    );
  });
});

describe('stripInvalidXmlChars — property-based (fast-check)', () => {
  it('idempotent : strip(strip(s)) === strip(s)', () => {
    // Une fois nettoyé, repasser ne retire rien de plus.
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(stripInvalidXmlChars(stripInvalidXmlChars(s))).toBe(stripInvalidXmlChars(s));
      }),
      { numRuns: 1000 },
    );
  });

  it('ne touche jamais les caractères Unicode au-delà de U+001F', () => {
    // Espace BMP au-delà de la zone control + tout supplementary plane
    // doivent passer intacts.
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme' }), (s) => {
        // Filtrer mentalement les control chars de l'input puis
        // comparer à la sortie strip — équivalent au comportement
        // attendu.
        // eslint-disable-next-line no-control-regex
        const expected = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
        expect(stripInvalidXmlChars(s)).toBe(expected);
      }),
      { numRuns: 1000 },
    );
  });
});
