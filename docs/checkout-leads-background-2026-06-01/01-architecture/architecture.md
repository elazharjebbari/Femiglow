# 01 — Architecture de la solution

> Vue complète : couches, modules, interfaces (signatures TS), modèle d'erreurs,
> concurrence, sécurité, observabilité. Diagrammes : [`diagrams/`](diagrams/).
> Cartographie module→fichier : [`module-map.csv`](module-map.csv).

## 1. Vue en couches (C4 niveau 2/3)

```
CLIENT (navigateur, "use client")
  Presentation : wizard steps (LeadCaptureStep, AddressStep, PaymentStep, ThankYouStep)
  State        : wizard-store (Zustand)               ← transition optimiste
  Sync         : lead-sync-queue + beacon-flush        ← envoi background + secours
  Transport    : wizard-client (+ /sync batch), idempotency-key, lead-id
  Tracking     : use-tracking.emit (client, immédiat)

SERVEUR (Next route handlers, runtime=nodejs)
  API          : /api/checkout/lead[...] (granulaire)  +  /api/checkout/lead/sync (batch)
  Application  : lead-service (upsert + enqueue outbox, transactionnel)
  Domain/Repo  : wizard-lead-repo (upsert), idempotency-repo, lead-outbox-repo
  Persistence  : Postgres (chat_lead, checkout_idempotency, lead_event_outbox)

WORKER (cron systemd 60s)
  /api/cron/lead-outbox → lead-outbox-processor → handlers (serverFire CAPI/GA4, webhook)
```

## 2. Principes d'architecture

- **Hexagonal léger** : l'API ne contient pas de logique métier ; elle délègue à
  `lead-service` (application) qui orchestre repos + outbox. Les handlers d'effets
  sont des *ports* (interfaces) ; les implémentations (webhook/tracking existants)
  sont des *adapters*.
- **Transactional Outbox** : état métier (`chat_lead`) et intention d'effet
  (`lead_event_outbox`) écrits **dans la même transaction** → cohérence atomique.
- **CQRS-lite** : écritures via upsert idempotent ; lectures (admin, scanner) inchangées.
- **Idempotence partout** (ADR-0006).
- **Flag-gated** : `CHECKOUT_OPTIMISTIC_WIZARD_ENABLED` (serveur) +
  `NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED` (client). OFF ⇒ legacy bit-à-bit.

## 3. Modules & interfaces (contrats TS)

### 3.1 Client — `src/lib/checkout/client/lead-id.ts`
```ts
/** Génère un leadId stable côté client (même alphabet que @/lib/ids). */
export function newLeadId(): string;            // -> "cl_xxxxxxxxxxxxxxxxxxxx"
export function isLeadId(v: string): boolean;   // ^cl_[0-9a-z]{20,}$
```

### 3.2 Client — `src/lib/checkout/state/lead-sync-queue.ts`
```ts
export interface Envelope {
  mutationId: string;          // uuid v4, dédup transport
  leadId: string;              // cl_...
  scope: MutationScope;        // 'lead_create' | 'address_update' | 'payment_select' | 'order_create' | 'email_optin'
  endpoint: string;            // chemin granulaire ciblé
  method: 'POST' | 'PATCH';
  idempotencyKey: string;
  payload: unknown;            // validé par le schéma du scope
  enqueuedAt: string;          // ISO
  attempt: number;             // compteur de retry
}

export interface SyncTransport {
  send(env: Envelope): Promise<{ ok: true } | { ok: false; retryable: boolean; status?: number }>;
}

export interface LeadSyncQueue {
  enqueue(env: Omit<Envelope, 'mutationId' | 'enqueuedAt' | 'attempt'>): void; // non-bloquant
  flush(): Promise<void>;        // draine FIFO/leadId avec backoff
  pending(): Envelope[];         // pour beacon + tests
  hydrateFromMirror(): void;     // reprise après reload
}

export function createLeadSyncQueue(opts: {
  transport: SyncTransport;      // injectable (MSW/tests)
  storage?: Storage;             // défaut sessionStorage
  maxAttempts?: number;          // défaut 6
  backoffBaseMs?: number;        // défaut 250
}): LeadSyncQueue;
```

### 3.3 Client — `src/lib/checkout/client/beacon-flush.ts`
```ts
/** Installe les listeners pagehide/visibilitychange → sendBeacon('/api/checkout/lead/sync'). */
export function installBeaconFlush(queue: LeadSyncQueue): () => void; // retourne un teardown
```

### 3.4 Serveur — `src/lib/checkout/services/lead-service.ts` (application)
```ts
export interface ApplyResult { leadId: string; status: string; nextStep?: string; replayed: boolean; }

/** Upsert idempotent + enqueue des effets outbox, dans une transaction. */
export const leadService: {
  applyLeadCreate(input: CreateLeadInput, idem: IdemCtx): Promise<ApplyResult>;
  applyAddress(leadId: string, input: AddressInput, idem: IdemCtx): Promise<ApplyResult>;
  applyPayment(leadId: string, input: PaymentInput, idem: IdemCtx): Promise<ApplyResult>;
  applyBatch(envelopes: ServerEnvelope[]): Promise<BatchReport>;  // pour /sync + beacon
};
```

