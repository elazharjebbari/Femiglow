# Routing — admin

## Principes

- **Route group** `(admin)` pour layout dédié, URL transparente
  (cf. ADR-004).
- **Server Components par défaut** ; Client Components explicitement
  marqués `'use client'`.
- **URL = source de vérité** pour filtres, pagination, tri (search params).
- **Pas de routing client-side custom** (pas de wouter, pas de react-router).

## Tableau des routes

| URL | Type | Auth | Layout | Source |
|---|---|---|---|---|
| `/admin/login` | Page | publique | none (centré) | `(admin)/login/page.tsx` |
| `/admin` | Redirect | requise | — | `(admin)/page.tsx` (302 → /admin/dashboard) |
| `/admin/dashboard` | Page | requise | admin | `(admin)/dashboard/page.tsx` |
| `/admin/leads` | Page | requise | admin | `(admin)/leads/page.tsx` |
| `/admin/leads/[id]` | Page | requise | admin | `(admin)/leads/[id]/page.tsx` |
| `/admin/webhooks` | Page | requise | admin | `(admin)/webhooks/page.tsx` |
| `/admin/webhooks/new` | Page | requise | admin | `(admin)/webhooks/new/page.tsx` |
| `/admin/webhooks/[id]` | Page | requise | admin | `(admin)/webhooks/[id]/page.tsx` |
| `/admin/webhooks/[id]/deliveries` | Page | requise | admin | `(admin)/webhooks/[id]/deliveries/page.tsx` |

## Search params (paramètres URL standardisés)

### `/admin/leads`

| Param | Type | Valeurs | Défaut |
|---|---|---|---|
| `type` | enum | `contact`, `order`, `newsletter`, `b2b` | non filtré |
| `status` | array | `new,in_progress,converted,closed,duplicate` (CSV) | non filtré |
| `from` | ISO date | `2026-04-01` | -30 jours |
| `to` | ISO date | `2026-04-30` | aujourd'hui |
| `city` | string | `Casablanca`, `Rabat`, ... | non filtré |
| `q` | string | recherche full-text | vide |
| `cursor` | base64 | curseur pagination | none |
| `sort` | string | `created_at`, `total`, ... | `created_at` |
| `order` | enum | `asc`, `desc` | `desc` |
| `format` | enum | `csv` | `html` (défaut) |

### `/admin/webhooks/[id]/deliveries`

| Param | Type | Valeurs | Défaut |
|---|---|---|---|
| `status` | array | `pending,success,failed,aborted` | non filtré |
| `from` | ISO date | — | -7 jours |
| `to` | ISO date | — | aujourd'hui |
| `cursor` | base64 | — | none |

## Layouts

### Root layout (existant)

`apps/web/src/app/layout.tsx` reste **inchangé**. Il fournit fonts et
providers globaux (Toast).

### Admin layout

```tsx
// apps/web/src/app/(admin)/layout.tsx
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminSidebar } from '@/components/admin/layout/AdminSidebar';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic'; // pas de cache statique

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // login a sa propre disposition centrée — détecté côté layout
  const session = await getSession({ allowNull: true });
  if (!session) {
    // login page se rend sans header/sidebar
    return <main className="min-h-screen bg-creme">{children}</main>;
  }
  return (
    <div className="min-h-screen bg-creme">
      <AdminHeader />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 px-8 py-12 max-w-5xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
```

### Pourquoi `dynamic = 'force-dynamic'`

L'admin lit la session via cookie → la route est fonction de l'utilisateur,
pas de cache statique possible.

## Redirections

| De | Vers | Statut |
|---|---|---|
| `/admin` | `/admin/dashboard` | 302 |
| `/admin/login` (déjà connecté) | `/admin/dashboard` (ou `next` si fourni) | 302 |
| `/admin/*` (non connecté) | `/admin/login?next=<url-actuelle>` | 302 (par middleware) |
| `/admin/login` après auth | `next` ou `/admin/dashboard` | 302 |

## Métadonnées

```tsx
// Toutes les pages admin
export const metadata: Metadata = {
  title: 'Administration · FemiGlow',
  robots: { index: false, follow: false },
};
```

`robots: noindex,nofollow` empêche indexation accidentelle si exposé.
Le `robots.ts` du site (existant) bannit déjà `/admin/*`.

## Streaming et Suspense

Pages avec sections lourdes (dashboard avec compteurs + 5 derniers
leads) utilisent `<Suspense>` pour streamer chaque section :

```tsx
<Suspense fallback={<KPISkeleton />}>
  <KPICards />
</Suspense>
<Suspense fallback={<RecentLeadsSkeleton />}>
  <RecentLeads />
</Suspense>
```

Pas de Suspense sur les pages avec un seul fetch dominant (liste
leads) — `loading.tsx` suffit.

## Erreurs

- `(admin)/error.tsx` : fallback générique "Une erreur est survenue."
  + bouton `<RefreshButton />`.
- `(admin)/not-found.tsx` : 404 sobre + lien retour `/admin/dashboard`.
- Pour erreurs métier (lead non trouvé) : `notFound()` dans la page →
  rendu `not-found.tsx`.
