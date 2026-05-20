# Audit : Webhooks leads incomplets et leads conversation

**Date** : 2026-05-16
**Scope** : Systeme de webhook leads (step-1-abandon, chat-lead, cart-abandon, conversation)
**Status** : CORRIGE — commit `4855c91` merge sur master, build OK, service restarted

---

## Resume executif

Deux problemes critiques empechent les webhooks de fonctionner correctement :

1. **`OUTBOUND_WEBHOOK_URL` non configure** — 5 sources webhook sur 6 utilisent exclusivement `dispatchOutbound()` qui requiert cette variable d'environnement. Sans elle, tout dispatch retourne `disabled`.
2. **Les leads `inline-contact` (conversation) ne declenchent aucun webhook** — la creation automatique dans l'orchestrator n'envoie pas de webhook, et le scanner step-1-abandon ne les trouve pas car `leadCapturedAt` est null.

Seul `lead.step2_completed` fonctionne car il dispatche aussi vers les endpoints admin (table `webhook_endpoints`).

---

## 1. Diagnostic : webhooks `disabled` en production

### Preuve dans les logs

```
outbound.webhook.disabled  source=lead-step1-abandon  reason=no-endpoint-configured
outbound.webhook.disabled  source=chat-lead           reason=no-endpoint-configured
outbound.webhook.disabled  source=cart-abandon         reason=no-endpoint-configured
```

Le scanner tourne toutes les minutes (systemd timer `femiglow-cron-tick.timer`), trouve 5 leads candidats, mais chaque dispatch echoue avec `disabled`.

### Cause racine

Le dispatcher (`outbound/dispatcher.ts`) resout l'URL via :

```typescript
const url = env.OUTBOUND_WEBHOOK_URL ?? env.CHAT_LEAD_WEBHOOK_URL;
const secret = env.OUTBOUND_WEBHOOK_SECRET ?? env.CHAT_LEAD_WEBHOOK_SECRET;
if (!url || !secret) return null;  // → status = 'disabled'
```

**Ni `OUTBOUND_WEBHOOK_URL` ni `CHAT_LEAD_WEBHOOK_URL` ne sont definis dans `.env`.**

### Impact par source webhook

| Source | Evenement | Dispatch vers | Statut prod |
|--------|-----------|---------------|-------------|
| `from-wizard-step2` | `lead.step2_completed` | **Endpoints admin** (principal) + Outbound URL (fallback) | **OK** (via endpoints admin) |
| `from-wizard-step1-abandon` | `lead.step1_abandoned` | Outbound URL seulement | **DISABLED** |
| `from-chat-lead` | `chat_lead.created` | Outbound URL seulement | **DISABLED** |
| `from-cart-abandon` | `cart.abandoned` | Outbound URL seulement | **DISABLED** |
| `from-order` | `order.created` | Outbound URL seulement | **DISABLED** |
| `from-contact` | `contact.submitted` | Outbound URL seulement | **DISABLED** |

Seul `from-wizard-step2` fonctionne car il implemente un dispatch dual : il essaie d'abord les endpoints configures en admin (`webhookEndpoints` table), puis fallback vers l'URL outbound. Les 5 autres sources n'implementent que le chemin outbound URL.

---

## 2. Diagnostic : leads conversation sans webhook

### Flux de creation d'un lead conversation (`inline-contact`)

```
Utilisateur tape son numero dans le chat
  → detectInlineContact() detecte un numero
  → leadRepo.create({ triggerReason: 'inline-contact', ... })
  → notifyHotLead()  (Slack seulement)
  → AUCUN webhook dispatche
```

L'orchestrator (`chat/services/orchestrator.ts`, lignes 464-518) cree le lead en DB et envoie une notification Slack, mais **ne dispatche aucun webhook**.

Le webhook ne sera envoye que si l'utilisateur soumet le formulaire formel (upgrade du lead `inline-contact`), ce qui n'arrive pas toujours.

### Pourquoi le scanner step-1-abandon ne rattrape pas ces leads

Le scanner (`lead-step1-abandon-scanner.ts`) filtre sur :

```sql
WHERE phone_e164 IS NOT NULL
  AND lead_captured_at IS NOT NULL   ← PROBLEME
  AND address_completed_at IS NULL
  AND purchased_at IS NULL
  AND step1_abandon_webhook_at IS NULL
  AND lead_captured_at < cutoff_idle
  AND lead_captured_at > cutoff_max_age
```

Les leads `inline-contact` ont **`leadCapturedAt = null`** car ce champ n'est pas rempli lors de la creation automatique. Le scanner les ignore donc.

### Schema : `leadCapturedAt` par source de creation

