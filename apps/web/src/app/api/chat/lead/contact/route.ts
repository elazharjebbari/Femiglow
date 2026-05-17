/**
 * CHA-205 — Route POST /api/chat/lead/contact.
 *
 * Capture inline du formulaire prénom + téléphone in-chat. Pipeline :
 *   1. Feature-flag chat actif.
 *   2. Toggle runtime `lead_form_enabled` actif.
 *   3. Validation Zod du payload (`chatLeadContactInput`).
 *   4. Anti-bot : honeypot vide.
 *   5. Rate-limit IP + session (5 lead-submit / min / IP, 1 / session).
 *   6. Session existante.
 *   7. Normalisation téléphone via `parsePhone` (E.164 + type).
 *   8. Récup snapshot 6 derniers messages assistant/user.
 *   9. Insertion `chat_lead`.
 *  10. Append événement `chat_lead_form_submit`.
 *  11. Dispatch webhook (best-effort, non bloquant pour la réponse client).
 *  12. Renvoi `{ ok, leadId, outcomeMessage }`.
 *
 * cf. docs/chat-assistant/19-lead-capture-form.md §6.2
 */
import { type NextRequest, NextResponse } from 'next/server';

import {
  ChatDisabledError,
  assertChatEnabled,
} from '@/lib/chat/feature-flag';
import { chatLeadContactInput } from '@/lib/chat/contracts';
import { eventRepo } from '@/lib/chat/repos/event';
import { leadRepo } from '@/lib/chat/repos/lead';
import { computeIdentityHash } from '@/lib/chat/repos/identity-hash';
import { messageRepo } from '@/lib/chat/repos/message';
import { sessionRepo } from '@/lib/chat/repos/session';
import { rateLimit } from '@/lib/chat/services/rate-limit';
import { detectIntent } from '@/lib/chat/services/intent';
import { dispatchLeadWebhook } from '@/lib/chat/services/lead-webhook';
import { notifyHotLead } from '@/lib/chat/services/lead-alerts';
import { getRuntimeBool } from '@/lib/chat/runtime-setting';
import { env } from '@/lib/env';
import { parsePhone, PhoneParseError } from '@/lib/phone';
import { logger } from '@/lib/logging/logger';
import { sendTransactional } from '@/lib/mail/send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SNAPSHOT_SIZE = 6;
const OUTCOME_MESSAGES: Record<string, string> = {
  fr: "Merci ! Une conseillère vous appellera très vite. À tout de suite ✨",
  ar: 'شكراً لك! ستتصل بك مستشارتنا قريباً جداً. إلى اللقاء ✨',
  'ar-MA': 'Choukrane ! Wa7da men l-mostachirat ghadi t3yt lik daba. Bzzaaaf bsl7a ✨',
};

