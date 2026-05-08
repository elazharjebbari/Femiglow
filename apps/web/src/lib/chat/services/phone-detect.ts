/**
 * CHA-225 — Détecteur de coordonnées inline ("inline-contact").
 *
 * Sert deux objectifs critiques :
 *
 *  1. **Filet de sécurité commerciale** — l'utilisateur a écrit son numéro
 *     en clair dans le chat (cas réel observé : "hamid +212751592310")
 *     plutôt que de soumettre le formulaire. Sans détection on perdait
 *     ces leads. Le détecteur permet à l'orchestrateur de :
 *       - pousser le widget de capture (pour récupérer le consent
 *         RGPD propre + valider l'orthographe du numéro),
 *       - créer un `chat_lead` automatique en fallback si le visiteur
 *         ne soumet jamais le formulaire (auto-lead, `consent: 'inline-chat-fallback'`).
 *
 *  2. **Extraction structurée** — on extrait `phoneE164` via le helper
 *     éprouvé `lib/phone.ts` (couvre MA/FR/BE/CH/DZ/TN), ainsi que le
 *     `firstName` candidat (token alphabétique précédant le numéro).
 *
 * Spécifications anti-faux-positifs :
 *  - "290 MAD" → ne matche pas (3 chiffres, hors longueur min).
 *  - "RDV le 15 06 2026" → ne matche pas (séquence ne valide pas E.164).
 *  - "0651592310" → matche (mobile MA, → +212651592310).
 *  - "+212 7 51 59 23 10" → matche (séparateurs tolérés).
 *  - "0033 6 12 34 56 78" → matche (préfixe international 00 → +33).
 *
 * cf. docs/chat-assistant/19-lead-capture-form.md §6.1
 *      docs/chat-assistant/CHA-225-inline-contact.md
 */

import { tryParsePhone, type CountryCode, type NormalizedPhone } from '@/lib/phone';

/**
 * Résultat d'une détection inline.
 *
 * `phoneE164` est `null` quand aucun numéro n'a été détecté (ou détecté
 * mais invalide après parsing). Le caller doit tester `phoneE164` pour
 * décider de continuer.
 */
export interface InlineContactDetection {
  /** Numéro normalisé E.164 (`+212651592310`) si trouvé et valide. */
  phoneE164: string | null;
  /** Numéro brut tel que tapé par le visiteur (snippet utile). */
  phoneRaw: string | null;
  /** Métadonnées du parser téléphonique (pays, type) si parsing réussi. */
  phoneMeta: NormalizedPhone | null;
  /** Prénom candidat extrait du même message (token avant le numéro). */
  firstName: string | null;
  /** Confiance de la détection (cf. règles ci-dessous). */
  confidence: 'high' | 'medium' | 'low' | 'none';
  /** Raison rapide pour les logs (pourquoi on a renvoyé ce verdict). */
  reason: string;
}

/**
 * Pattern strict de "candidat numéro de téléphone".
 *
 * Trois alternatives mutuellement exclusives, du plus précis au plus large :
 *  1. Préfixe international `+` (ou `00`) suivi d'au moins 9 chiffres
 *     (séparateurs espace/tiret/point/parenthèses tolérés).
 *  2. Format mobile MA explicite : `0[5-7]` + 8 chiffres.
 *  3. ≥ 10 chiffres consécutifs (séparateurs tolérés) — filet pour les
 *     formats internationaux saisis sans `+` ni `00`.
 *
 * On capture le snippet brut pour le passer ensuite à `tryParsePhone`
 * qui valide la longueur, le pays et le type. Les faux positifs (dates,
 * codes promo, prix MAD) sont éliminés par `tryParsePhone`.
 */
const PHONE_CANDIDATE_PATTERN =
  /(?:(?:\+|00)(?:\d[\s\-.()]*){8,}\d)|(?:\b0\s*[5-7](?:[\s\-.]*\d){8})|(?:(?:\d[\s\-.]*){9,}\d)/g;

/**
 * Pattern d'extraction d'un prénom candidat.
 *
 * On capture les 1-2 premiers tokens alphabétiques (latins ou arabes)
 * qui précèdent le numéro, en filtrant les mots de liaison fréquents
 * ("voici", "mon", "numero", etc.) qui sont souvent collés au numéro.
 */
