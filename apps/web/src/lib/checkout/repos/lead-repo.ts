/**
 * CHA-230 — Repository chat_lead (wizard checkout).
 *
 * Sur-couche au `leadRepo` chat existant : on REUTILISE la même table
 * `chat_lead` mais avec les colonnes étendues funnel (cf. migration
 * 0016_chat_lead_funnel_extensions.sql).
 *
 * Cycle de vie wizard (4 étapes) :
 *   1. `createWizardLead`  → step 1 (Lead capture)
 *   2. `patchAddress`      → step 2 (Address)
 *   3. `patchPayment`      → step 3 (Payment)
 *   4. `markPurchased`     → finalisation order (`purchased_at`)
 *
 * `optInEmail` permet d'ajouter l'opt-in marketing après le thank-you
 * (step 4). Ne crée jamais un nouveau lead → mutation pure.
 */
import { and, eq } from 'drizzle-orm';

import { requireChatDb } from '@/lib/chat/db/client';
import {
  chatLead,
  type ChatLeadInsert,
  type ChatLeadRow,
} from '@/lib/chat/db/schema';
import { createId } from '@/lib/ids';
import { computeIdentityHash } from '@/lib/chat/repos/identity-hash';

import { normalizePhoneToE164Maroc } from '../schemas/common';

export type WizardLeadRow = ChatLeadRow;

export interface CreateWizardLeadInput {
  /** Phone Maroc 9 chiffres OU déjà E.164 (+212...). Toujours stocké normalisé. */
  phone: string;
  firstName: string;
  consentVersion: string;
  language: string;
  visitorId: string;
  sessionId: string;

  formId: string;
  formMode: NonNullable<ChatLeadRow['formMode']>;
  variantKey?: ChatLeadRow['variantKey'];
  source: NonNullable<ChatLeadRow['source']>;

  cartSnapshot?: ChatLeadRow['cartSnapshot'];

  page?: string | null;
  referrer?: string | null;
  utm?: Record<string, string> | null;
  gclid?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}

export class InvalidPhoneError extends Error {
  constructor() {
    super('Numéro de téléphone invalide (Maroc attendu).');
    this.name = 'InvalidPhoneError';
  }
}

