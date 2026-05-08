/**
 * CHA-207 / CHA-225 / CHA-230 — Décision : faut-il OFFRIR le formulaire
 * de capture lead ?
 *
 * Règles dérivées de `19-lead-capture-form.md §4.1` + `20-langchain-…md §2.6` :
 *  - Au plus UN formulaire par session (anti-spam UX).
 *  - Au moins 2 messages assistant échangés (sauf raisons fortes).
 *  - 9 raisons métier qui peuvent l'enclencher (ordre de priorité) :
 *      0. inline-contact      — numéro de téléphone détecté en clair
 *      1. explicit-request    — l'utilisateur demande un humain
 *      1bis. purchase-intent  — intention d'achat explicite (1er tour)
 *      8. negotiation         — marchandage / demande de rabais (CHA-230)
 *      9. wholesaler          — gros volume / grossiste / pro (CHA-230)
 *      2. b2b                 — revente / pro (générique)
 *      3. frustration         — émotion négative répétée
 *      4. out-of-knowledge    — l'IA admet ne pas savoir
 *      5. objection-repeat    — même objection 2× sans progrès
 *      6. long-no-progress    — ≥ 5 tours sans intent commercial
 *      7. after-hours         — hors horaires d'ouverture (lun–sam 9h–17h)
 *
 * Pourquoi `negotiation` et `wholesaler` AVANT `b2b` :
 *  - `negotiation` est une décision *commerciale* (politique de prix) qui
 *    ne doit JAMAIS être prise par l'IA. On escalade dès le 1er tour.
 *  - `wholesaler` est un cas de pricing volume — hors-périmètre IA. On
 *    escalade dès le 1er tour pour confier au commercial.
 *
 * Cette décision NE persiste pas le lead — elle ne fait que produire un
 * verdict que l'orchestrateur transforme en SSE `lead-form-offer`.
 *
 * cf. docs/chat-assistant/19-lead-capture-form.md §4
 *     docs/chat-assistant/20-langchain-robustness-plan.md §2.6
 */

import type { ChatIntent } from './intent';
import type { ChatMessageRow } from '../db/schema';
import { isAfterHoursMA } from './intent';

export type LeadFormReason =
  | 'explicit-request'
  | 'out-of-knowledge'
  | 'objection-repeat'
  | 'long-no-progress'
  | 'frustration'
  | 'after-hours'
  | 'b2b'
  // CHA-225 — Intent d'achat explicite : on déclenche dès le 1er tour.
  | 'purchase-intent'
  // CHA-225 — L'utilisateur a écrit son numéro dans le chat plutôt que
  // dans le formulaire ; on présente le widget pour capturer proprement
  // (consent + validation) au lieu de le perdre.
  | 'inline-contact'
  // CHA-230 — Marchandage actif (rabais/réduction). Escalade humaine
  // immédiate : politique commerciale hors-périmètre IA.
  | 'negotiation'
  // CHA-230 — Demande de gros volume (grossiste, distributeur, institut).
  // Escalade commerciale immédiate : pricing volume hors-périmètre IA.
  | 'wholesaler'
  | 'manual';

export type LeadFormCopyKey =
  | 'explicit-request'
  | 'out-of-knowledge'
  | 'objection'
  | 'after-hours'
  | 'b2b'
  | 'purchase-intent'
  | 'inline-contact'
  // CHA-230 — copy spécifique à la négociation (pivot humain calme).
  | 'negotiation'
  // CHA-230 — copy spécifique au volume pro (escalade commerciale).
  | 'wholesaler'
  | 'manual';

export interface LeadDecisionInput {
  /** Tous les messages user/assistant (chronologique). */
  history: Pick<ChatMessageRow, 'id' | 'role' | 'content' | 'createdAt'>[];
  /** Intent du dernier message user. */
  currentIntent: ChatIntent;
  /** Réponse assistant qui vient d'être générée. */
  assistantReply: string;
  /** A déjà une offre ? (provenance : `eventRepo` côté caller) */
  alreadyOffered: boolean;
  /** Toggle runtime admin (kill switch). */
  enabled: boolean;
  /** Date courante injectable pour les tests. */
  now?: Date;
}

