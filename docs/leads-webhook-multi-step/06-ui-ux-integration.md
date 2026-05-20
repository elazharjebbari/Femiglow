# 6. Intégration UI / UX — admin dashboard

## 6.1 Principes directeurs

| # | Principe | Application concrète |
|---|---|---|
| 1 | **Modifier > créer** | On enrichit `/admin/leads`, `/admin/leads/[id]`, `/admin/tracking/settings` plutôt que créer 4 nouvelles pages. Une seule nouvelle route : `/admin/tracking/webhooks/logs` (viewer logs outbound). |
| 2 | **Charte stricte** | Palette `stone` (neutre) + `emerald` (succès) + `rose` (erreur) + `amber` (warning). Pas de couleur nouvelle. Composants stylistiques copiés de `ConsentBannerSettingsForm`, `StatusBadge` emails, `Kpi` cards. |
| 3 | **Densité maîtrisée** | Pas de surcharge visuelle : KPIs en haut, table dense au centre, détail au clic (drawer lazy-load). Aucune table > 6 colonnes. |
| 4 | **Sauvegarde immédiate** | Toggles settings sans bouton "Sauvegarder" séparé — pattern `ConsentBannerSettingsForm`. |
| 5 | **Drawer > nouvelle page** | Pour les détails (historique webhook, payload JSON), on utilise un drawer lazy-load (pattern `ConversationQuickView`). |
| 6 | **Accessibilité** | `aria-label` sur tous les boutons icônes, `role=dialog` + `aria-modal` sur drawers, Esc ferme, focus trap, navigation ↑↓ dans tables. |
| 7 | **Charge progressive** | KPIs en SSR depuis la même requête que la table (un seul fetch). Drawer fetch on-open uniquement. |

## 6.2 Carte des écrans (avant / après)

```
EXISTANT (inchangé en structure)              ENRICHISSEMENT M6
─────────────────────────────────────────     ────────────────────────────
/admin/leads                                  + 4 KPI cards en haut
  └─ table leads (5 colonnes)                 + 2 colonnes table (Parcours, Webhook)
                                              + Mini funnel visualization
                                              + Filtre supplémentaire (completion, webhook status)

/admin/leads/[id]                             + Section "Parcours wizard" (timeline 4 steps)
  └─ identité + commande + historique         + Section "Livraisons webhook" (carte résumé)
                                              + Bouton "Rejouer" par tentative failed

/admin/tracking/settings                      + Section "Leads → Webhook outbound"
  └─ environnement + consent + rétention      → toggles, timeout, health badge, test button

NOUVEAU (1 seule page)
─────────────────────────────────────────
/admin/tracking/webhooks/logs                 Liste paginée des outbound_webhook_log
                                              avec filtres + retry actions
```

