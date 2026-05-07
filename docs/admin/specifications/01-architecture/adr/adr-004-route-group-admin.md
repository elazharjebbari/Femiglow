# ADR-004 — Route group `(admin)` isolé

| Champ | Valeur |
|---|---|
| Statut | Accepté |
| Date | 2026-05-03 |

## Contexte

Le repo Next.js comporte déjà des route groups `(marketing)` et
`(commerce)`. L'admin doit cohabiter sans dégrader marketing/commerce
ni introduire de stack parallèle.

## Décision

Créer un route group `(admin)` parallèle :

```
apps/web/src/app/
├── (marketing)/        ← inchangé
├── (commerce)/         ← inchangé
├── commander/          ← inchangé
├── (admin)/            ← NOUVEAU
│   ├── layout.tsx      ← layout sobre admin
│   ├── login/page.tsx
│   ├── dashboard/page.tsx
│   ├── leads/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   └── webhooks/
│       ├── page.tsx
│       ├── new/page.tsx
│       ├── [id]/page.tsx
│       └── [id]/deliveries/page.tsx
└── api/
    ├── ... (inchangé)
    └── admin/         ← NOUVEAU
        ├── login/route.ts
        ├── logout/route.ts
        ├── leads/[id]/...
        ├── webhooks/...
        └── cron/webhook-tick/route.ts
```

## Conséquences

### Positives

- Layout admin totalement indépendant (pas de Header/Footer marketing).
- URL transparente : `/admin/leads`, pas `(admin)/admin/leads`.
- Bundle JS public n'inclut pas le code admin (Next.js code-split par
  layout).
- Marketing/commerce 100 % inchangés visuellement.

### Négatives

- Aucune.

## Implications middleware

Le `middleware.ts` matche :

```ts
export const config = {
  matcher: [
    '/admin/:path((?!login).*)',
    '/api/admin/:path((?!login|cron).*)',
  ],
};
```

Note : `/admin/login` et `/api/admin/login` sont publics (sinon impossible
de se connecter). `/api/admin/cron/webhook-tick` est protégé par
`Bearer CRON_SECRET` (auth distincte de la session admin).

## Critères d'acceptation

- [ ] `GET /admin/leads` sans cookie → 302 vers `/admin/login?next=/admin/leads`.
- [ ] `GET /admin/login` → 200 (pas de redirection).
- [ ] `GET /` (marketing) inchangé visuellement.
- [ ] Bundle public (mesuré sur `/`) ne contient pas le code admin
      (`grep "AdminLayout"` dans `.next/static/chunks/` → 0 match).
