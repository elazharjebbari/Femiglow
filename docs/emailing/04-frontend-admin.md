# 04 — Frontend Admin

> Routes, composants, hooks, état, navigation côté `app/(admin)/admin/emails/*`. À lire avant de monter l'UI.

## §1 — Sitemap admin

```
/admin/emails                       ← Dashboard global (KPI, alertes)
├── transactional                   ← Liste outbox (table filtrable)
│   └── [id]                        ← Détail outbox + replay + raw payload
├── campaigns                       ← Liste campaigns (cards + filters)
│   ├── new                         ← Wizard (cf. 06-wizard-specification.md) ⭐
│   ├── [id]                        ← Détail campagne + métriques + actions
│   └── [id]/edit                   ← Wizard pré-rempli (reprise draft)
├── audiences                       ← Listes + segments
│   ├── new
│   ├── [id]                        ← Détail liste (subscribers, growth, opt-in mode)
│   └── [id]/subscribers
├── templates                       ← Studio templates
│   ├── new
│   └── [slug]                      ← Éditeur + preview + variables
├── automation                      ← Workflows
│   ├── new
│   └── [id]
├── settings                        ← From, ReplyTo, footer, SMTP test
└── listmonk                        ← Iframe wrapper (pour accès brut Listmonk)
    └── [[...path]]                 ← Tous les paths Listmonk
```

Toutes les routes sont **RSC** (rendu serveur) sauf les composants explicitement marqués `'use client'`.

## §2 — Navigation

### 2.1 — Sidebar entry

Modification : `apps/web/src/components/admin/layout/Sidebar.tsx` (chercher la liste existante). Ajouter entre `Leads` et `Analytics` :

```tsx
{
  label: 'Emails',
  href: '/admin/emails',
  icon: MailIcon,
  badge: () => fetchUnreadAlertsCount(), // optionnel : badge "3 bounces"
  children: [
    { label: 'Vue d\'ensemble', href: '/admin/emails' },
    { label: 'Transactionnel', href: '/admin/emails/transactional' },
    { label: 'Campagnes', href: '/admin/emails/campaigns' },
    { label: 'Audiences', href: '/admin/emails/audiences' },
    { label: 'Templates', href: '/admin/emails/templates' },
    { label: 'Automatisations', href: '/admin/emails/automation' },
    { label: 'Réglages', href: '/admin/emails/settings' },
    { label: 'UI Listmonk', href: '/admin/emails/listmonk', external: false },
  ],
}
```

### 2.2 — Tabs intra-section

`apps/web/src/app/(admin)/admin/emails/layout.tsx` :

```tsx
export default async function EmailsLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Emails</h1>
        <EmailsHealthBadge />
      </header>
      <EmailsTabs />
      <div className="min-h-[calc(100vh-12rem)]">{children}</div>
    </div>
  );
}
```

### 2.3 — Breadcrumbs

Toutes les sous-routes affichent un breadcrumb cliquable. Pattern existant : voir `app/(admin)/admin/products/layout.tsx`. Format : `Emails › Campagnes › Wizard – Étape 3/6`.

## §3 — Pages détaillées

### 3.1 — `page.tsx` — Dashboard

Layout 12-col mosaïque :

```
┌──────────────────────────────────────────────────────────────┐
│ HEADER : Emails [health badge SMTP OK / Listmonk OK]         │
│ TABS : Vue d'ensemble | Transactionnel | Campagnes | …       │
├──────────────────────────────────────────────────────────────┤
│ FilterBar : période 7j | 30j | 90j | Custom                  │
├──────────────────┬───────────────────────────────────────────┤
│ KPI tiles (6)    │  Big chart : Sent / Delivered (line)      │
│ - Envoyés        │                                           │
│ - Livrés (%)     │                                           │
│ - Ouverts (%)    │                                           │
│ - Cliqués (%)    │                                           │
│ - Bounces (%)    │                                           │
│ - Désabos (%)    │                                           │
├──────────────────┴───────────────────────────────────────────┤
│ Panel : Top templates par perf (table 5 cols)                │
│ Panel : Dernières campagnes (cards horizontales)             │
│ Panel : Outbox en attente (alertes si > 50 ou > 10 dlq)      │
│ Panel : Suppression list récent (table)                      │
└──────────────────────────────────────────────────────────────┘
```