| Source | `leadCapturedAt` | Webhook immediate ? |
|--------|-------------------|---------------------|
| Wizard step 1 (`wizardLeadRepo.createWizardLead`) | **Set** (`now()`) | Non (attend step-2-abandon scanner) |
| Chat form (`leadRepo.create` via `/api/chat/lead/contact`) | **Null** | Oui (`dispatchChatLeadWebhook`) |
| Inline-contact auto (`leadRepo.create` via orchestrator) | **Null** | **Non** (seulement Slack) |

---

## 3. Diagnostic : leads wizard incomplets non transmis

### Mecanisme prevu

Le systeme implemente un timer de 5 minutes (configurable via `lead.step1_abandon_timeout_minutes`) :

1. Le cron tick tourne chaque minute (systemd timer)
2. Le scanner cherche les leads wizard avec `leadCapturedAt IS NOT NULL` mais `addressCompletedAt IS NULL`
3. Apres 5 minutes d'inactivite, le webhook `lead.step1_abandoned` est dispatche
4. Le lead est marque (`step1AbandonWebhookAt`) pour eviter les doublons

### Pourquoi ca ne fonctionne pas

Le scanner tourne correctement et trouve les leads candidats (5 leads trouves dans les logs). Cependant, chaque dispatch retourne `disabled` car `OUTBOUND_WEBHOOK_URL` n'est pas configure.

De plus, le scanner ne dispatche que via `dispatchOutbound()`, pas vers les endpoints admin. Mme si l'URL etait configuree, les webhooks n'atteindraient pas les endpoints admin configures dans l'interface.

---

## 4. Recommandations

### P0 — Configurer `OUTBOUND_WEBHOOK_URL`

Ajouter dans `.env` :

```
OUTBOUND_WEBHOOK_URL=https://votre-endpoint.com/webhook
OUTBOUND_WEBHOOK_SECRET=<secret-hmac-sha256>
```

Cela debloquera immediatement les 5 sources webhook actuellement `disabled`.

### P1 — Dispatch des leads `inline-contact` vers les endpoints admin

Les leads crees automatiquement via `inline-contact` (conversation) ne declenchent aucun webhook. Deux options :

**Option A** : Dispatcher un webhook immediat lors de la creation `inline-contact` dans l'orchestrator (comme pour `chat_lead.created`), puis un second webhook `lead.step1_abandoned` si l'utilisateur ne finalise pas.

**Option B** : Inclure les leads `inline-contact` dans le scanner step-1-abandon en modifiant le filtre SQL :

```sql
-- Avant
AND lead_captured_at IS NOT NULL

-- Apres (utiliser created_at comme fallback)
AND COALESCE(lead_captured_at, created_at) IS NOT NULL
```

Et mettre a jour la requete de cutoff :

```sql
-- Avant
AND lead_captured_at < cutoff_idle
AND lead_captured_at > cutoff_max_age

-- Apres
AND COALESCE(lead_captured_at, created_at) < cutoff_idle
AND COALESCE(lead_captured_at, created_at) > cutoff_max_age
```

### P2 — Etendre le dispatch vers les endpoints admin

Actuellement, seul `from-wizard-step2` dispatche vers les endpoints admin (`webhookEndpoints` table). Les 5 autres sources n'utilisent que l'URL outbound. Ajouter le dispatch admin a chaque source permettrait :

- De fonctionner meme sans `OUTBOUND_WEBHOOK_URL`
- De supporter plusieurs endpoints avec des evenements filtres
- De respecter la configuration admin comme source de verite

### P3 — Eviter le scan repetitif des leads `disabled`

Actuellement, les leads dont le dispatch retourne `disabled` ne sont pas marques (`step1AbandonWebhookAt`), donc ils sont rescannes chaque minute. Cela gaspille des ressources DB. Considerer :

- Ajouter un compteur de tentatives `disabled` et arreter de scanner apres N tentatives consecutives
- Ou marquer les leads `disabled` avec un timestamp pour les exclure temporairement du scan

---

## 5. Architecture detaillee

### Sources webhook et chemins de dispatch