export const wizardLeadRepo = {
  /**
   * Step 1 — crée le lead côté wizard. Le téléphone est normalisé E.164
   * AVANT insert pour garantir l'unicité applicative par numéro.
   * Si un lead existe déjà pour cette session avec la même identité
   * (phone + name), retourne le lead existant sans créer de doublon.
   * Si l'identité diffère, un nouveau lead est créé (multi-identité).
   */
  async createWizardLead(input: CreateWizardLeadInput): Promise<ChatLeadRow> {
    const phoneE164 = normalizePhoneToE164Maroc(input.phone);
    if (!phoneE164) throw new InvalidPhoneError();

    const db = requireChatDb();
    const id = createId('cl');
    const now = new Date();
    const identityHash = computeIdentityHash(phoneE164, input.firstName.trim());
    const insert: ChatLeadInsert = {
      id,
      sessionId: input.sessionId,
      visitorId: input.visitorId,
      firstName: input.firstName.trim(),
      phoneE164,
      phoneRaw: input.phone,
      consentVersion: input.consentVersion,
      consentAt: now,
      language: input.language,
      // Pas de `wizard_flow` côté enum legacy chat — on utilise
      // `purchase-intent` (le wizard est par définition un achat).
      triggerReason: 'purchase-intent',
      source: input.source,
      page: input.page ?? null,
      referrer: input.referrer ?? null,
      utm: input.utm ?? null,
      formId: input.formId,
      formMode: input.formMode,
      variantKey: input.variantKey ?? null,
      cartSnapshot: input.cartSnapshot ?? null,
      cartTotalCents: input.cartSnapshot?.totalCents ?? null,
      cartCurrency: input.cartSnapshot?.currency ?? null,
      lastTouchedStep: 'lead',
      leadCapturedAt: now,
      gclid: input.gclid ?? null,
      fbp: input.fbp ?? null,
      fbc: input.fbc ?? null,
      identityHash,
    };
    const rows = await db
      .insert(chatLead)
      .values(insert)
      .onConflictDoNothing({ target: [chatLead.sessionId, chatLead.identityHash] })
      .returning();
    if (rows.length > 0) return rows[0]!;
    // Conflict: a lead with this session+identity already exists. Fetch it.
    const existing = await db
      .select()
      .from(chatLead)
      .where(and(eq(chatLead.sessionId, input.sessionId), eq(chatLead.identityHash, identityHash)))
      .limit(1);
    return existing[0]!;
  },

  /**
   * OWBS — upsert-by-leadId (ADR-0002). Le `id` est fourni par le client
   * (`cl_…`) AVANT tout appel réseau, ce qui rend les étapes indépendantes et
   * autorise l'envoi en tâche de fond (idempotent au rejeu/désordre).
   *
   * Sémantique : INSERT … ON CONFLICT (id) DO UPDATE en **fill-forward** —
   * on rafraîchit les champs de capture mais on **préserve** la progression
   * (`leadCapturedAt`, `lastTouchedStep`, et les colonnes adresse/paiement qui
   * ne sont pas écrites ici). La cohérence `visitorId` est contrôlée en amont
   * par le service (anti-collision inter-visiteurs).
   *
   * @see docs/checkout-leads-background-2026-06-01/00-conception/decisions/ADR-0002-client-leadid-upsert.md
   */
  async upsertWizardLead(
    id: string,
    input: CreateWizardLeadInput,
  ): Promise<ChatLeadRow> {
    const phoneE164 = normalizePhoneToE164Maroc(input.phone);
    if (!phoneE164) throw new InvalidPhoneError();

    const db = requireChatDb();
    const now = new Date();
    const identityHash = computeIdentityHash(phoneE164, input.firstName.trim());
    const insert: ChatLeadInsert = {
      id,
      sessionId: input.sessionId,
      visitorId: input.visitorId,
      firstName: input.firstName.trim(),
      phoneE164,
      phoneRaw: input.phone,
      consentVersion: input.consentVersion,
      consentAt: now,
      language: input.language,
      triggerReason: 'purchase-intent',
      source: input.source,
      page: input.page ?? null,
      referrer: input.referrer ?? null,
      utm: input.utm ?? null,
      formId: input.formId,
      formMode: input.formMode,
      variantKey: input.variantKey ?? null,
      cartSnapshot: input.cartSnapshot ?? null,
      cartTotalCents: input.cartSnapshot?.totalCents ?? null,
      cartCurrency: input.cartSnapshot?.currency ?? null,
      lastTouchedStep: 'lead',
      leadCapturedAt: now,
      gclid: input.gclid ?? null,
      fbp: input.fbp ?? null,
      fbc: input.fbc ?? null,
      identityHash,
    };
    // Fill-forward : on NE met PAS à jour leadCapturedAt / lastTouchedStep /
    // colonnes adresse-paiement → la progression du lead est préservée.
    const rows = await db
      .insert(chatLead)
      .values(insert)
      .onConflictDoUpdate({
        target: chatLead.id,
        set: {
          firstName: insert.firstName,
          phoneE164,
          phoneRaw: insert.phoneRaw,
          consentVersion: insert.consentVersion,
          language: insert.language,
          source: insert.source,
          page: insert.page,
          referrer: insert.referrer,
          utm: insert.utm,
          formId: insert.formId,
          formMode: insert.formMode,
          variantKey: insert.variantKey,
          cartSnapshot: insert.cartSnapshot,
          cartTotalCents: insert.cartTotalCents,
          cartCurrency: insert.cartCurrency,
          gclid: insert.gclid,
          fbp: insert.fbp,
          fbc: insert.fbc,
          identityHash,
          updatedAt: now,
        },
      })
      .returning();
    return rows[0]!;
  },

  async getById(id: string): Promise<ChatLeadRow | null> {
    const db = requireChatDb();
    const rows = await db.select().from(chatLead).where(eq(chatLead.id, id)).limit(1);
    return rows[0] ?? null;
  },

  /**
   * Step 2 — patch adresse (city, addressLine1, …).
   *
   * Note : `shippingMode` est stocké côté `orders` à la création (pas
   * sur `chat_lead`). Ce repo persiste uniquement les coordonnées.
   */
  async patchAddress(
    id: string,
    patch: {
      city: string;
      addressLine1: string;
      addressLine2?: string | null;
      postalCode?: string | null;
      country: string;
      notes?: string | null;
    },
  ): Promise<ChatLeadRow | null> {
    const db = requireChatDb();
    const now = new Date();
    const rows = await db
      .update(chatLead)
      .set({
        shippingCity: patch.city,
        shippingAddressLine1: patch.addressLine1,
        shippingAddressLine2: patch.addressLine2 ?? null,
        shippingPostalCode: patch.postalCode ?? null,
        shippingCountry: patch.country,
        shippingNotes: patch.notes ?? null,
        lastTouchedStep: 'address',
        addressCompletedAt: now,
        updatedAt: now,
      })
      .where(eq(chatLead.id, id))
      .returning();
    return rows[0] ?? null;
  },

  /** Step 3 — patch préférence paiement. */
  async patchPayment(
    id: string,
    patch: { paymentMethod: NonNullable<ChatLeadRow['preferredPaymentMethod']> },
  ): Promise<ChatLeadRow | null> {
    const db = requireChatDb();
    const now = new Date();
    const rows = await db
      .update(chatLead)
      .set({
        preferredPaymentMethod: patch.paymentMethod,
        lastTouchedStep: 'payment',
        paymentSelectedAt: now,
        updatedAt: now,
      })
      .where(eq(chatLead.id, id))
      .returning();
    return rows[0] ?? null;
  },

  /** Marque le lead converti (purchased_at + last_touched_step=thank_you). */
  async markPurchased(id: string): Promise<ChatLeadRow | null> {
    const db = requireChatDb();
    const now = new Date();
    const rows = await db
      .update(chatLead)
      .set({
        lastTouchedStep: 'thank_you',
        purchasedAt: now,
        outcome: 'converted',
        updatedAt: now,
      })
      .where(eq(chatLead.id, id))
      .returning();
    return rows[0] ?? null;
  },

  /** Step 4 — opt-in email (après thank-you). */
  async optInEmail(
    id: string,
    patch: { email: string; emailConsent: true },
  ): Promise<ChatLeadRow | null> {
    const db = requireChatDb();
    const rows = await db
      .update(chatLead)
      .set({
        email: patch.email.trim().toLowerCase(),
        emailConsent: patch.emailConsent,
        updatedAt: new Date(),
      })
      .where(eq(chatLead.id, id))
      .returning();
    return rows[0] ?? null;
  },

  async stampStep2Webhook(id: string, at: Date = new Date()): Promise<void> {
    const db = requireChatDb();
    await db
      .update(chatLead)
      .set({ step2WebhookAt: at, updatedAt: at })
      .where(eq(chatLead.id, id));
  },

  async stampStep1AbandonWebhook(id: string, at: Date = new Date()): Promise<void> {
    const db = requireChatDb();
    await db
      .update(chatLead)
      .set({ step1AbandonWebhookAt: at, updatedAt: at })
      .where(eq(chatLead.id, id));
  },
};
