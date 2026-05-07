# Rendering strategy

## Mode pour chaque route

| Route | Mode | Justification |
|---|---|---|
| `/admin/login` | `dynamic = 'force-dynamic'` | dépend du cookie pour redirect |
| `/admin/dashboard` | `dynamic = 'force-dynamic'` | dépend de la session + données fraîches |
| `/admin/leads` | `dynamic = 'force-dynamic'` | filtres dans search params |
| `/admin/leads/[id]` | `dynamic = 'force-dynamic'` | données spécifiques à un lead |
| `/admin/webhooks` | `dynamic = 'force-dynamic'` | données fraîches |
| `/admin/webhooks/[id]/deliveries` | `dynamic = 'force-dynamic'` | idem |

**Aucune** page admin n'est statique. La directive
`export const dynamic = 'force-dynamic';` est posée sur le layout
admin, donc héritée.

## Pourquoi pas d'ISR

ISR aurait du sens pour un blog, pas pour une admin où chaque vue
nécessite la dernière donnée. Pas de bénéfice.

## Caching

| Couche | Cache |
|---|---|
| Pages admin (Next.js Data Cache) | désactivé |
| Requêtes Drizzle | aucune mise en cache |
| Réponses API admin | `Cache-Control: no-store` |
| Assets statiques (JS, CSS) | `Cache-Control: public, max-age=31536000, immutable` (Vercel auto) |

```ts
// Helper pour API admin
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Headers explicites sur chaque route handler
return new Response(JSON.stringify(data), {
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, max-age=0',
  },
});
```

## Streaming

| Page | Streaming activé |
|---|---|
| `/admin/dashboard` | oui, 2 sections (`<Suspense>`) |
| `/admin/leads` | non (une seule requête dominante) |
| `/admin/leads/[id]` | oui, 3 sections (identité+commande, timeline, deliveries) |
| `/admin/webhooks` | non |
| `/admin/webhooks/[id]/deliveries` | non |

## Suspense boundary type

Chaque section streamée a son propre skeleton textuel :

```tsx
function KPISkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[0, 1, 2].map(i => (
        <div key={i} className="h-24 bg-encre/5 rounded" aria-hidden="true" />
      ))}
    </div>
  );
}
```

Pas d'animation pulse sous `prefers-reduced-motion: reduce`.

## Bundle splitting

Next.js code-split automatique par route.
Les composants admin ne sont **pas** chargés sur les pages publiques :

- Bundle marketing/commerce : inchangé.
- Bundle admin login : ~30 kB gzip (formulaire seul).
- Bundle admin dashboard : ~60 kB gzip (KPIs + table).
- Bundle admin leads list : ~80 kB gzip (filtres + table + pagination).
- Bundle admin webhook form : ~70 kB gzip.

Vérifier via `pnpm build && pnpm dlx @next/bundle-analyzer`.

## Server Actions ?

Non utilisées en v1. Préférence pour route handlers (cf.
[`data-fetching.md`](./data-fetching.md)). Possible évolution v2 si
ergonomie devient meilleure dans Next 15+.

## Edge runtime vs Node.js runtime

| Route | Runtime | Raison |
|---|---|---|
| Toutes les pages admin | Node.js | Drizzle + argon2 nécessitent Node |
| Toutes les API admin | Node.js | argon2 + iron-session |
| Cron tick | Node.js | idem |
| Routes publiques (existantes) | Node.js (par défaut) | pas de changement |

Edge runtime non utilisé. Trop de contraintes pour la valeur ajoutée
faible (admin = trafic minime).