```
┌─────────────────────────────────────────────────────────────────┐
│                    WEBHOOK SOURCES                               │
├─────────────────────────┬───────────────────────────────────────┤
│ Source                  │ Chemin de dispatch                      │
├─────────────────────────┼───────────────────────────────────────┤
│ from-wizard-step2       │ endpoints admin → outbound URL        │
│ from-wizard-step1-abandon│ outbound URL seulement               │
│ from-chat-lead          │ outbound URL seulement                │
│ from-cart-abandon       │ outbound URL seulement                │
│ from-order              │ outbound URL seulement                │
│ from-contact            │ outbound URL seulement                │
└─────────────────────────┴───────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    TRIGGERS                                       │
├──────────────────────────────┬──────────────────────────────────┤
│ Evenement                    │ Declencheur                       │
├──────────────────────────────┼──────────────────────────────────┤
│ lead.step2_completed         │ PATCH /api/checkout/lead/:id/address (immediat) │
│ lead.step1_abandoned        │ Cron tick (5 min timeout)          │
│ chat_lead.created           │ POST /api/chat/lead/contact (immediat) │
│ cart.abandoned              │ Cron tick (30 min idle)            │
│ order.created               │ POST /api/checkout/order (immediat) │
│ contact.submitted           │ POST /api/contact (immediat)       │
└──────────────────────────────┴──────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    PROBLEME : inline-contact                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Chat utilisateur                                                │
│  └─ detectInlineContact() → leadRepo.create()                   │
│     ├─ Slack notification (notifyHotLead)  ✅ OK                │
│     └─ Webhook dispatch                    ❌ MANQUANT          │
│                                                                  │
│  Si upgrade via formulaire formel :                             │
│  └─ POST /api/chat/lead/contact                                │
│     └─ leadRepo.upgrade() → dispatchChatLeadWebhook()  ✅ OK   │
│                                                                  │
│  Si PAS d'upgrade :                                              │
│  └─ leadCapturedAt = NULL → scanner step-1-abandon IGNORÉ      │
│  └─ Aucun webhook JAMAIS envoye                         ❌ BUG  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Fichiers cles

| Fichier | Role |
|---------|------|
| `apps/web/src/lib/webhooks/outbound/dispatcher.ts` | Dispatcher unifie (URL outbound seulement) |
| `apps/web/src/lib/webhooks/outbound/settings.ts` | Settings timeouts (5 min par defaut) |
| `apps/web/src/lib/webhooks/outbound/lead-step1-abandon-scanner.ts` | Scanner cron step-1-abandon |
| `apps/web/src/lib/webhooks/outbound/cart-abandon-scanner.ts` | Scanner cron cart-abandon |
| `apps/web/src/lib/webhooks/outbound/sources/from-wizard-step1-abandon.ts` | Builder payload step-1-abandon |
| `apps/web/src/lib/webhooks/outbound/sources/from-chat-lead.ts` | Builder payload chat-lead |
| `apps/web/src/lib/webhooks/outbound/sources/from-wizard-step2.ts` | Builder payload step-2 (seul avec dispatch admin) |
| `apps/web/src/lib/chat/services/orchestrator.ts` | Creation auto inline-contact (pas de webhook) |
| `apps/web/src/lib/chat/repos/lead.ts` | Repo chat-lead (leadCapturedAt pas set a la creation) |
| `apps/web/src/lib/checkout/repos/lead-repo.ts` | Repo wizard-lead (leadCapturedAt = now()) |
| `apps/web/src/app/api/cron/tick/route.ts` | Cron tick orchestrateur |
| `apps/web/src/lib/chat/db/schema.ts` | Schema chat_lead (leadCapturedAt nullable) |
| `/etc/systemd/system/femiglow-cron-tick.timer` | Systemd timer (chaque minute) |

---

## 6. Logs de production pertinents

```
# Scanner step-1-abandon : trouve des leads mais dispatch disabled
outbound.webhook.disabled  source=lead-step1-abandon  sourceId=cl_9f2cag4betyu33wq  reason=no-endpoint-configured
outbound.webhook.disabled  source=lead-step1-abandon  sourceId=cl_kknc45v7v6eg4qp5  reason=no-endpoint-configured
outbound.webhook.disabled  source=lead-step1-abandon  sourceId=cl_02jswlbmu206noih  reason=no-endpoint-configured
outbound.webhook.disabled  source=lead-step1-abandon  sourceId=cl_pgkl4ywgse1yx5t6  reason=no-endpoint-configured
outbound.webhook.disabled  source=lead-step1-abandon  sourceId=cl_828vsmds8n72y8pa  reason=no-endpoint-configured

# Chat-lead webhook : aussi disabled
outbound.webhook.disabled  source=chat-lead  sourceId=cl_l6vysw1dmle0oazz  reason=no-endpoint-configured

# Step-2 webhook : fonctionne via endpoints admin
outbound.webhook.lead-step2.dispatch_result  leadId=cl_2vsfynb8gvvahtmk  status=sent  responseStatus=200
outbound.webhook.lead-step2.dispatch_result  leadId=cl_u1xjxg1ptz8r8rsn  status=sent  responseStatus=200
outbound.webhook.lead-step2.dispatch_result  leadId=cl_jojazleov4jx3wi7  status=sent  responseStatus=200
outbound.webhook.lead-step2.dispatch_result  leadId=cl_v23qsqzyilomjug4  status=sent  responseStatus=200
```