export interface LeadDecisionResult {
  shouldOffer: boolean;
  reason?: LeadFormReason;
  copyKey?: LeadFormCopyKey;
  /** Pour les logs. */
  debug?: Record<string, unknown>;
}

/**
 * CHA-225 — Détecte un numéro de téléphone "vraisemblable" dans un
 * message visiteur. On accepte 3 formes mutuellement exclusives :
 *   1. Préfixe + (international, ≥ 9 chiffres après le +).
 *   2. Format marocain mobile : 0[5-7] suivi de 8 chiffres (séparateurs
 *      espace/tiret/point tolérés).
 *   3. Séquence brute ≥ 10 chiffres consécutifs (séparateurs tolérés)
 *      pour ne rater aucun format international saisi sans +.
 * Volontairement strict pour éviter les faux positifs sur des dates ou
 * des prix (ex. "290 MAD" → ne matche pas).
 */
const INLINE_PHONE_PATTERN =
  /(?:\+(?:\d[\s\-.]*){8,}\d)|(?:\b0\s*[5-7](?:[\s\-.]*\d){8})|(?:(?:\d[\s\-.]*){9,}\d)/;
function looksLikePhone(text: string): boolean {
  if (!text) return false;
  return INLINE_PHONE_PATTERN.test(text);
}