Server-side queries : depuis `mv_email_kpi_daily`, `mv_email_template_perf`, `email_campaign_link` (10 derniers), `email_outbox WHERE status IN ('pending','failed','dlq')`, `email_suppression ORDER BY since DESC LIMIT 10`.

### 3.2 — `transactional/page.tsx` — Outbox

Table dense paginée. Colonnes :

| Col | Contenu | Tri | Filter |
|---|---|---|---|
| Date | `created_at` (formatée) | ✅ desc default | ✅ range |
| Template | `template` (chip coloré par catégorie) | ✅ | ✅ multi-select |
| Destinataire | `to_email` (lien copie) | ❌ | ✅ search |
| Sujet | `subject` (tronqué + tooltip) | ❌ | ❌ |
| Statut | `status` (StatusBadge) | ✅ | ✅ multi-select |
| Tentatives | `attempts / max_attempts` | ✅ | ❌ |
| Actions | `[Voir]` `[Retry]` (si failed) `[Détail]` | – | – |

Top : KPI cards (24h, 7j) : Sent, Delivered, Failed, DLQ.

### 3.3 — `transactional/[id]/page.tsx` — Détail outbox

Layout 2 colonnes :

```
┌─────────────────────────────────────────────────────────────┐
│ ⬅ Retour à Transactionnel                                   │
│ ENVOI #01HYW… — [delivered]                                  │
│                                                              │
│ ┌────────────────────────────────┬───────────────────────┐  │
│ │ MÉTADONNÉES                    │ APERÇU HTML           │  │
│ │ Date : 13 mai 2026, 16:00      │ ┌─────────────────┐   │  │
│ │ Template : contact-acknowled.. │ │  [iframe sand-  │   │  │
│ │ Destinataire : x@gmail.com     │ │   boxed render] │   │  │
│ │ Sujet : Merci pour votre …     │ │                 │   │  │
│ │ Idempotency : contact-ack:…    │ │                 │   │  │
│ │ Message-ID : <01HYW…@femi…>    │ └─────────────────┘   │  │
│ │ Stalwart Queue ID : 30701…     │                       │  │
│ │ Tentatives : 1 / 5             │ TIMELINE              │  │
│ │ Source : api.contact           │ • Queued     16:00:00 │  │
│ │                                │ • Sent       16:00:01 │  │
│ │ ACTIONS                        │ • Delivered  16:00:04 │  │
│ │ [Replay] [Copier payload]      │                       │  │
│ │ [Voir JSON brut] [Voir HTML]   │                       │  │
│ └────────────────────────────────┴───────────────────────┘  │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ PAYLOAD (JSON viewer)                                    ││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 3.4 — `campaigns/page.tsx` — Liste

```
┌─────────────────────────────────────────────────────────────┐
│ Campagnes                            [+ Nouvelle campagne]  │
│ [Filter status: All | Draft | Scheduled | Sent | Failed]    │
│                                                              │
│ ┌──── CampaignCard ────────────────────────────────────┐    │
│ │ ◯ Brouillon                          il y a 2 j      │    │
│ │ Bienvenue printemps 2026                             │    │
│ │ Subject: «✨ Découvre tes rituels printemps »        │    │
│ │ Audience: Newsletter (3 247 abos)                    │    │
│ │ Template: spring-welcome-v1                          │    │
│ │ [Continuer le brouillon ▸]                           │    │
│ └──────────────────────────────────────────────────────┘    │
│ ┌──── CampaignCard ────────────────────────────────────┐    │
│ │ ✓ Envoyée                            il y a 5 j      │    │
│ │ Solde hivernal -20 %                                 │    │
│ │ Subject: « Dernières heures pour profiter »          │    │
│ │ Envoyés 1 240 | Ouverts 412 (33 %) | Clics 78 (6 %)  │    │
│ │ [Voir métriques ▸]                                   │    │
│ └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 3.5 — `campaigns/new` — Wizard