### 3.5 Serveur — `src/lib/checkout/repos/lead-repo.ts` (évolution)
```ts
// AVANT : createWizardLead(...) -> insert (id serveur)
// APRÈS : upsertWizardLead(id, fields) -> INSERT ... ON CONFLICT(id) DO UPDATE (fill non-null)
upsertWizardLead(id: string, fields: LeadCreateFields): Promise<ChatLeadRow>;
upsertAddress(id: string, fields: AddressFields): Promise<ChatLeadRow>;     // crée la row si absente
upsertPayment(id: string, fields: PaymentFields): Promise<ChatLeadRow>;     // idem
// getById / markPurchased / stampStep1AbandonWebhook : inchangés
```

### 3.6 Serveur — `src/lib/leads/outbox/` (nouveau, calqué sur `lib/mail/outbox`)
```ts
// lead-outbox-repo.ts
enqueue(tx: Tx, ev: { type: LeadEffectType; leadId: string; dedupeKey: string; payload: unknown }): Promise<void>;
pickBatch(limit: number): Promise<LeadOutboxRow[]>;     // FOR UPDATE SKIP LOCKED
markDone(id: string): Promise<void>;
reschedule(id: string, err: string): Promise<void>;     // attempts++, backoff, dead si > max
// lead-outbox-processor.ts
pickAndProcessBatch(): Promise<{ picked: number; done: number; rescheduled: number; dead: number }>;
// handlers/ : registerHandler(type, fn) ; fn délègue à serverFire / dispatchOrderWebhook existants
```

### 3.7 Worker — `src/app/api/cron/lead-outbox/route.ts`
Identique au pattern `email-outbox/route.ts` : auth `Bearer CRON_SECRET`,
`maxDuration=60`, appelle `pickAndProcessBatch()`, logue le résultat.

## 4. Modèle d'erreurs

| Couche | Erreur | Comportement |
|---|---|---|
| Client validation (Zod) | invalide | **bloque** l'avance (avant enqueue) ; message inline. |
| Transport (réseau/5xx) | retryable | re-file avec backoff ; pas d'impact UI. |
| Transport (4xx non-409) | non-retryable | drop de l'envelope + log `owbs.queue.dropped` + indicateur FR-11. |
| Idempotency 409 (hash conflict) | non-retryable | considéré « déjà appliqué » → drop silencieux + log. |
| Serveur upsert | exception | `mapError` (existant) ; rien n'est marqué `done` ; retry naturel. |
| Outbox handler | exception | `reschedule` (backoff) ; `dead` après `max_attempts` → alerte. |

Aucune erreur de fond ne **bloque** la navigation (ADR-0001). Les erreurs
persistantes sont **surfacées** discrètement (FR-11) et **alertées** côté ops.

## 5. Concurrence & cohérence

- **Client** : flush sérialisé par `leadId` (pas deux envois concurrents du même lead) via un petit mutex en file.
- **Serveur** : upsert `ON CONFLICT` atomique ; colonnes disjointes par scope (ADR-0006) → pas de lost-update inter-scopes.
- **Worker** : `FOR UPDATE SKIP LOCKED` → plusieurs runners cron sans collision (idempotent).
- **Outbox dédup** : `UNIQUE(type, leadId, dedupe_key)` absorbe les doubles-insertions.

## 6. Sécurité & RGPD

- `leadId` client validé `^cl_[0-9a-z]{20,}$` ; upsert refuse un `visitorId` incohérent avec une row existante.
- PII **jamais** loggée en clair (logs = ids + scopes + statuts). Hashing PII tracking inchangé (`hashIdentityBrowser`).
- `/sync` : rate-limit léger par `visitorId`/IP + plafond `envelopes.length` (anti-abus). Pas d'auth (public checkout) mais payload strictement validé (Zod) + idempotent.
- Consentement : `lead_create` porte `consentVersion` ; aucun effet marketing outbox sans consentement requis.

## 7. Observabilité (détail en `../05-runbook/observability.md`)

- **Logs structurés** : `owbs.queue.enqueue|flush|retry|dropped`, `owbs.lead.upsert`, `owbs.outbox.enqueue|done|reschedule|dead`, `owbs.beacon.sent`.
- **Métriques** : profondeur file (client→beacon échantillonné), backlog `lead_event_outbox` (pending/dead), latence p50/p95 persistance, taux de retry, taux de 409.
- **Alertes** : backlog outbox `pending > seuil` ou `dead > 0` ; taux d'échec transport > seuil.

## 8. Stratégie de compatibilité (flag OFF)

Quand `NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED=false` : `use-wizard-mutations`
conserve **exactement** le chemin actuel (`await` puis `goToStep`), la file n'est
pas instanciée, aucun nouvel endpoint n'est sollicité. La table/worker outbox
peuvent être déployés en amont (inertes tant que rien n'enqueue). Migration de
données : **aucune** (ajout de table + colonnes nullables).