/** Marqueurs de "je ne sais pas" dans la réponse assistant. */
const OUT_OF_KNOWLEDGE_PATTERNS = [
  /je ne (sais|peux) pas (vous )?répondre/i,
  /je n['’]ai pas (cette )?information/i,
  /je ne dispose pas/i,
  /je n['’]ai pas accès/i,
  /pas (assez )?d['’]informations? pour/i,
  /^(désolé|hélas)/i,
  /\bma 3andich\b/i,
  /\bma n3rfsh\b/i,
  /(لا أعرف|لا أملك|عذرا)/,
];

function isOutOfKnowledge(reply: string): boolean {
  return OUT_OF_KNOWLEDGE_PATTERNS.some((p) => p.test(reply));
}

/**
 * CHA-230 v5 — Filet de sécurité « LLM annonce un formulaire ».
 *
 * Bugs récurrents en prod : le LLM répond une formule type « le petit
 * formulaire ci-dessous prend trente secondes » MAIS la décision lead-form
 * dit shouldOffer=false (intent regex ne matche pas, score < shortcut,
 * etc.). Le visiteur lit une promesse de formulaire qui n'apparaît jamais.
 *
 * Politique : si l'assistant ANNONCE explicitement un formulaire, on
 * force l'offre quoi qu'en dise la décision principale. C'est mieux
 * d'afficher un faux positif d'offre qu'un visiteur bloqué — le
 * commercial humain valide en aval.
 *
 * Patterns dérivés des copies dans `instruction-defaults.ts` + variantes
 * observées en prod.
 */
export const PROMISED_FORM_PATTERNS: RegExp[] = [
  /formulaire\s+(juste\s+)?(ci[-\s]?dessous|en\s+dessous|qui\s+s['’]?affiche|sous\s+(ce|mon)\s+message)/i,
  /petit\s+formulaire/i,
  /le\s+formulaire\s+ci[-\s]?dessous/i,
  /trente\s+secondes/i,
  /\bprénom\s+et\s+(votre\s+)?numéro\b/i,
  /\bvalidez\s+(vos\s+)?coordonnées\b/i,
  /\blaissez[-\s]moi\s+(votre\s+)?prénom\b/i,
  /\bje\s+note\s+(votre\s+)?prénom\b/i,
  // CHA-230 v6 — Le LLM peut paraphraser sans le mot « formulaire ».
  // Cas prod 2026-05-08 : « La suite se règle juste en dessous » →
  // l'utilisateur attend un widget qui n'arrive pas. Tous ces motifs
  // sous-entendent « regardez sous mon message » dans un contexte chat
  // où il n'y a JAMAIS rien d'autre que le form sous le message.
  /\bla\s+suite\s+(se\s+|s['’])?(règle|passe|joue|fait|enregistre|note|continue|finalise)\b/i,
  /\b(juste|directement)\s+(en|au|ci[-\s]?)[-\s]?dessous\b/i,
  /\b(en|au|ci[-\s]?)[-\s]?dessous\s+(pour|vous\s+(pourrez|pouvez|allez)|permet|nous)\b/i,
  /\b(on|nous|je)\s+(enregistre|note|valide|finalise|continue|prend)\s+.{0,30}(en|ci[-\s]?|au)[-\s]?dessous\b/i,
  /\b(remplissez|complétez|laissez|donnez|écrivez|tapez)\s+.{0,30}(en|ci[-\s]?|au|juste)[-\s]?dessous\b/i,
];

/** True si la réponse assistant annonce un formulaire explicitement. */
export function assistantPromisedForm(reply: string): boolean {
  if (!reply) return false;
  return PROMISED_FORM_PATTERNS.some((p) => p.test(reply));
}

/** Compte les messages user dans l'historique. */
function countUserMessages(history: LeadDecisionInput['history']): number {
  return history.filter((m) => m.role === 'user').length;
}

/** Dernière trace assistant (utilisée pour la décision out-of-knowledge). */
function lastAssistantContent(history: LeadDecisionInput['history']): string {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]!.role === 'assistant') return history[i]!.content;
  }
  return '';
}

/** Détecte une répétition d'objection (même intent ≥ 2× consécutivement). */
function detectsObjectionRepeat(
  history: LeadDecisionInput['history'],
  currentIntent: ChatIntent,
): boolean {
  if (currentIntent !== 'objection-price' && currentIntent !== 'objection-doubt') {
    return false;
  }
  const userMsgs = history.filter((m) => m.role === 'user');
  if (userMsgs.length < 2) return false;
  // On regarde si les 2 derniers messages user ont l'air objection (par mots-clés).
  const isObjection = (s: string): boolean =>
    /trop cher|c['’]est cher|ghali|غالي|pas convaincu|j['’]hésite|j hesite|ça marche pas|ca marche pas|arnaque/i.test(
      s,
    );
  return userMsgs.slice(-2).every((m) => isObjection(m.content));
}

/** Pas de progrès commercial = pas de pricing/order/routine après ≥ 5 tours. */
function detectsLongNoProgress(
  history: LeadDecisionInput['history'],
  currentIntent: ChatIntent,
): boolean {
  const userCount = countUserMessages(history);
  if (userCount < 5) return false;
  const STAGNANT_INTENTS: ChatIntent[] = [
    'misc',
    'greeting',
    'social-proof',
    'comparison',
    'objection-doubt',
  ];
  return STAGNANT_INTENTS.includes(currentIntent);
}

/**
 * Décide. Première raison qui matche gagne (priorité de la liste plus haut).
 * Ne déclenche JAMAIS si `alreadyOffered` ou `!enabled`.
 */
export function shouldOfferLeadForm(input: LeadDecisionInput): LeadDecisionResult {
  if (!input.enabled) {
    return { shouldOffer: false, debug: { reason: 'disabled' } };
  }
  if (input.alreadyOffered) {
    return { shouldOffer: false, debug: { reason: 'already-offered' } };
  }

  const now = input.now ?? new Date();
  const userCount = countUserMessages(input.history);
  const lastUserMsg = (() => {
    for (let i = input.history.length - 1; i >= 0; i -= 1) {
      if (input.history[i]!.role === 'user') return input.history[i]!.content;
    }
    return '';
  })();

  // 0. Numéro de téléphone détecté dans le dernier message visiteur.
  //    L'utilisateur tente de laisser ses coordonnées en clair → on
  //    pousse le formulaire pour capter proprement (consent + validation).
  //    Priorité maximale : on ne veut surtout pas perdre le lead.
  if (looksLikePhone(lastUserMsg)) {
    return {
      shouldOffer: true,
      reason: 'inline-contact',
      copyKey: 'inline-contact',
      debug: { userCount, trigger: 'inline-phone' },
    };
  }

  // 1. Demande explicite (callback-request) — déclenche dès le 1er tour
  if (input.currentIntent === 'callback-request') {
    return {
      shouldOffer: true,
      reason: 'explicit-request',
      copyKey: 'explicit-request',
      debug: { userCount },
    };
  }

  // 1bis. Intent d'achat explicite — déclenche dès le 1er tour.
  //       "je veux commander", "tu as un formulaire ?", etc.
  if (input.currentIntent === 'purchase-intent') {
    return {
      shouldOffer: true,
      reason: 'purchase-intent',
      copyKey: 'purchase-intent',
      debug: { userCount },
    };
  }

  // CHA-230 — Rule 8. Négociation explicite (rabais, réduction, marchandage).
  //   Politique commerciale : l'IA NE NÉGOCIE PAS. On escalade dès le
  //   1er tour vers un humain qui décide la remise/le geste commercial.
  //   Sinon, l'IA invente une politique de prix → risque réputationnel
  //   et financier (l'agent humain devra honorer ou contredire).
  if (input.currentIntent === 'negotiation') {
    return {
      shouldOffer: true,
      reason: 'negotiation',
      copyKey: 'negotiation',
      debug: { userCount },
    };
  }

  // CHA-230 — Rule 9. Fournisseur / grossiste / volume pro.
  //   Pricing volume = hors-périmètre IA (dépend du stock, des marges,
  //   des conditions logistiques). On escalade dès le 1er tour vers le
  //   commercial qui propose une offre adaptée.
  if (input.currentIntent === 'wholesaler') {
    return {
      shouldOffer: true,
      reason: 'wholesaler',
      copyKey: 'wholesaler',
      debug: { userCount },
    };
  }

  // À partir d'ici, on attend qu'au moins 2 messages user aient été échangés
  // pour laisser à l'IA une chance de répondre.
  if (userCount < 2) {
    return { shouldOffer: false, debug: { reason: 'too-early', userCount } };
  }

  // 2. B2B
  if (input.currentIntent === 'b2b') {
    return {
      shouldOffer: true,
      reason: 'b2b',
      copyKey: 'b2b',
      debug: { userCount },
    };
  }

  // 3. Frustration
  if (input.currentIntent === 'frustration') {
    return {
      shouldOffer: true,
      reason: 'frustration',
      copyKey: 'manual',
      debug: { userCount },
    };
  }

  // 4. Out-of-knowledge — on regarde la réponse assistant fraîche
  if (isOutOfKnowledge(input.assistantReply) || isOutOfKnowledge(lastAssistantContent(input.history))) {
    return {
      shouldOffer: true,
      reason: 'out-of-knowledge',
      copyKey: 'out-of-knowledge',
      debug: { userCount },
    };
  }

  // 5. Objection répétée
  if (detectsObjectionRepeat(input.history, input.currentIntent)) {
    return {
      shouldOffer: true,
      reason: 'objection-repeat',
      copyKey: 'objection',
      debug: { userCount, currentIntent: input.currentIntent },
    };
  }

  // 6. Long sans progrès
  if (detectsLongNoProgress(input.history, input.currentIntent)) {
    return {
      shouldOffer: true,
      reason: 'long-no-progress',
      copyKey: 'manual',
      debug: { userCount, currentIntent: input.currentIntent },
    };
  }

  // 7. After-hours — déclenchement seulement si l'utilisateur semble engagé
  // (≥ 3 user messages) ET hors horaires d'ouverture.
  if (userCount >= 3 && isAfterHoursMA(now)) {
    return {
      shouldOffer: true,
      reason: 'after-hours',
      copyKey: 'after-hours',
      debug: { userCount, after: 'after-hours' },
    };
  }

  return { shouldOffer: false, debug: { userCount, currentIntent: input.currentIntent } };
}

export const leadDecision = { shouldOfferLeadForm };