## 6.3 Wireframe : `/admin/leads` (enrichi)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Leads (1,247)                                       [+ Nouveau lead] │
│  Suivi multi-étapes du wizard + webhook outbound                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─ KPI 24h ──────────────────────────────────────────────────────┐  │
│  │  ╭────────────╮ ╭────────────╮ ╭────────────╮ ╭────────────╮  │  │
│  │  │ Step 1     │ │ Step 2     │ │ Achats     │ │ Abandons   │  │  │
│  │  │  142       │ │  93        │ │  41        │ │  49        │  │  │
│  │  │  100%      │ │ 65% (vs S1)│ │ 29% (vs S1)│ │ 34% (vs S1)│  │  │
│  │  ╰────────────╯ ╰────────────╯ ╰────────────╯ ╰────────────╯  │  │
│  │  (cliquer sur chaque KPI = filtre la table)                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─ Funnel ──────────────────────────────────────────────────────┐   │
│  │  [████████████████████████████████████ 100%]  Step 1 (142)    │   │
│  │  [████████████████████████             65%]   Step 2 (93)     │   │
│  │  [██████████                           29%]   Achat   (41)    │   │
│  │  Drop-off principal: Step 1 → Step 2 (49 leads, 34%)          │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─ Filtres ─────────────────────────────────────────────────────┐   │
│  │  [🔍 nom / phone / email]  [Statut ▼] [Parcours ▼] [Webhook ▼] │   │
│  │  [Tri ▼ Date desc]                                             │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─ Table ───────────────────────────────────────────────────────┐   │
│  │ Identité       │ Contact     │ Parcours     │ Webhook │ Date   │ │
│  │ ──────────────┼─────────────┼──────────────┼─────────┼────── │ │
│  │ Sara Mansouri │ 0661234567  │ ●●● 100% achat│ ✓ sent  │ 14/05  │ │
│  │ Youssef A.    │ 0612345678  │ ●●○ 66% step2 │ ⏱ pend  │ 14/05  │ │
│  │ Karim B.      │ 0691111222  │ ●○○ 33% step1 │ ⚠ aband │ 14/05  │ │
│  │ Anonyme       │ 0655555555  │ ●○○ aband     │ ✓ aband │ 13/05  │ │
│  │ Hicham F.     │ 0644444444  │ ●●○ 70% step2 │ ✗ fail  │ 13/05  │ │
│  └────────────────────────────────────────────────────────────────┘   │
│  Page 1 / 25  ·  Affichage 50 / page                                  │
└──────────────────────────────────────────────────────────────────────┘
```

### Légende cellule "Parcours"

```
●●● 100% achat  →  3 dots remplis, label "achat"  (purchase OK)
●●○  66% step2  →  2 dots remplis, label "step2"  (validé adresse, pas d'achat)
●○○  33% step1  →  1 dot rempli, label "step1"   (juste nom+phone)
●○○  aband     →  1 dot rempli, label rouge "aband" (timeout webhook envoyé)
```

Composant : `<JourneyDots steps={3} completed={2} status="step2" />`

### Légende cellule "Webhook"

```
✓ sent   →  emerald   (200 OK, dernier event)
⏱ pend   →  amber     (en cours / queue)
⚠ aband  →  amber     (step1_abandoned envoyé — pas un échec, juste l'auto-flush)
✗ fail   →  rose      (3 retries échoués)
⊘ skip   →  stone     (phone invalide ou consent absent)
```

Composant : `<WebhookStatusBadge status="sent" lastEvent="lead.step2_completed" />`

Au clic sur le badge → ouvre `LeadWebhookHistoryDrawer` (cf. §6.6).

## 6.4 Wireframe : `/admin/leads/[id]` (enrichi)

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Leads                                                              │
│                                                                       │
│  Sara Mansouri                                       [Statut: contacté ▼]
│  +212 6 61 23 45 67  ·  sara@example.com  ·  Source: chat_widget      │
│  Créée 14/05/2026 10:01  ·  Session cs_abc123                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─ Parcours wizard ─────────────────────────────────────────────┐    │
│  │                                                                │    │
│  │     ┌──┐     ┌──┐     ┌──┐     ┌──┐                          │    │
│  │     │ 1│─────│ 2│─────│ 3│─────│✓ │                          │    │
│  │     └──┘     └──┘     └──┘     └──┘                          │    │
│  │   Lead     Adresse  Paiement  Achat                          │    │
│  │   ✓        ✓        ✓         —                              │    │
│  │   10:01    10:04    10:07     —                              │    │
│  │   100%     90%      —         —                              │    │
│  │                                                                │    │
│  │   ► Complétion : 75% (3/4 étapes)                             │    │
│  │   ► Quitté à : Achat (étape 4)                                │    │
│  │   ► Durée parcours : 6min 12s                                 │    │
│  │   ► Délai entre étapes : 2min30, 3min42                       │    │
│  │   ► Données saisies : nom, phone, email, adresse, ville       │    │
│  │   ► Données manquantes : néant (tout fourni)                  │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─ Livraisons webhook ─────────────────────────[Voir détail →]┐     │
│  │                                                              │     │
│  │  ✓ lead.step2_completed   14/05 10:04  sent     1× · 234ms   │     │
│  │  ⏱ order.completed       —          pending   —    · —       │     │
│  │  ✗ chat_lead.created     14/05 10:01  failed  3× · 8003ms    │     │
│  │     ↳ HTTP 503 Service Unavailable                            │     │
│  │     [Rejouer]                                                 │     │
│  │                                                              │     │
│  │  → Cliquer sur une ligne pour voir le payload + tentatives    │     │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─ Commande ────────────────────────────────────────────────────┐    │
│  │  ... (existant, inchangé) ...                                 │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─ Historique ──────────────────────────────────────────────────┐    │
│  │  ... (existant, inchangé) ...                                 │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─ Ajouter une note ────────────────────────────────────────────┐    │
│  │  ... (existant, inchangé) ...                                 │    │
│  └────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

### Détails composant "Parcours wizard"

```tsx
<JourneyTimeline
  steps={[
    { key: 'lead',     label: 'Lead',     done: true,  at: '2026-05-14T10:01:00Z', dataPct: 100 },
    { key: 'address',  label: 'Adresse',  done: true,  at: '2026-05-14T10:04:00Z', dataPct: 90 },
    { key: 'payment',  label: 'Paiement', done: true,  at: '2026-05-14T10:07:00Z', dataPct: null },
    { key: 'order',    label: 'Achat',    done: false, at: null, dataPct: null },
  ]}
  abandonedAt="order"
  durationSec={372}
/>
```

- Cercles remplis stone-900 si `done`, vides border-stone-300 sinon
- Lignes entre cercles : `emerald-500` si transition OK, `stone-200` si non-faite
- Si `abandonedAt`, le cercle de l'étape abandonnée a un anneau `ring-2 ring-amber-300`
- `dataPct` = % de champs remplis vs attendus à cette étape (cf. §6.7 calcul)

### Composant "Livraisons webhook"

```tsx
<WebhookSummaryList
  leadId={lead.id}
  events={[
    { name: 'lead.step2_completed', status: 'sent',    attempts: 1, latencyMs: 234, at: '...' },
    { name: 'order.completed',      status: 'pending', attempts: 0, latencyMs: null, at: null },
    { name: 'chat_lead.created',    status: 'failed',  attempts: 3, latencyMs: 8003, at: '...', lastError: 'HTTP 503 Service Unavailable' },
  ]}
  onRetry={(eventName) => { /* POST /api/admin/webhooks/retry */ }}
  onOpenDetail={() => setDrawerOpen(true)}
/>
```

## 6.5 Wireframe : `/admin/tracking/settings` (enrichi)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Tracking · Settings                                                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ... (sections existantes inchangées) ...                             │
│   - Environnement                                                     │
│   - Bandeau consentement                                              │
│   - Rétention & CRON                                                  │
│   - Debug global                                                      │
│                                                                       │
│  ════════════════════════════════════════════════════════════════════ │
│                                                                       │
│  ┌─ NOUVEAU : Leads → Webhook outbound ──────────────────────────┐    │
│  │                                                                │    │
│  │  Health  🟢 Système OK   [Détails ▼]                          │    │
│  │  ┌────────────────────────────────────────────────────────┐   │    │
│  │  │  ✓ OUTBOUND_WEBHOOK_URL configurée                      │   │    │
│  │  │  ✓ Secret signé HMAC (32 chars+)                        │   │    │
│  │  │  ✓ Endpoint accessible (dernier check il y a 2min)      │   │    │
│  │  │  ✓ Success rate 24h : 97.2% (143/147)                   │   │    │
│  │  │  ⚠ 4 failed, dont 1 retryable [Voir →]                  │   │    │
│  │  └────────────────────────────────────────────────────────┘   │    │
│  │                                                                │    │
│  │  ── Configuration ────────────────────────────────────────    │    │
│  │                                                                │    │
│  │  ☑ Webhook step 2 activé                                       │    │
│  │     Envoyer dès que l'adresse est validée (Flow A nominal,    │    │
│  │     pas attendre l'achat final).                              │    │
│  │                                                                │    │
│  │  ☑ Scanner abandon step 1 activé                               │    │
│  │     Si pas de step 2 dans le délai ci-dessous, on envoie       │    │
│  │     automatiquement le lead au CRM avec les infos minimales.   │    │
│  │                                                                │    │
│  │  Délai abandon step 1   [  5  ] minutes                        │    │
│  │     Entre 1 et 60 minutes. Recommandé entre 5 et 15.           │    │
│  │     Trop court = faux positifs (user lent). Trop long = lead   │    │
│  │     froid à la réception côté CRM.                             │    │
│  │                                                                │    │
│  │  ── Endpoint (variables d'environnement) ─────────────────     │    │
│  │  URL       https://crm.example.com/femiglow/hook               │    │
│  │  Secret    ●●●●●●●●●●●●●●●●  [Afficher temporairement]         │    │
│  │  Modification : éditer .env.production puis restart service    │    │
│  │                                                                │    │
│  │  ── Test ─────────────────────────────────────────────────     │    │
│  │  [Envoyer un payload de test au CRM]                           │    │
│  │  Envoie un payload dummy avec id=test:<timestamp>. Permet de   │    │
│  │  valider que la chaîne réseau marche end-to-end.              │    │
│  │                                                                │    │
│  │  ── Logs récents [Voir tous →] ───────────────────────────     │    │
│  │  ✓ lead.step2_completed   cl_xxx   sent     14/05 10:24       │    │
│  │  ✓ order.completed        cl_yyy   sent     14/05 10:18       │    │
│  │  ✗ chat_lead.created      cl_zzz   failed   14/05 09:52       │    │
│  │  ⏱ lead.step1_abandoned   cl_www   pending  14/05 09:47       │    │
│  └────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

Tous les toggles utilisent le pattern `ConsentBannerSettingsForm` (sauvegarde immédiate + petit feedback ✓ ou ✗).

## 6.6 Wireframe : `LeadWebhookHistoryDrawer` (drawer lazy-load)

```
                            ┌──────────────────────────────────────┐
                            │  ←  Historique webhook · Sara M.     │
                            ├──────────────────────────────────────┤
                            │                                       │
                            │  Event   lead.step2_completed         │
                            │  Status  ✓ sent                       │
                            │  Latency 234ms                         │
                            │  HTTP    200                           │
                            │  Idempotency-Key                       │
                            │   lead-step2:cl_abc123                 │
                            │                                       │
                            │  ── Tentatives ──────────────────     │
                            │  #1  14/05 10:24:31  ✓ 234ms  200     │
                            │                                       │
                            │  ── Payload envoyé  [Copier]  ──     │
                            │  ┌────────────────────────────────┐   │
                            │  │ {                              │   │
                            │  │   "id": "lead-step2:cl_xxx",   │   │
                            │  │   "full_name": "Sara M.",      │   │
                            │  │   "phone": "0661234567",       │   │
                            │  │   "city": "Marrakech",         │   │
                            │  │   "address": "12 Rue Al ...",  │   │
                            │  │   "conversation": [...]        │   │
                            │  │ }                              │   │
                            │  └────────────────────────────────┘   │
                            │                                       │
                            │  ── Signature HMAC ───────────────    │
                            │  sha256=a3f8b2...e7d4 (vérifiée)       │
                            │                                       │
                            │  ── Actions ──────────────────────    │
                            │  [Rejouer avec nouvelle clé]           │
                            │  ↳ Génère idempotency-key:retry-N      │
                            │    pour forcer Trello à reconsommer.   │
                            │                                       │
                            └──────────────────────────────────────┘
```

Pattern : copié de `ConversationQuickView`, slide-in droite, Esc ferme, focus trap.

État `failed` → bouton "Rejouer" visible, prominent (emerald). État `sent` → bouton grisé "Déjà envoyé (rejouer avec nouvelle clé ?)".

## 6.7 Wireframe : `/admin/tracking/webhooks/logs` (nouvelle page)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Tracking · Webhooks · Logs                                           │
│  outbound_webhook_log (157 entrées sur 30 derniers jours)              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─ Filtres ─────────────────────────────────────────────────────┐   │
│  │  [🔍 id / event / source_id]                                   │   │
│  │  [Source ▼]  [Event ▼]  [Status ▼]  [Date ▼ 7 derniers jours] │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─ KPI ─────────────────────────────────────────────────────────┐   │
│  │  Total 157  ·  Sent 143 (91%)  ·  Failed 4 (3%)  ·  Skipped 7 │   │
│  │  Latence p50 187ms  ·  p95 892ms  ·  p99 2401ms               │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─ Table ───────────────────────────────────────────────────────┐   │
│  │ Date         │ Event           │ Source ID  │ Status │ ⏱  │ ↻ │  │
│  │ ─────────────┼─────────────────┼────────────┼────────┼───┼───│  │
│  │ 14/05 10:24  │ lead.step2_c... │ cl_abc...  │ ✓ sent │234│ —  │  │
│  │ 14/05 09:52  │ chat_lead.cre.. │ cl_xyz...  │ ✗ fail │8003│[↻]│  │
│  │ 14/05 09:47  │ lead.step1_a... │ cl_www...  │ ⏱ pend │ — │ —  │  │
│  └────────────────────────────────────────────────────────────────┘   │
│  Page 1 / 4  ·  50 / page                                              │
└──────────────────────────────────────────────────────────────────────┘
```

Au clic sur une ligne → ouvre le même `LeadWebhookHistoryDrawer` que depuis `/admin/leads/[id]`.

## 6.8 Composants à créer

| Composant | Fichier (proposé) | Props | Réutilise |
|---|---|---|---|
| `JourneyDots` | `components/admin/leads/JourneyDots.tsx` | `{ steps: number, completed: number, status: 'step1' \| 'step2' \| 'step3' \| 'aband' \| 'done' }` | Pas de dep |
| `JourneyTimeline` | `components/admin/leads/JourneyTimeline.tsx` | `{ steps: JourneyStep[], abandonedAt?: string, durationSec?: number }` | StatusBadge interne |
| `WebhookStatusBadge` | `components/admin/webhooks/WebhookStatusBadge.tsx` | `{ status: WebhookStatus, lastEvent?: string, attempts?: number }` | Pattern `StatusBadge` emails |
| `WebhookSummaryList` | `components/admin/webhooks/WebhookSummaryList.tsx` | `{ leadId, events: WebhookEvent[], onRetry, onOpenDetail }` | `WebhookStatusBadge` |
| `LeadWebhookHistoryDrawer` | `components/admin/leads/LeadWebhookHistoryDrawer.tsx` | `{ leadId, eventName?, open, onClose }` | Pattern `ConversationQuickView` / `InsightsDrawer` |
| `LeadFunnelMini` | `components/admin/leads/LeadFunnelMini.tsx` | `{ stats: { step1: n, step2: n, purchase: n, abandon: n } }` | Pure SVG/CSS, no chart lib |
| `LeadKpiCards` | `components/admin/leads/LeadKpiCards.tsx` | `{ stats }` | Pattern `Kpi` emails |
| `WebhookHealthBadge` | `components/admin/webhooks/WebhookHealthBadge.tsx` | `{ summary: HealthSummary }` | Pattern `HealthBadge` emails |
| `LeadsWebhookSettingsForm` | `components/admin/tracking/LeadsWebhookSettingsForm.tsx` | `{ initialSettings }` | Pattern `ConsentBannerSettingsForm` |
| `WebhookLogsTable` | `components/admin/webhooks/WebhookLogsTable.tsx` | `{ rows, onRowClick }` | Pattern table `/admin/webhooks/[id]/deliveries` |

## 6.9 Composants existants à réutiliser sans modif

| Existant | Chemin | Usage M6 |
|---|---|---|
| `AdminShell` | `components/admin/AdminShell.tsx` | Wrap les pages `/admin/leads` |
| `TrackingShell` | `components/admin/tracking/TrackingShell.tsx` | Wrap `/admin/tracking/settings` + `/admin/tracking/webhooks/logs` (nouvel onglet "Logs") |
| `LeadStatusMenu` | `components/admin/LeadStatusMenu.tsx` | Inchangé |
| `LeadNoteForm` | `components/admin/LeadNoteForm.tsx` | Inchangé |
| `ConversationQuickView` | `components/admin/chat/ConversationQuickView.tsx` | Référence pattern drawer |
| `InsightsDrawer` | `components/admin/analytics/insights/InsightsDrawer.tsx` | Référence pattern drawer animation |
| `GlobalCommandPalette` | `components/admin/emails/GlobalCommandPalette.tsx` | Étendre avec 2 commandes : "Settings webhooks leads", "Logs webhooks" |
| `Toast` provider | `components/admin/legal/Toast.tsx` | Feedback succès/erreur retry |

## 6.10 Backend API additions

| Méthode + Route | Rôle | Réponse |
|---|---|---|
| `GET /api/admin/leads` *(existante, enrichir)* | Liste paginée + filtres | Inclure `journey` (step1/2/3 done + dataPct) + `webhookSummary` (lastStatus, lastEvent) par lead |
| `GET /api/admin/leads/kpi` *(nouveau)* | Stats 24h pour KPI cards | `{ step1, step2, purchase, abandon, since }` |
| `GET /api/admin/leads/funnel` *(nouveau)* | Stats funnel 7j | `{ step1, step2, purchase, dropoffAfterStep1, dropoffAfterStep2 }` |
| `GET /api/admin/leads/[id]/webhook-history` *(nouveau)* | Historique webhooks d'un lead | `Array<WebhookLogRow>` (depuis `outbound_webhook_log` WHERE `source_id = leadId`) |
| `GET /api/admin/webhooks/logs` *(nouveau)* | Liste paginée logs outbound | `{ rows, total, page }` |
| `GET /api/admin/webhooks/health` *(nouveau)* | Health summary | `{ urlConfigured, secretConfigured, lastCheck, successRate24h, failedCount24h }` |
| `POST /api/admin/webhooks/retry` *(nouveau)* | Rejouer un webhook failed | Body: `{ logId }`. Génère idempotency `<orig>:retry-<n>`. |
| `POST /api/admin/webhooks/test` *(nouveau)* | Envoyer payload test | Body vide. Génère payload dummy + dispatch. |
| `PATCH /api/admin/tracking/settings` *(existante, enrichir)* | Update settings | Accepter clés `lead.step1_abandon_timeout_minutes`, `lead.step2_webhook_enabled`, `lead.step1_abandon_enabled` |

### Modèles de réponse — détails clés

```ts
// GET /api/admin/leads (extensions)
type LeadRow = {
  id: string;
  firstName: string;
  lastName?: string;
  phoneE164?: string;
  email?: string;
  status: LeadStatus;
  source?: string;
  createdAt: string;
  // NOUVEAU
  journey: {
    step1Done: boolean;
    step2Done: boolean;
    purchaseDone: boolean;
    dataPct: number;            // % champs remplis sur le total possible
    abandonedAt: 'step1' | 'step2' | 'step3' | null;
  };
  webhookSummary: {
    lastStatus: 'sent' | 'pending' | 'failed' | 'skipped' | 'aband' | null;
    lastEvent: string | null;
    failedCount: number;
    pendingCount: number;
  };
};

// GET /api/admin/leads/kpi
type LeadKpi = {
  since: string;                 // ISO timestamp début de fenêtre
  step1Total: number;
  step2Total: number;
  purchaseTotal: number;
  abandonTotal: number;
  step1ToStep2Pct: number;       // 0-100
  step2ToPurchasePct: number;
};

// GET /api/admin/leads/[id]/webhook-history
type WebhookHistoryEntry = {
  id: string;
  eventName: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped' | 'disabled';
  attempts: number;
  responseStatus: number | null;
  latencyMs: number | null;
  lastError: string | null;
  payload: unknown;               // raw JSON
  idempotencyKey: string;
  signature: string;              // sha256=<hex>
  createdAt: string;
  sentAt: string | null;
};
```

## 6.11 Frontend — organisation fichiers

```
components/admin/
├── leads/
│   ├── JourneyDots.tsx              (nouveau, ~40 lignes)
│   ├── JourneyTimeline.tsx          (nouveau, ~120 lignes)
│   ├── LeadFunnelMini.tsx           (nouveau, ~80 lignes)
│   ├── LeadKpiCards.tsx             (nouveau, ~60 lignes)
│   └── LeadWebhookHistoryDrawer.tsx (nouveau, ~200 lignes)
├── webhooks/
│   ├── WebhookStatusBadge.tsx       (nouveau, ~30 lignes — map status → badge)
│   ├── WebhookSummaryList.tsx       (nouveau, ~80 lignes)
│   ├── WebhookHealthBadge.tsx       (nouveau, ~100 lignes)
│   └── WebhookLogsTable.tsx         (nouveau, ~120 lignes)
└── tracking/
    └── LeadsWebhookSettingsForm.tsx (nouveau, ~150 lignes — extends ConsentBannerSettingsForm pattern)
```

```
app/admin/
├── leads/
│   ├── page.tsx                     (enrichir — +KPI cards, +funnel, +2 colonnes)
│   └── [id]/page.tsx                (enrichir — +sections wizard + webhook)
└── tracking/
    ├── settings/page.tsx            (enrichir — +section "Leads → Webhook")
    └── webhooks/
        └── logs/page.tsx            (nouveau — viewer outbound_webhook_log)
```

## 6.12 Connexions data → backend → frontend (séquence)

### Cas 1 : Affichage de la table `/admin/leads`

```
[Browser]                  [Next.js Server]              [Postgres]
   │                              │                          │
   ├─ GET /admin/leads?…page=1   │                          │
   │                              ├─ findLeadsWithJourney() ─▶│
   │                              │   SELECT chat_lead.*    │
   │                              │   LEFT JOIN orders      │
   │                              │   LEFT JOIN (last       │
   │                              │      outbound_webhook_  │
   │                              │      log par source_id) │
   │                              │◀──────── rows ─────────┤
   │                              ├─ buildJourney(row)      │
   │                              │   → step1Done, step2..  │
   │                              │   → dataPct calc        │
   │                              ├─ buildWebhookSummary(row)│
   │                              │   → lastStatus, …       │
   │                              │                          │
   │◀── HTML SSR (KPI + table) ──┤                          │
   │                              │                          │
   │  (au clic sur badge webhook)│                          │
   ├─ POST /admin/leads/[id]/    │                          │
   │      webhook-history fetch  │                          │
   │                              ├─ findWebhookHistory(id)─▶│
   │                              │   SELECT * FROM         │
   │                              │   outbound_webhook_log  │
   │                              │   WHERE source_id = $1  │
   │                              │   ORDER BY created_at   │
   │                              │◀───── entries ─────────┤
   │◀── JSON entries ────────────┤                          │
   │                              │                          │
   │  Render drawer avec entries  │                          │
```

### Cas 2 : Retry manuel d'un webhook failed

```
[Drawer "Rejouer"]         [Next.js Server]              [Dispatcher]            [Trello]
   │                              │                          │                       │
   ├─ POST /admin/webhooks/retry │                          │                       │
   │   { logId }                  │                          │                       │
   │                              ├─ findLog(logId) ────────▶│                       │
   │                              ├─ buildRetryPayload()    │                       │
   │                              │   idempotencyKey:        │                       │
   │                              │     "<orig>:retry-<n>"  │                       │
   │                              ├─ dispatchOutbound(…)────▶│                       │
   │                              │                          ├─ POST endpoint  ────▶│
   │                              │                          │◀───── 200 ────────────┤
   │                              │                          ├─ insert nouvelle ligne│
   │                              │                          │   outbound_webhook_   │
   │                              │                          │   log status='sent'   │
   │                              │◀──── result ────────────┤                       │
   │◀── { status: 'sent', … } ───┤                          │                       │
   │                              │                          │                       │
   │  Toast "Rejoué ✓"             │                          │                       │
   │  Refetch drawer content      │                          │                       │
```

### Cas 3 : Toggle settings step2_webhook_enabled

```
[Settings Form]            [Next.js Server]              [Postgres]
   │                              │                          │
   ├─ PATCH /admin/api/tracking/ │                          │
   │   settings                   │                          │
   │   { 'lead.step2_…': false } │                          │
   │                              ├─ setTrackingSetting()──▶│
   │                              │   INSERT … ON CONFLICT  │
   │                              │   UPDATE                │
   │                              ├─ invalidateLeadCache()  │
   │                              │◀────── ok ──────────────┤
   │◀── { ok: true } ────────────┤                          │
   │                              │                          │
   │  Toast "Sauvegardé ✓"        │                          │
   │  (effet immédiat sur les     │                          │
   │   prochains PATCH address)   │                          │
```

## 6.13 Calcul du `dataPct` par étape (UX précisément définie)

Pour afficher "90% des données saisies à l'étape 2", on définit une matrice champ × étape :

| Champ | Step 1 | Step 2 | Step 3 |
|---|---|---|---|
| firstName | ★ (obligatoire) | — | — |
| phone | ★ | — | — |
| consent | ★ | — | — |
| city | — | ★ | — |
| addressLine1 | — | ★ | — |
| postalCode | — | ☆ (optionnel) | — |
| notes | — | ☆ | — |
| email | — | ☆ | — |
| paymentMethod | — | — | ★ |

Formule pour une étape : `dataPct = (champs★ remplis + 0.5 × champs☆ remplis) / (champs★ totaux + 0.5 × champs☆ totaux) × 100`

Helper TypeScript :

```ts
function computeStepDataPct(lead: ChatLeadRow, step: 'lead' | 'address' | 'payment'): number {
  const REQUIRED: Record<typeof step, Array<keyof ChatLeadRow>> = {
    lead:    ['firstName', 'phoneE164', 'consentVersion'],
    address: ['shippingCity', 'shippingAddressLine1'],
    payment: ['preferredPaymentMethod'],
  };
  const OPTIONAL: Record<typeof step, Array<keyof ChatLeadRow>> = {
    lead:    [],
    address: ['shippingPostalCode', 'shippingNotes', 'email'],
    payment: [],
  };
  const reqFilled = REQUIRED[step].filter((k) => lead[k] != null).length;
  const optFilled = OPTIONAL[step].filter((k) => lead[k] != null).length;
  const reqTotal = REQUIRED[step].length;
  const optTotal = OPTIONAL[step].length;
  const score = reqFilled + 0.5 * optFilled;
  const max = reqTotal + 0.5 * optTotal;
  return max === 0 ? 100 : Math.round((score / max) * 100);
}
```

## 6.14 Accessibilité & micro-interactions

| Élément | Comportement |
|---|---|
| **Drawer (LeadWebhookHistoryDrawer)** | `role="dialog"`, `aria-modal="true"`, focus trap, Esc ferme, focus retourne au bouton qui a ouvert |
| **JourneyDots** | `role="img"` + `aria-label="Parcours : étape 2 sur 3 (66%)"` |
| **JourneyTimeline** | Liste sémantique `<ol>` avec `<li>` par étape ; chaque étape a `aria-current="step"` si c'est la dernière complétée |
| **WebhookStatusBadge** | `role="status"` + `aria-label="Webhook envoyé avec succès"` |
| **Bouton "Rejouer"** | Disabled pendant l'appel, spinner inline. Toast émeraude succès / rose erreur. Si succès, refresh la liste. |
| **KPI cliquable** | `role="button"`, `tabindex="0"`, Enter / Space active. Au clic → applique filtre URL param. |
| **Hover row table** | `bg-stone-50`, transition 100ms |
| **Funnel bars** | Animation width 0% → final sur mount (300ms ease-out). Tooltip au hover (% précis + n). |
| **Settings toggle** | Sauvegarde immédiate, feedback inline "Sauvegardé ✓" (vert) ou "Erreur ✗" (rouge) en 250ms timeout 3s |
| **CommandPalette** | Cmd-K ouvre, ajout 3 commandes : "Settings webhooks leads", "Voir logs webhook", "Rejouer derniers failed" |

## 6.15 Responsive

| Breakpoint | `/admin/leads` table | `/admin/leads/[id]` |
|---|---|---|
| Mobile (< 640px) | KPI cards en 2×2. Funnel masqué. Table devient cards stackées (1 lead = 1 card) avec parcours+webhook visibles. | Sections empilées, drawer fullscreen |
| Tablet (640-1024) | KPI cards en 4. Funnel visible. Table compacte (colonnes phone + email fusionnées). | Sections empilées |
| Desktop (> 1024) | Layout complet. | Layout complet. Drawer width 480px. |

## 6.16 Ajout au menu de navigation admin

Dans `AdminShell` (composant existant), le menu actuel a 15 entrées. Pas d'ajout — les pages enrichies sont accessibles via les entrées existantes :
- `/admin/leads` (déjà dans le menu)
- `/admin/tracking/settings` (sous-menu de tracking)
- `/admin/tracking/webhooks/logs` (sous-menu de tracking — à ajouter dans `TrackingShell` comme onglet "Logs")

## 6.17 Plan de migration UI (zéro downtime)

1. **Phase 1 (preview, derrière feature-flag)**
   - Déployer les nouvelles colonnes `journey`/`webhookSummary` dans la réponse `GET /api/admin/leads` mais ne pas les afficher si flag `admin.leads.journey_view` désactivé.
   - Tester en preview sur un sous-ensemble d'utilisateurs admin.

2. **Phase 2 (rollout général)**
   - Activer le flag pour tous les admins.
   - Monitor : temps de réponse de `/admin/leads` (cible : `+ < 50ms` par rapport à avant).

3. **Phase 3 (cleanup)**
   - Retirer le flag, code legacy.

## 6.18 Acceptance criteria UI

| # | Critère | Validation |
|---|---|---|
| AC-UI-01 | Charte respectée : que des couleurs `stone/emerald/rose/amber` | Inspection visuelle + grep des classes Tailwind dans nouveaux composants |
| AC-UI-02 | Aucune page nouvelle hors `/admin/tracking/webhooks/logs` | Audit routes admin |
| AC-UI-03 | `/admin/leads` ne dépasse pas 6 colonnes table | Visuel |
| AC-UI-04 | Drawer accessible : Esc ferme, focus trap OK | Test clavier |
| AC-UI-05 | KPI cards cliquables filtrent la table | Test fonctionnel |
| AC-UI-06 | Settings toggle sauvegarde sans bouton submit | Test fonctionnel |
| AC-UI-07 | Performance : `/admin/leads` SSR < 800ms p95 (200 leads) | Lighthouse / monitoring |
| AC-UI-08 | Mobile (< 640px) : table devient cards, KPI 2×2 | Visuel sur device |
| AC-UI-09 | Retry button feedback visuel (loading + toast) | Test fonctionnel |
| AC-UI-10 | Health badge affiche correctement les 3 états 🟢🟡🔴 | Test avec mocks |