const FIRST_NAME_TOKEN = /\b([\p{L}][\p{L}'’-]{1,29})\b/gu;

/** Mots à ignorer comme prénoms candidats (FR/AR/Darija). */
const FIRST_NAME_STOPWORDS = new Set([
  // FR
  'voici', 'voila', 'voilà', 'mon', 'ma', 'mes', 'le', 'la', 'les',
  'un', 'une', 'des', 'numero', 'numéro', 'tel', 'tél', 'telephone',
  'téléphone', 'portable', 'mobile', 'gsm', 'whatsapp', 'whats', 'app',
  'contact', 'contactez', 'rappelez', 'appelez', 'appellez', 'rappellez',
  'appel', 'rappel', 'rappeler', 'appeler',
  'merci', 'svp', 'stp', 'plait', 'plaît', 'cordialement', 'salut',
  'bonjour', 'bonsoir', 'hello', 'hi', 'coucou',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
  'me', 'moi', 'te', 'toi', 'lui', 'leur', 'leurs', 'eux', 'se', 'soi',
  'suis', 'es', 'sommes', 'sont', 'etes', 'êtes',
  "c'est", "c’est", 'cest', 'c', 'est', 'au', 'sur', 'pour', 'avec', 'sans',
  'oui', 'non', 'ok', "d'accord", "d’accord", 'daccord', 'd',
  'voilà', 'donc', 'alors', 'dans', 'aussi', 'aux', 'du', 'de', 'et', 'ou',
  // Darija
  'salam', 'sbah', 'rakom', 'rqm', 'tilifoun', 'numirou',
  'wahed', 'kayn', 'kayna', 'bghit',
  // AR (rares en latin mais parfois translit)
  'rakami', 'hatifi',
]);

/**
 * Heuristique : un token est un prénom candidat plausible si :
 *  - il fait 2-30 caractères,
 *  - aucun de ses sous-tokens (séparés par `-` / apostrophe) n'est un
 *    stopword (ex. "appellez-moi" → split → ["appellez", "moi"] → tous
 *    deux des stopwords → rejeté),
 *  - il n'est pas constitué uniquement de 1-2 lettres ASCII.
 */
function isPlausibleFirstName(raw: string): boolean {
  if (raw.length < 2 || raw.length > 30) return false;
  // Filtre les mots qui ressemblent à du bruit ASCII pur ("xx", "ab").
  if (/^[a-z]{1,2}$/i.test(raw)) return false;
  const lc = raw.toLowerCase();
  if (FIRST_NAME_STOPWORDS.has(lc)) return false;
  // Split sur `-` / `'` / `’` : si TOUS les sous-tokens sont stopwords,
  // c'est un mot composé bruit ("appellez-moi"). Si AU MOINS un est non-
  // stopword, le mot est un candidat valide ("Marie-Claire").
  const sub = lc.split(/[-'’]/).filter((s) => s.length > 0);
  if (sub.length > 1 && sub.every((s) => FIRST_NAME_STOPWORDS.has(s))) {
    return false;
  }
  return true;
}

/**
 * Extrait un prénom candidat depuis un segment texte (avant OU après le
 * numéro). On parcourt tous les tokens alphabétiques du segment, on
 * écarte ceux qui ressemblent à du bruit (stopwords / mots collés), et
 * on renvoie le PLUS PROCHE du numéro :
 *  - pour `before` (texte avant le numéro), on lit en sens inverse et
 *    on prend le dernier token plausible — celui collé au numéro.
 *  - pour `after` (texte après le numéro), on lit en sens normal et on
 *    prend le premier token plausible — celui collé au numéro.
 *
 * Ne PAS utiliser pour de la validation forte — l'extraction sert
 * uniquement à pré-remplir / suggérer le prénom du lead, et un fallback
 * "Visiteur" couvre les échecs.
 */
export function extractFirstName(
  textBeforePhone: string,
  direction: 'before' | 'after' = 'before',
): string | null {
  if (!textBeforePhone || textBeforePhone.trim().length === 0) return null;

  const tokens: string[] = [];
  let match: RegExpExecArray | null;
  // Reset lastIndex au cas où une exécution précédente l'aurait laissé.
  FIRST_NAME_TOKEN.lastIndex = 0;
  while ((match = FIRST_NAME_TOKEN.exec(textBeforePhone)) !== null) {
    tokens.push(match[1]!);
  }

  if (tokens.length === 0) return null;

  // Stratégie 1 : selon la direction, on cherche le token le plus proche
  // du numéro qui passe le filtre `isPlausibleFirstName`.
  const ordered = direction === 'before' ? [...tokens].reverse() : tokens;
  for (const tok of ordered) {
    if (isPlausibleFirstName(tok)) {
      return capitalize(tok);
    }
  }

  // Stratégie 2 : dernier filet — le token le plus proche du numéro,
  // s'il n'est pas dans la stoplist.
  const fallback = direction === 'before' ? tokens[tokens.length - 1]! : tokens[0]!;
  if (!FIRST_NAME_STOPWORDS.has(fallback.toLowerCase())) {
    return capitalize(fallback);
  }

  return null;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s[0]!.toLocaleUpperCase() + s.slice(1).toLocaleLowerCase();
}

/**
 * Détecte le PREMIER numéro de téléphone valide dans le texte.
 *
 * Étapes :
 *  1. Recherche tous les "candidats" via `PHONE_CANDIDATE_PATTERN`.
 *  2. Pour chaque candidat, tente `tryParsePhone(raw, hint)` avec
 *     l'indice du pays prioritaire (MA par défaut).
 *  3. Le PREMIER candidat qui parse avec succès gagne — ainsi on évite
 *     que des dates ou des codes promo bruyants après le numéro
 *     "absorbent" le bon match.
 *  4. Calcule la confiance :
 *       - `high`  = numéro parsé + format E.164 ou préfixe MA mobile
 *                   ou international `+`/`00` explicite.
 *       - `medium`= numéro parsé mais sans préfixe explicite (ex. "0651...").
 *       - `low`   = candidat trouvé mais aucun parsing réussi.
 *       - `none`  = aucun candidat numérique plausible.
 *  5. Extrait `firstName` depuis le segment qui précède le match.
 */
export function detectInlineContact(
  text: string,
  hint: CountryCode = 'MA',
): InlineContactDetection {
  if (!text || text.trim().length === 0) {
    return {
      phoneE164: null,
      phoneRaw: null,
      phoneMeta: null,
      firstName: null,
      confidence: 'none',
      reason: 'empty-text',
    };
  }

  // Reset lastIndex sur le RegExp avec `g` flag.
  PHONE_CANDIDATE_PATTERN.lastIndex = 0;
  const candidates: { raw: string; index: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = PHONE_CANDIDATE_PATTERN.exec(text)) !== null) {
    candidates.push({ raw: match[0]!, index: match.index });
    // Sécurité : pas plus de 8 candidats — sinon c'est probablement du
    // bruit (un dump de chiffres) et on accepte le premier qui parse.
    if (candidates.length >= 8) break;
  }

  if (candidates.length === 0) {
    return {
      phoneE164: null,
      phoneRaw: null,
      phoneMeta: null,
      firstName: null,
      confidence: 'none',
      reason: 'no-candidate',
    };
  }

  for (const cand of candidates) {
    const parsed = tryParsePhone(cand.raw, hint);
    if (parsed) {
      const before = text.slice(0, cand.index);
      // Le prénom peut être AVANT le numéro ("Hamid 0651...") ou APRÈS
      // ("0651... Hamid"). On essaie d'abord avant — c'est l'ordre le
      // plus naturel pour une présentation polie. Si rien n'est trouvé,
      // on regarde après. Cas réel observé : "0751592310 Hamid".
      let firstName = extractFirstName(before, 'before');
      if (!firstName) {
        const after = text.slice(cand.index + cand.raw.length);
        firstName = extractFirstName(after, 'after');
      }
      const explicit = /^\s*(?:\+|00)/.test(cand.raw);
      // Confiance : préfixe international explicite OU mobile reconnu →
      // high. Sinon medium (un format saisi à la française local).
      let confidence: InlineContactDetection['confidence'];
      if (explicit) confidence = 'high';
      else if (parsed.type === 'mobile') confidence = 'high';
      else confidence = 'medium';
      return {
        phoneE164: parsed.e164,
        phoneRaw: cand.raw.trim(),
        phoneMeta: parsed,
        firstName,
        confidence,
        reason: explicit ? 'explicit-international' : `parsed-${parsed.country}`,
      };
    }
  }

  // Au moins un candidat numérique mais aucun parse OK → on remonte un
  // verdict "low" pour permettre au caller de logger / reporter sans
  // créer de lead.
  return {
    phoneE164: null,
    phoneRaw: candidates[0]!.raw.trim(),
    phoneMeta: null,
    firstName: null,
    confidence: 'low',
    reason: 'candidates-but-no-parse',
  };
}

/**
 * Variante "boolean" optimisée pour l'usage rapide dans `lead-decision`.
 * Sans allocation de meta — utile dans le hot path.
 */
export function looksLikeInlineContact(text: string): boolean {
  if (!text) return false;
  PHONE_CANDIDATE_PATTERN.lastIndex = 0;
  return PHONE_CANDIDATE_PATTERN.test(text);
}

export const phoneDetect = { detectInlineContact, extractFirstName, looksLikeInlineContact };
