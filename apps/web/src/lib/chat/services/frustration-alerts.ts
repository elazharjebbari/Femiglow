/**
 * CHAT-066 — Escalade frustration vers l'équipe Care.
 *
 * Pourquoi
 * ────────
 * Quand un visiteur exprime de la frustration ("trop cher !", "ça marche pas",
 * "arnaque", "menfou", …), l'IA seule ne suffit plus : il faut qu'un humain
 * Care reprenne la main rapidement pour éviter le churn et préserver la
 * marque. On émet donc :
 *
 *  1. un événement `frustration_detected` dans `chat_conversation_event`
 *     (source KPI : taux de frustration / session, MTTR Care…),
 *  2. une alerte Slack severity=warning vers #chat-care (best-effort,
 *     non bloquant pour le stream LLM).
 *
 * Idempotence
 * ───────────
 * On ne veut PAS spammer Care si l'utilisateur enchaîne 5 messages frustrés.
 * `notifyFrustrationSpike` vérifie les events de la session : si un
 * `frustration_detected` a déjà été émis dans la fenêtre courante, on
 * skip silencieusement.
 *
 * Critère de déclenchement
 * ────────────────────────
 *  - L'intent du dernier message user est `frustration`, ET
 *  - au moins UN autre message user récent (≤ 3 messages user) avait déjà
 *    un intent `frustration` (= "spike" = pas un one-shot accidentel).
 *
 * RGPD : on n'envoie aucune PII à Slack — juste sessionId + lien admin.
 *
 * cf. docs/dossier-chat-v2/12-tests/ultimate-pipeline-test.md §Ch11
 */
import { logger } from '@/lib/logging/logger';

import type { ChatIntent } from './intent';
import { detectIntent } from './intent';
import { eventRepo } from '../repos/event';
import type { ChatMessageRow } from '../db/schema';
import { sendChatAlert } from './slack-notify';

export interface FrustrationSpikeInput {
  sessionId: string;
  /** Historique chronologique des messages de la session. */
  history: Pick<ChatMessageRow, 'role' | 'content'>[];
  /** Intent du dernier message user (déjà détecté côté orchestrator). */
  currentIntent: ChatIntent;
  /** Base URL admin (pour construire un lien vers la conversation). */
  adminBaseUrl?: string;
  /** Idempotence : a-t-on déjà émis pour cette session ? */
  alreadyEmitted?: boolean;
}

export interface FrustrationSpikeResult {
  /** True si on a appended event + tenté Slack. */
  fired: boolean;
  /** Raison pour les logs admin. */
  reason: 'fired' | 'not-frustrated' | 'one-shot' | 'already-emitted';
}

/** Combien de messages user récents on regarde pour détecter le "spike". */
const SPIKE_WINDOW_USER_MESSAGES = 3;

/**
 * Décide ET déclenche l'escalade frustration. Non bloquant.
 *
 * @returns un résumé du résultat (utile pour les tests + KPI debug).
 */
export async function notifyFrustrationSpike(
  input: FrustrationSpikeInput,
): Promise<FrustrationSpikeResult> {
  if (input.currentIntent !== 'frustration') {
    return { fired: false, reason: 'not-frustrated' };
  }
  if (input.alreadyEmitted) {
    return { fired: false, reason: 'already-emitted' };
  }
  // On considère les messages user, en excluant le dernier (qui est le
  // courant). S'il y a au moins UN frustration dans la fenêtre récente,
  // c'est un spike.
  const previousUserMessages = input.history
    .filter((m) => m.role === 'user')
    .slice(0, -1) // exclut le message courant
    .slice(-SPIKE_WINDOW_USER_MESSAGES);
  const hadRecentFrustration = previousUserMessages.some(
    (m) => detectIntent(m.content) === 'frustration',
  );
  if (!hadRecentFrustration) {
    return { fired: false, reason: 'one-shot' };
  }

  // Append KPI event (source de vérité dashboard care).
  try {
    await eventRepo.append(input.sessionId, 'frustration_detected', {
      window: SPIKE_WINDOW_USER_MESSAGES,
    });
  } catch (err) {
    logger.warn('chat.frustration.event_append_failed', {
      sessionId: input.sessionId,
      reason: (err as Error).message,
    });
  }

  // Alerte Slack — best-effort, on ne bloque pas le pipeline si Slack
  // est down. RGPD : sessionId tronqué côté Slack-side via le copy.
  const adminLink = input.adminBaseUrl
    ? `${input.adminBaseUrl.replace(/\/$/, '')}/admin/chat/conversations/${input.sessionId}`
    : null;
  try {
    await sendChatAlert({
      title: 'Frustration détectée — escalade Care',
      detail:
        "Le visiteur a exprimé de la frustration sur ≥ 2 messages. À reprendre en main rapidement.",
      severity: 'warning',
      fields: [
        { label: 'Session', value: input.sessionId },
        ...(adminLink ? [{ label: 'Conversation', value: adminLink }] : []),
      ],
    });
  } catch (err) {
    logger.warn('chat.frustration.alert_failed', {
      sessionId: input.sessionId,
      reason: (err as Error).message,
    });
  }

  return { fired: true, reason: 'fired' };
}