export async function POST(req: NextRequest): Promise<Response> {
  try {
    assertChatEnabled();
  } catch (err) {
    if (err instanceof ChatDisabledError) {
      return new NextResponse('Not Found', { status: 404 });
    }
    throw err;
  }

  const enabled = await getRuntimeBool('lead_form_enabled', true);
  if (!enabled) {
    return NextResponse.json({ error: 'lead-form-disabled' }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const parsed = chatLeadContactInput.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid-input', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  // Honeypot : champ doit être absent ou vide. Si rempli, c'est un bot.
  if (parsed.data.honeypot && parsed.data.honeypot.length > 0) {
    logger.warn('chat.lead.honeypot_triggered', { sessionId: parsed.data.sessionId });
    // On répond OK pour ne pas signaler au bot qu'il est détecté.
    return NextResponse.json({ ok: true, leadId: 'cl_dummy', outcomeMessage: '' });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  // Rate-limit IP (5/min) + session (1 lead/session via DB unique check).
  try {
    const ipGate = await rateLimit.consume('ip', `lead:${ip}`);
    if (!ipGate.allowed) {
      return NextResponse.json(
        { error: 'rate-limited', scope: 'ip' },
        { status: 429 },
      );
    }
  } catch (err) {
    logger.warn('chat.lead.rate_limit_skipped', { error: (err as Error).message });
  }

  const session = await sessionRepo.getById(parsed.data.sessionId);
  if (!session) {
    return NextResponse.json({ error: 'session-not-found' }, { status: 404 });
  }

  // Normalisation téléphone — invalid → 422 avec code lisible côté UI.
  let phone;
  try {
    phone = parsePhone(parsed.data.phoneRaw, parsed.data.countryHint);
  } catch (err) {
    const code = err instanceof PhoneParseError ? err.code : 'invalid-phone';
    return NextResponse.json({ error: 'invalid-phone', code }, { status: 422 });
  }

  // Idempotence : 1 lead par (session, identité) — sauf cas d'upgrade (CHA-225) :
  // si le lead existant est un fallback `inline-contact` (auto-créé
  // parce que le visiteur a tapé son numéro dans le chat), on AUTORISE
  // le formulaire à le formaliser plutôt que de renvoyer 409. Le
  // formulaire apporte le consent RGPD propre + la validation du
  // numéro, donc on n'a pas envie de le bloquer.
  //
  // CHA-240 — On vérifie par identité (phone+name hash) et non par
  // session seule : un visiteur qui donne un numéro différent dans la
  // même session peut légitimement créer un nouveau lead.
  const identityHash = computeIdentityHash(phone.e164, parsed.data.firstName.trim());
  const existing = await leadRepo.findBySessionAndIdentity(session.id, identityHash);
  if (existing && existing.triggerReason !== 'inline-contact') {
    return NextResponse.json({ error: 'lead-already-captured' }, { status: 409 });
  }

  // Snapshot des derniers messages — utile pour l'agent humain.
  const recent = await messageRepo.recentForMemory(session.id, SNAPSHOT_SIZE);
  const snapshot = recent.map((m) => ({
    role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
    content: m.content.slice(0, 400),
    at: m.createdAt.toISOString(),
  }));

  // Intent au moment de la capture (best effort sur le dernier message user).
  const lastUserMsg = recent.filter((m) => m.role === 'user').at(-1);
  const intentAtCapture = lastUserMsg ? detectIntent(lastUserMsg.content) : null;

  let lead: NonNullable<Awaited<ReturnType<typeof leadRepo.create>>>;
  if (existing && existing.triggerReason === 'inline-contact') {
    // Upgrade : le visiteur a fini par soumettre le formulaire après
    // qu'on ait auto-créé un fallback. On formalise le lead.
    const upgraded = await leadRepo.upgrade(existing.id, {
      firstName: parsed.data.firstName.trim(),
      phoneE164: phone.e164,
      phoneRaw: parsed.data.phoneRaw,
      consentVersion: parsed.data.consentVersion || env.CHAT_LEAD_CONSENT_VERSION,
      triggerReason: parsed.data.triggerReason,
      triggeringMessageId: parsed.data.triggeringMessageId ?? null,
      note: parsed.data.note?.trim() || null,
      language: parsed.data.language,
      intentAtCapture,
      snapshotMessages: snapshot,
    });
    if (!upgraded) {
      return NextResponse.json({ error: 'lead-already-captured' }, { status: 409 });
    }
    lead = upgraded;
    await eventRepo.append(session.id, 'chat_lead_form_upgrade', {
      leadId: lead.id,
      previousReason: 'inline-contact',
      newReason: parsed.data.triggerReason,
    });
  } else {
    lead = await leadRepo.create({
      sessionId: session.id,
      triggeringMessageId: parsed.data.triggeringMessageId ?? null,
      triggerReason: parsed.data.triggerReason,
      firstName: parsed.data.firstName.trim(),
      phoneE164: phone.e164,
      phoneRaw: parsed.data.phoneRaw,
      note: parsed.data.note?.trim() || null,
      consentVersion: parsed.data.consentVersion || env.CHAT_LEAD_CONSENT_VERSION,
      consentAt: new Date(),
      visitorId: session.visitorId,
      fingerprintHash: session.fingerprintHash ?? null,
      page: session.page ?? null,
      referrer: session.referrer ?? null,
      utm: session.utm ?? null,
      language: parsed.data.language,
      intentAtCapture,
      snapshotMessages: snapshot,
    });
  }

  await eventRepo.append(session.id, 'chat_lead_form_submit', {
    leadId: lead.id,
    triggerReason: parsed.data.triggerReason,
    intentAtCapture,
    phoneCountry: phone.country,
    phoneType: phone.type,
  });

  // CHAT-066 — Alerte Slack pour lead "chaud" (purchase-intent,
  // callback-request, explicit-request, inline-contact). Non bloquant :
  // toute erreur est swallowée par `notifyHotLead`.
  void notifyHotLead(lead, { adminBaseUrl: env.NEXT_PUBLIC_SITE_URL });

  // Webhook (non bloquant côté client : on lance et on attend en
  // arrière-plan, mais on capture le résultat pour la réponse afin que
  // l'admin voie le statut. Le timeout est de 8s donc l'UX reste fluide).
  let webhookStatus: 'sent' | 'failed' | 'disabled' = 'disabled';
  try {
    const r = await dispatchLeadWebhook(lead);
    webhookStatus = r.status;
  } catch (err) {
    logger.error('chat.lead.webhook_unhandled', {
      leadId: lead.id,
      error: (err as Error).message,
    });
  }

  // M1.B.2 — Notification interne : envoie un mail à info@ pour que
  // l'équipe puisse recontacter dans la journée. Fire-and-forget.
  const outcomeContext = snapshot
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n')
    .slice(0, 1900);
  void sendTransactional({
    template: 'lead-notification',
    to: { email: env.MAIL_REPLY_TO ?? 'info@femiglow-maroc.com' },
    payload: {
      leadName: lead.firstName,
      leadPhone: lead.phoneE164,
      leadEmail: null,
      intent: intentAtCapture ?? 'unknown',
      outcomeContext: outcomeContext || '(pas de contexte)',
      adminUrl: `${env.NEXT_PUBLIC_SITE_URL}/admin/leads/${lead.id}`,
    },
    idempotencyKey: `lead-notif:${lead.id}`,
    source: 'api.chat.lead.contact',
  }).catch((err: unknown) => {
    logger.error('mail.lead_notification.dispatch_error', {
      leadId: lead.id,
      error: String(err),
    });
  });

  return NextResponse.json({
    ok: true,
    leadId: lead.id,
    outcomeMessage: OUTCOME_MESSAGES[parsed.data.language] ?? OUTCOME_MESSAGES.fr,
    webhookStatus,
  });
}
