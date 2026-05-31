# Plan d'action : Webhook leads — correction et extension

**Date** : 2026-05-16
**Branche** : `leads-webhook-multi-step` (worktree `/var/www/femiglow-leads-webhook-multi-step`)
**Base** : `3bdae2e` (merge Snapchat tracking)

---

## Sommaire

1. [Problemes identifies](#1-problemes-identifies)
2. [Conception — architecture cible](#2-conception--architecture-cible)
3. [Plan de dev detaille — etapes et tests](#3-plan-de-dev-detaille)
4. [Plan de test](#4-plan-de-test)
5. [Runbook d'execution](#5-runbook-dexecution)

---

## 1. Problemes identifies

| # | Probleme | Severite | Impact |
|---|----------|----------|--------|
| P1 | `OUTBOUND_WEBHOOK_URL` absent → 5 sources webhook sur 6 retournent `disabled` | **CRITIQUE** | Aucun webhook step-1-abandon, chat-lead, cart-abandon, order, contact |
| P2 | Leads `inline-contact` (conversation) : aucun webhook dispatche a la creation | **CRITIQUE** | Les leads auto-detectes dans le chat n'arrivent jamais au CRM |
| P3 | Scanner step-1-abandon filtre sur `leadCapturedAt IS NOT NULL` → les leads `inline-contact` (qui ont `leadCapturedAt = null`) sont exclus | **MAJEUR** | Les leads conversation abandonnes ne sont jamais rattrapes |
| P4 | Seul `from-wizard-step2` dispatche vers les endpoints admin ; les 5 autres sources n'utilisent que l'URL outbound | **MAJEUR** | Configuration en double (env var + admin UI) pour un resultat partiel |
| P5 | Le scanner step-1-abandon rescanne les leads `disabled` chaque minute (pas de dedup temporel) | **MINEUR** | Gaspillage DB, logs bruyants |

---

## 2. Conception — architecture cible

### 2.1 Principe directeur

**Un seul chemin de dispatch, un seul source de verite.** Les endpoints admin (`webhookEndpoints` table) deviennent le canal principal pour TOUTES les sources webhook. L'URL outbound (`OUTBOUND_WEBHOOK_URL`) reste disponible comme fallback retrocompatible.

### 2.2 Modele de donnees

#### Extension `tracking_settings` (3 nouvelles cles)

| Cle | Type | Defaut | Description |
|-----|------|--------|-------------|
| `lead.step1_abandon_enabled` | boolean | true | Deja existant |
| `lead.step1_abandon_timeout_minutes` | number | 5 | Deja existant |
| `lead.inline_contact_webhook_enabled` | **NOUVEAU** boolean | true | Activer le webhook immediat pour les leads inline-contact |

Pas besoin de nouvelle table ou migration. Les settings existent deja dans `tracking_settings` en tant que KV store.

#### Schema `chat_lead` — champ `leadCapturedAt`

Actuellement, `leadCapturedAt` est null pour les leads `inline-contact` et les leads chat form. Le scanner step-1-abandon exige `leadCapturedAt IS NOT NULL`.

**Solution** : utiliser `COALESCE(lead_captured_at, created_at)` dans la requete du scanner. Cela permet de rattraper les leads conversation sans migration de schema.

### 2.3 Flux webhook cible

```
┌────────────────────────────────────────────────────────────────────┐
│                    SOURCES WEBHOOK (APRES)                         │
├────────────────────────────┬───────────────────────────────────────┤
│ Source                     │ Chemin de dispatch                    │
├────────────────────────────┼───────────────────────────────────────┤
│ from-wizard-step2          │ endpoints admin → outbound URL       │
│ from-wizard-step1-abandon  │ endpoints admin → outbound URL  ←CHANGE│
│ from-chat-lead             │ endpoints admin → outbound URL  ←CHANGE│
│ from-inline-contact        │ endpoints admin → outbound URL  ←NOUVEAU│
│ from-cart-abandon          │ endpoints admin → outbound URL  ←CHANGE│
│ from-order                 │ endpoints admin → outbound URL  ←CHANGE│
│ from-contact               │ endpoints admin → outbound URL  ←CHANGE│
└────────────────────────────┴───────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                    LEADS CONVERSATION (APRES)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Chat utilisateur                                                   │
│  └─ detectInlineContact() → leadRepo.create()                     │
│     ├─ notifyHotLead() (Slack)                            ✅ OK    │
│     └─ dispatchInlineContactWebhook()                     ←NOUVEAU │
│        └─ event: chat_lead.created                               │
│        └─ source_channel: chat:inline-contact                    │
│        └─ conversation: snapshot des derniers messages           │
│                                                                     │
│  Si upgrade via formulaire formel :                               │
│  └─ POST /api/chat/lead/contact                                  │
│     └─ leadRepo.upgrade() → dispatchChatLeadWebhook()      ✅ OK  │
│        └─ event: chat_lead.created                               │
│        └─ idempotency-key different → pas de doublon             │
│                                                                     │
│  Si PAS d'upgrade :                                                │
│  └─ leadCapturedAt = NULL mais created_at sert de fallback       │
│  └─ Scanner step-1-abandon les trouve via COALESCE         ←CHANGE│
│     └─ event: lead.step1_abandoned                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.4 Dispatch unifie — `dispatchToAllChannels`

Nouvelle fonction partagee qui remplace le pattern dispatch-outbound-only :

```typescript
// lib/webhooks/outbound/dispatch-to-all-channels.ts

interface DispatchToAllChannelsInput {
  source: OutboundSource;
  sourceId: string;
  idempotencyKey: string;
  eventName: WebhookEventName;
  payload: OutboundPayload;
  leadId?: string;  // pour stamp webhook timestamps
  stampStep?: 'step2' | 'step1_abandon' | 'abandon';
}

async function dispatchToAllChannels(input: DispatchToAllChannelsInput): Promise<DispatchResult> {
  // 1. Essayer les endpoints admin (matching evenements)
  const adminResult = await dispatchToAdminEndpoints(input);

  // 2. Si aucun endpoint admin matche, fallback outbound URL
  if (!adminResult) {
    return dispatchOutbound({ ... });
  }

  return adminResult;
}
```

### 2.5 Nouvelle source : `from-inline-contact`

Payload identique a `from-chat-lead` mais avec :
- `id: inline-contact:${lead.id}`
- `source_channel: chat:inline-contact`
- `note` inclut `trigger:inline-contact`
- `conversation` : snapshot des messages (si setting active)

L'idempotency key est `inline-contact:${lead.id}` — differente de `chat-lead:${lead.id}` pour permettre l'upgrade sans collision.

### 2.6 Admin UI — modifications

Ajouter dans `LeadWebhookSettingsForm` :

1. Toggle **"Webhook immediat inline-contact"** (`lead.inline_contact_webhook_enabled`)
2. Indicateur visuel du statut outbound URL (configure/non configure) avec message d'aide
3. Lien rapide vers la page `/admin/webhooks` pour configurer les endpoints

Ajouter dans `/admin/webhooks` (page existante) :

1. Colonne **evenements** plus lisible dans la liste des endpoints
2. Badge **statut** pour chaque source webhook (vert si au moins un canal configure, rouge sinon)

### 2.7 Scanner step-1-abandon — correction

Remplacer :
```sql
AND lead_captured_at IS NOT NULL
AND lead_captured_at < cutoff_idle
AND lead_captured_at > cutoff_max_age
```

Par :
```sql
AND COALESCE(lead_captured_at, created_at) IS NOT NULL
AND COALESCE(lead_captured_at, created_at) < cutoff_idle
AND COALESCE(lead_captured_at, created_at) > cutoff_max_age
```

Et ajouter un filtre pour exclure les leads deja webhookes via `chat_lead.created` (inline-contact) si le webhook immediat est actif, pour eviter les doublons :
```sql
AND (trigger_reason != 'inline-contact' OR step1_abandon_webhook_at IS NULL)
```

### 2.8 Dedup des leads `disabled`

Ajouter un compteur de tentatives `disabled` dans le scanner. Apres 3 tentatives consecutives `disabled`, marquer le lead avec un timestamp `step1AbandonWebhookAt` pour l'exclure du scan pendant 24h. Cela evite de scanner les memes leads chaque minute.

---

## 3. Plan de dev detaille

### Phase 1 — Infrastructure (backend core)

#### Etape 1.1 : Creer `dispatchToAllChannels`

**Fichier** : `apps/web/src/lib/webhooks/outbound/dispatch-to-all-channels.ts`

Extraire la logique de dispatch dual de `from-wizard-step2.ts` dans une fonction partagee :

```typescript
export async function dispatchToAllChannels(input: {
  source: OutboundSource;
  sourceId: string;
  idempotencyKey: string;
  eventName: WebhookEventName;
  payload: OutboundPayload;
  stampStep?: 'step2' | 'step1_abandon' | 'abandon';
  stampLeadId?: string;
}): Promise<DispatchResult>
```

**Tests** : `dispatch-to-all-channels.test.ts`
- Verifie que les endpoints admin sont tentes en premier
- Verifie le fallback outbound quand aucun endpoint admin ne matche
- Verifie que le stamp est applique apres successe
- Verifie que les erreurs admin n'empechent pas le fallback outbound

#### Etape 1.2 : Refactorer les 5 sources existantes

Remplacer les appels directs a `dispatchOutbound()` par `dispatchToAllChannels()` dans :

| Fichier | Evenement | Changement |
|---------|-----------|------------|
| `from-chat-lead.ts` | `chat_lead.created` | `dispatchOutbound` → `dispatchToAllChannels` |
| `from-wizard-step1-abandon.ts` | `lead.step1_abandoned` | `dispatchOutbound` → `dispatchToAllChannels` |
| `from-cart-abandon.ts` | `cart.abandoned` | `dispatchOutbound` → `dispatchToAllChannels` |
| `from-order.ts` | `order.created` | `dispatchOutbound` → `dispatchToAllChannels` |
| `from-contact.ts` | `contact.submitted` | `dispatchOutbound` → `dispatchToAllChannels` |

`from-wizard-step2.ts` conserve sa logique existante (deja en dual dispatch).

**Tests** : Mettre a jour les tests existants pour mocker `dispatchToAllChannels` au lieu de `dispatchOutbound`.

#### Etape 1.3 : Creer `from-inline-contact.ts`

**Fichier** : `apps/web/src/lib/webhooks/outbound/sources/from-inline-contact.ts`

- Builder de payload similaire a `from-chat-lead.ts`
- `eventName: 'chat_lead.created'`
- `source: 'inline-contact'`
- `idempotencyKey: inline-contact:${lead.id}`
- Inclut la conversation si `settings.conversationEnabled`
- Feature flag : `lead.inline_contact_webhook_enabled` (default true)

**Tests** : `from-inline-contact.test.ts`
- Payload contient `source_channel: chat:inline-contact`
- Conversation incluse si setting active
- Conversation omise si setting desactive
- Feature flag desactive → status `disabled`
- Phone invalide → status `skipped`

### Phase 2 — Integration orchestrator

#### Etape 2.1 : Dispatcher le webhook inline-contact dans l'orchestrator

**Fichier** : `apps/web/src/lib/chat/services/orchestrator.ts`

Apres la creation du lead `inline-contact`, ajouter :

```typescript
// Apres notifyHotLead()
void dispatchInlineContactWebhook(autoLead).catch((err) => {
  logger.warn('chat.orchestrator.inline_contact_webhook_failed', { ... });
});
```

Fire-and-forget, comme pour `notifyHotLead`.

**Tests** : Mettre a jour `orchestrator.test.ts` pour verifier que le webhook est dispatche apres creation inline-contact.

#### Etape 2.2 : Corriger le scanner step-1-abandon

**Fichier** : `apps/web/src/lib/webhooks/outbound/lead-step1-abandon-scanner.ts`

Changer la requete SQL :

```typescript
// Avant
sql`${chatLead.leadCapturedAt} is not null`,
lt(chatLead.leadCapturedAt, cutoffIdle),
gt(chatLead.leadCapturedAt, cutoffMaxAge),

// Apres
sql`COALESCE(${chatLead.leadCapturedAt}, ${chatLead.createdAt}) is not null`,
lt(sql`COALESCE(${chatLead.leadCapturedAt}, ${chatLead.createdAt})`, cutoffIdle),
gt(sql`COALESCE(${chatLead.leadCapturedAt}, ${chatLead.createdAt})`, cutoffMaxAge),
```

Ajouter le filtre de dedup inline-contact :

```typescript
// Ne pas scanner les leads inline-contact si le webhook immediat est actif
// (ils ont deja recu un webhook chat_lead.created)
```

**Tests** : Mettre a jour `lead-step1-abandon-scanner.test.ts`
- Verifier que les leads `inline-contact` avec `leadCapturedAt = null` mais `createdAt` recent sont trouves
- Verifier que les leads trop anciens (> 7 jours) sont exclus
- Verifier le dedup avec les leads deja webhookes via inline-contact

#### Etape 2.3 : Dedup des leads `disabled`

**Fichier** : `apps/web/src/lib/webhooks/outbound/lead-step1-abandon-scanner.ts`

Ajouter une colonne `step1_abandon_disabled_at` au schema `chat_lead` (migration) ou utiliser un compteur en memoire dans le scanner.

Approche retenue : utiliser un compteur en memoire dans le scanner avec cache LRJ (Last Retry Justification). Si un lead retourne `disabled` 3 fois consecutives, le marquer avec `step1AbandonWebhookAt = now()` pour l'exclure pendant 24h.

**Alternative plus simple** : stamp `step1AbandonWebhookAt` meme pour les leads `disabled` (le dispatch a ete tente, l'URL n'existe pas, le lead n'aura jamais de webhook outbound). Cela evite le rescan sans migration.

**Decision** : Stamp sur `disabled` egalement, mais avec une valeur negative ou un flag special pour distinguer "disabled" de "sent". Simplement : on stamp `step1AbandonWebhookAt` pour tous les statuts sauf `failed` (retry) et `pending`.

**Tests** : Verifier que les leads `disabled` sont stamps et exclus du scan suivant.

### Phase 3 — Admin UI

#### Etape 3.1 : Ajouter le toggle inline-contact dans `LeadWebhookSettingsForm`

**Fichier** : `apps/web/src/components/admin/tracking/LeadWebhookSettingsForm.tsx`

Ajouter un checkbox :
```tsx
<label className="flex items-start gap-3">
  <input type="checkbox" checked={inlineContactEnabled} ... />
  <span className="text-sm text-stone-800">
    <span className="font-medium">Webhook immediat inline-contact</span>
    <span className="mt-0.5 block text-xs text-stone-500">
      Envoie un webhook lorsqu'un numero est detecte dans le chat.
    </span>
  </span>
</label>
```

**Setting key** : `lead.inline_contact_webhook_enabled` (default: true)

**Tests** : `LeadWebhookSettingsForm.test.tsx`
- Verifier que le toggle reflete la valeur initiale
- Verifier que le toggle envoie le bon PATCH au backend

#### Etape 3.2 : Ajouter l'indicateur outbound URL

**Fichier** : `apps/web/src/app/admin/tracking/settings/page.tsx`

Ajouter un indicateur visuel :
- Si `OUTBOUND_WEBHOOK_URL` est configure → badge vert "URL outbound configuree"
- Si absent → badge rouge "URL outbound manquante" + lien vers `.env`

#### Etape 3.3 : Ajouter le statut des sources webhook dans `/admin/webhooks`

**Fichier** : `apps/web/src/app/admin/webhooks/page.tsx`

Ajouter une section "Statut des sources webhook" montrant :
- Chaque source (6 sources) avec son etat (vert si au moins un canal configure, rouge sinon)
- Nombre d'endpoints admin abonnes a chaque evenement
- Lien outbound URL (configure ou non)

### Phase 4 — Settings backend

#### Etape 4.1 : Ajouter la setting `inline_contact_webhook_enabled`

**Fichier** : `apps/web/src/lib/db/queries/tracking/settings.ts`

Ajouter la cle :
```typescript
LEAD_INLINE_CONTACT_WEBHOOK_ENABLED: 'lead.inline_contact_webhook_enabled',
```

**Fichier** : `apps/web/src/lib/webhooks/outbound/settings.ts`

Ajouter le champ dans `LeadWebhookSettings` :
```typescript
inlineContactWebhookEnabled: boolean;
```

Et dans `getLeadWebhookSettings()` :
```typescript
const inlineContactEnabled = await getTrackingSetting<boolean>(
  TRACKING_SETTING_KEYS.LEAD_INLINE_CONTACT_WEBHOOK_ENABLED, true
);
```

**Fichier** : `apps/web/src/app/api/admin/tracking/settings/route.ts`

Ajouter la cle dans le PATCH handler.

**Tests** : Verifier que le setting est lu/ecrit correctement.

### Phase 5 — Migration de donnees (seeding)

#### Etape 5.1 : Seeding du setting inline-contact

**Fichier** : Pas de migration SQL necessaire. Le systeme `tracking_settings` est un KV store qui cree les rows a la demande.

Le setting sera cree automatiquement au premier appel de `getLeadWebhookSettings()`.

### Phase 6 — Configuration production

#### Etape 6.1 : Configurer `OUTBOUND_WEBHOOK_URL`

Ajouter dans `.env` (production) :
```
OUTBOUND_WEBHOOK_URL=https://votre-endpoint-crm.com/webhook
OUTBOUND_WEBHOOK_SECRET=<generer-un-secret-hmac-256>
```

Regenerer le secret avec :
```bash
openssl rand -hex 32
```

#### Etape 6.2 : Verifier le cron tick

Le systemd timer `femiglow-cron-tick.timer` tourne deja chaque minute. Verifier :
```bash
systemctl status femiglow-cron-tick.timer
journalctl -u femiglow.service --since "1 minute ago" | grep cron.tick
```

---

## 4. Plan de test

### 4.1 Tests unitaires (Vitest)

| Fichier | Tests | Priorite |
|---------|-------|----------|
| `dispatch-to-all-channels.test.ts` | Dispatch vers admin endpoints d'abord, fallback outbound, stamp apres successe, erreurs admin | P0 |
| `from-inline-contact.test.ts` | Payload correct, conversation incluse/omise, feature flag, phone invalide | P0 |
| `lead-step1-abandon-scanner.test.ts` | COALESCE leadCapturedAt/createdAt, exclusion inline-contact si webhook immediat actif, stamp sur disabled | P0 |
| `LeadWebhookSettingsForm.test.tsx` | Toggle inline-contact, indication outbound URL | P1 |
| `from-chat-lead.test.ts` | Refactor dispatchToAllChannels (pas de regression) | P1 |
| `from-wizard-step1-abandon.test.ts` | Refactor dispatchToAllChannels (pas de regression) | P1 |
| `from-cart-abandon.test.ts` | Refactor dispatchToAllChannels | P1 |
| `from-order.test.ts` | Refactor dispatchToAllChannels | P1 |
| `from-contact.test.ts` | Refactor dispatchToAllChannels | P1 |

### 4.2 Tests d'integration (Vitest + MSW)

| Fichier | Tests | Priorite |
|---------|-------|----------|
| `cron-tick.test.ts` | Scanner step-1-abandon avec leads inline-contact, stamp disabled | P0 |
| `outbound-webhook-inline-contact.test.ts` (nouveau) | End-to-end : creation lead inline-contact → webhook dispatche → payload valide | P0 |
| `chat-lead-webhook.test.ts` | Pas de regression sur les webhooks chat-lead existants | P1 |
| `webhook-delivery.test.ts` | Verifier que les deliveries admin recoivent les nouveaux evenements | P1 |

### 4.3 Tests E2E (Playwright)

| Test | Description | Priorite |
|------|-------------|----------|
| `admin-webhooks-inline-contact.spec.ts` (nouveau) | Verifier que le toggle inline-contact apparait dans les settings et fonctionne | P1 |
| `admin-webhooks-source-status.spec.ts` (nouveau) | Verifier l'indicateur de statut des sources webhook | P2 |

### 4.4 MSW mocks

Configurer MSW pour simuler :
- Les endpoints admin webhook (reponses 200, 401, 500)
- L'URL outbound webhook (reponses 200, 401, timeout)
- Le cron tick avec differents scenarios (lead inline-contact, lead wizard, lead conversation)

### 4.5 Tests manuels (runbook)

1. Creer un lead inline-contact via le chat → verifier le webhook dans les logs
2. Creer un lead wizard step-1 → attendre 5 min → verifier le webhook step-1-abandon
3. Configurer un endpoint admin → verifier que les webhooks arrivent aux deux canaux
4. Desactiver `OUTBOUND_WEBHOOK_URL` → verifier que les webhooks passent uniquement par les endpoints admin
5. Desactiver les endpoints admin → verifier le fallback vers l'URL outbound

---

## 5. Runbook d'execution

### Pre-requis

```bash
# Se placer dans le worktree
cd /var/www/femiglow-leads-webhook-multi-step
git checkout leads-webhook-multi-step
git pull origin leads-webhook-multi-step 2>/dev/null || true
```

### Etape 1 — Creer la branche de feature

```bash
cd /var/www/femiglow-leads-webhook-multi-step
git checkout -b fix/webhook-dispatch-all-channels
```

### Etape 2 — Phase 1 : Infrastructure

```bash
# 2a. Creer dispatchToAllChannels
# Fichier: apps/web/src/lib/webhooks/outbound/dispatch-to-all-channels.ts
# Extraire la logique de from-wizard-step2.ts

# 2b. Refactorer les 5 sources
# Modifier: from-chat-lead.ts, from-wizard-step1-abandon.ts, from-cart-abandon.ts, from-order.ts, from-contact.ts
# Remplacer dispatchOutbound() par dispatchToAllChannels()

# 2c. Creer from-inline-contact.ts
# Fichier: apps/web/src/lib/webhooks/outbound/sources/from-inline-contact.ts

# 2d. Tests
npx vitest run apps/web/src/lib/webhooks/outbound/dispatch-to-all-channels.test.ts
npx vitest run apps/web/src/lib/webhooks/outbound/sources/from-inline-contact.test.ts
```

### Etape 3 — Phase 2 : Integration orchestrator

```bash
# 3a. Modifier orchestrator.ts pour dispatcher le webhook inline-contact
# Fichier: apps/web/src/lib/chat/services/orchestrator.ts

# 3b. Corriger le scanner step-1-abandon
# Fichier: apps/web/src/lib/webhooks/outbound/lead-step1-abandon-scanner.ts
# Remplacer leadCapturedAt par COALESCE(leadCapturedAt, createdAt)
# Ajouter le stamp sur disabled

# 3c. Tests
npx vitest run apps/web/src/lib/webhooks/outbound/lead-step1-abandon-scanner.test.ts
npx vitest run apps/web/src/lib/chat/services/orchestrator.test.ts
```

### Etape 4 — Phase 3+4 : Settings + UI

```bash
# 4a. Ajouter la setting inline-contact
# Fichier: apps/web/src/lib/db/queries/tracking/settings.ts
# Fichier: apps/web/src/lib/webhooks/outbound/settings.ts

# 4b. Ajouter le toggle dans l'admin UI
# Fichier: apps/web/src/components/admin/tracking/LeadWebhookSettingsForm.tsx

# 4c. Ajouter l'indicateur outbound URL
# Fichier: apps/web/src/app/admin/tracking/settings/page.tsx

# 4d. Tests
npx vitest run apps/web/src/components/admin/tracking/LeadWebhookSettingsForm.test.tsx
```

### Etape 5 — Tests complets

```bash
# Suite complete
npx vitest run

# Lint
npx next lint

# Typecheck
npx tsc --noEmit
```

### Etape 6 — Build et deploiement

```bash
# Build
pnpm build

# Restart service
systemctl restart femiglow.service

# Verifier les logs
journalctl -u femiglow.service -f --since "1 minute ago"
```

### Etape 7 — Configuration production

```bash
# Ajouter OUTBOUND_WEBHOOK_URL dans .env
vi /var/www/femiglow/apps/web/.env
# Ajouter:
# OUTBOUND_WEBHOOK_URL=https://votre-endpoint-crm.com/webhook
# OUTBOUND_WEBHOOK_SECRET=$(openssl rand -hex 32)

# Restart
systemctl restart femiglow.service

# Verifier que les webhooks passent
journalctl -u femiglow.service -f | grep "outbound.webhook"
```

### Etape 8 — Validation manuelle

```bash
# 8a. Tester le webhook inline-contact
# Envoyer un message avec un numero de telephone dans le chat
# Verifier dans les logs que le webhook est dispatche

# 8b. Tester le scanner step-1-abandon
# Creer un lead wizard step-1 via l'API
# Attendre 5 minutes
# Verifier dans les logs que le webhook step-1-abandon est dispatche

# 8c. Tester les endpoints admin
# Configurer un endpoint admin dans /admin/webhooks
# Verifier que les webhooks arrivent aux deux canaux

# 8d. Verifier les leads conversation dans l'admin
# Verifier que les leads inline-contact apparaissent dans /admin/chat/leads
# avec webhook_status='sent' ou 'pending'
```

### Etape 9 — Merge dans master

```bash
cd /var/www/femiglow
git merge leads-webhook-multi-step --no-ff -m "fix(webhooks): dispatch all sources to admin endpoints + inline-contact webhook"
pnpm build
systemctl restart femiglow.service
```

---

## Annexes

### A. Evenements webhook disponibles

| Evenement | Sources qui l'emettent | Endpoints admin abonnes |
|-----------|------------------------|------------------------|
| `lead.step2_completed` | `from-wizard-step2` | Configurable |
| `lead.step1_abandoned` | `from-wizard-step1-abandon` | Configurable (apres refactor) |
| `chat_lead.created` | `from-chat-lead`, `from-inline-contact` (NOUVEAU) | Configurable (apres refactor) |
| `cart.abandoned` | `from-cart-abandon` | Configurable (apres refactor) |
| `order.created` | `from-order` | Configurable (apres refactor) |
| `contact.submitted` | `from-contact` | Configurable (apres refactor) |
| `lead.created` | Retrocompatibilite pour les anciens endpoints | Configurable |

### B. Schema de payload inline-contact

```json
{
  "id": "inline-contact:cl_xxxxxxxx",
  "full_name": "Visiteur",
  "phone": "+212600000000",
  "source": "chat_widget",
  "source_channel": "chat:inline-contact",
  "conversation": [
    { "role": "user", "name": "Visiteur", "text": "Je veux commander", "ts": "2026-05-16T14:30:00Z" },
    { "role": "assistant", "name": "FemiGlow", "text": "Avec plaisir !", "ts": "2026-05-16T14:30:01Z" }
  ],
  "note": "Capture automatique — coordonnées détectées dans le chat | trigger:inline-contact",
  "quantity": 1,
  "currency": "MAD"
}
```

### C. Ordre de priorite des canaux

1. **Endpoints admin** (table `webhook_endpoints`) — configuration via l'interface admin
2. **URL outbound** (`OUTBOUND_WEBHOOK_URL`) — fallback retrocompatible
3. Si aucun canal configure → status `disabled` (comportement actuel)

### D. Regles de dedup

| Scenario | Dedup |
|----------|-------|
| Lead inline-contact → webhook immediat | `idempotencyKey: inline-contact:${leadId}` |
| Upgrade du lead inline-contact via formulaire | `idempotencyKey: chat-lead:${leadId}` (different) |
| Scanner step-1-abandon pour le meme lead | `idempotencyKey: lead-step1-abandon:${leadId}` (different) |

Chaque evenement a sa propre cle d'idempotence → pas de collision, pas de doublon.

### E. Risques et mitigations

| Risque | Mitigation |
|--------|------------|
| Doublon webhook inline-contact + step-1-abandon | Cles d'idempotence differentes par evenement |
| Lead inline-contact deja upgrade avant le cron | Le scanner ne trouve pas le lead (addressCompletedAt set) |
| Performance : rescan des leads disabled | Stamp sur disabled, exclusion temporaire |
| Regression des webhooks step2 existants | Aucun changement a from-wizard-step2.ts |
| Regression des webhooks chat-lead existants | dispatchToAllChannels essaie les memes canaux + fallback outbound |