→ **détaillé dans `06-wizard-specification.md`** (composant principal du dossier).

### 3.6 — `audiences/page.tsx`, `templates/page.tsx`, `automation/page.tsx`

Patterns analogues à `campaigns/`. Tables + filters + CTA "+ Nouveau".

### 3.7 — `settings/page.tsx`

Form contrôlé (server action) éditant `email_settings.json`. Champs :
- From (read-only, dérivé de l'env `MAIL_FROM`)
- Reply-To (éditable)
- Footer HTML (textarea + preview)
- Test SMTP (bouton → `POST /api/admin/emails/smtp/test`)
- Test envoi (form → envoie un mail à l'admin courant)
- Liens vers webmail Stalwart, Listmonk

### 3.8 — `listmonk/[[...path]]/page.tsx` — Iframe wrapper

```tsx
import { ListmonkFrame } from '@/components/admin/emails/ListmonkFrame';

export default function Page({ params }: { params: { path?: string[] } }) {
  const path = '/' + (params.path?.join('/') ?? 'admin');
  return <ListmonkFrame path={path} />;
}
```

L'iframe occupe `h-[calc(100vh-9rem)]`. Une mini-toolbar au-dessus permet de copier l'URL Listmonk native pour debug, et un bouton "Rafraîchir" (recharge l'iframe sans refresh page).

## §4 — Hooks data fetching

### 4.1 — `useEmailFilters` (URL + localStorage)

Pattern calqué sur `useAnalyticsFilters` (cf. `apps/web/src/lib/admin/`). Période + statut + template + audience.

```ts
export function useEmailFilters() {
  const [params, setParams] = useSearchParams();
  const period   = (params.get('period') ?? '7d') as Period;
  const status   = params.getAll('status');
  const template = params.get('template') ?? undefined;
  // … localStorage persistence
  const update = useCallback((patch: Partial<Filters>) => { … }, []);
  return { period, status, template, update };
}
```

### 4.2 — `useOutboxRow(id)` — optimistic updates

Pour le bouton "Retry" sur la liste : optimiste local + revalidation.

### 4.3 — `useCampaignWizard` — état wizard

→ détaillé dans `06-wizard-specification.md` §3.

### 4.4 — Server-side data layer

`apps/web/src/lib/admin/emails/queries.ts` :

```ts
export async function getEmailKpiDaily(opts: { period: Period }): Promise<KpiDaily[]> {
  return db.select().from(mvEmailKpiDaily).where(gte(mvEmailKpiDaily.day, startOfPeriod(opts.period)));
}

export async function getRecentOutbox(limit = 50, filter?: Filter): Promise<OutboxRow[]> {
  /* … */
}

export async function getCampaignById(id: string): Promise<CampaignDetail | null> {
  /* JOIN email_campaign_link + Listmonk API call */
}
```

### 4.5 — Server actions

`apps/web/src/lib/admin/emails/actions.ts` (Next.js server actions):

```ts
'use server';

import { revalidatePath } from 'next/cache';

export async function retryOutboxAction(id: string) {
  await requireAdmin();
  await db.update(emailOutbox).set({ status: 'pending', nextRetry: new Date(), attempts: 0, lastError: null }).where(eq(emailOutbox.id, id));
  await logAuditEvent({ category: 'mail.outbox', action: 'manual_retry', subjectId: id });
  revalidatePath('/admin/emails/transactional');
  revalidatePath(`/admin/emails/transactional/${id}`);
}

export async function createCampaignAction(input: NewCampaignInput) { /* … */ }
export async function scheduleCampaignAction(id: string, sendAt: Date) { /* … */ }
export async function cancelCampaignAction(id: string) { /* … */ }
```

## §5 — État UI

| Donnée | Lieu de stockage | Justification |
|---|---|---|
| Filtres (période, statut) | URL + localStorage | Partage URL, persistence |
| Brouillon wizard | Drizzle `email_campaign_link.status='draft'` + ID dans URL | Survit refresh, multi-device |
| Position step wizard | URL `?step=3` | Bookmarkable |
| Form values wizard | React state local (`useReducer`) + flush en draft sur step change | Réactivité + persistence |
| Sélection table | URL `?selected=01HY…,01HY…` | Partage état |
| Détail campagne | RSC (rechargé) + SWR pour metrics live | Fresh data |
| Iframe scroll position | natif iframe | Aucun effort nécessaire |

## §6 — Navigation entre admin FemiGlow et Listmonk iframe

L'iframe Listmonk peut **postMessage** vers son parent pour synchroniser l'URL :

```js
// CSS / JS injecté côté Listmonk (settings → custom HTML)
window.parent.postMessage({ type: 'listmonk:navigate', path: window.location.pathname }, window.location.origin);
```

Le composant `ListmonkFrame` écoute ces events et **synchronise** l'URL admin FemiGlow : `/admin/emails/listmonk/admin/campaigns` ↔ Listmonk path interne.

Bénéfice : un admin qui partage un lien `/admin/emails/listmonk/admin/campaigns/42` arrive **directement** sur la campagne 42 dans Listmonk.

## §7 — Responsive & a11y

- **Breakpoints** : mobile (≤768), tablet (769-1023), desktop (≥1024).
- L'admin emails est **prioritairement desktop**. Sur mobile, l'iframe Listmonk est masquée et une CTA renvoie vers la version desktop.
- Pour les tables, **scroll horizontal** propre avec sticky first column.
- Tous les **focus** suivent `tab-order` logique. Tous les boutons icon ont `aria-label`.
- **Skip-links** au top de chaque page : `[Aller à la table principale]`.
- **Live regions** (`aria-live="polite"`) pour les notifications toast de retry/cancel.
- **Reduced motion** : transitions wizard désactivées si `prefers-reduced-motion: reduce`.

## §8 — Performance

| Cible | Mesure |
|---|---|
| LCP dashboard `/admin/emails` | < 1.5 s (RSC + agrégats matview) |
| TTI wizard step 1 | < 600 ms |
| Time-to-first-row liste transactionnel | < 800 ms (limit 50, FOR UPDATE SKIP LOCKED hors path) |
| Iframe Listmonk first paint | < 1 s (loopback, gzip nginx) |
| Bundle JS supplémentaire (client) | < 80 KB gz pour wizard, < 30 KB gz pour le reste |

Stratégies :
- RSC partout sauf wizard step interactif.
- `dynamic` import pour le wizard (~40 KB gz) et le studio templates (~60 KB gz).
- Pas de tooling lourd : pas de Recharts/Sankey (déjà utilisé en analytics), réutilise `<KpiCard>`, `<ChartFrame>`.
- Skeleton sur chaque RSC (suspense boundary par panel).

## §9 — Stratégie de "loading / error / empty"

Chaque page expose 3 états + ses tests :

| État | Composant | Critère |
|---|---|---|
| Loading | `<Skeleton variant="kpi|chart|table" />` | `Suspense` boundary par panel |
| Error | `<ErrorBoundary fallback={<ErrorState code="MAIL-FETCH-FAIL" retry={…} />} />` | catch + Sentry tag `mailer.ui` |
| Empty | `<EmptyState illustration="emails-empty" message="…" cta="…" />` | par défaut quand 0 lignes |

Couvre :
- `<KpiTile>` : skeleton, error, empty (=0 chiffré)
- `<OutboxTable>` : 0 ligne → "Aucun envoi sur cette période"
- `<CampaignCard>` : 0 campagne → CTA "+ Nouvelle campagne"
- `<TemplatePreview>` : erreur render → "Render impossible — vérifier les variables"

Tous ces états sont testés dans `08-tests-strategy.md`.

## §10 — Références

- Pattern admin existant : `apps/web/src/app/(admin)/admin/analytics/`
- Composants partagés admin : `apps/web/src/components/admin/`
- Tokens Tailwind : `apps/web/tailwind.config.ts`
- Auth admin : `apps/web/src/lib/admin/auth.ts`
- Audit log : `apps/web/src/lib/audit/log-event.ts`
- Conventions UI : `docs/analytics/04-ui-design.md`
