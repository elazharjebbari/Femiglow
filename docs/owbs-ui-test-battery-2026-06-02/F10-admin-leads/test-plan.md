# F10 — Plan de tests concret

> Cibles : RTL sur les vues admin leads + actions ; e2e `e2e/owbs-ui-admin-leads.spec.ts`
> (le setup admin auth existe : `e2e/global.setup.ts`).

## A. RTL (vues + actions)
- **F10-S01..S08** : monter la liste/détail avec des fixtures de leads aux états variés (capturé/adresse/converti/abandonné) → vérifier les **libellés d'état**, la chronologie, le panier, l'attribution, le `cl_…`. Mock des queries (`@/lib/admin/leads/*` / routes) pour fournir les données.
- **F10-S04** : liste vide → empty state propre.
- **F10-S10/S11** : `LeadStatusMenu` (changer statut) + `LeadNoteForm` (note) → MSW sur les routes admin (`/api/admin/leads/[id]/status`, `/api/admin/leads/[id]`) → feedback succès ; idempotence (double-clic ⇒ une action).
- **F10-S22** : axe sur la liste.

## B. Intégration
- **F10-S21** : insérer un lead via **upsert optimiste** (leadId client) et un lead **legacy** (id serveur) → la query liste les rend de façon **identique** (projection des états).

## C. Playwright (admin authentifié)
- **F10-S20 (reflet temps réel)** : scénario de bout en bout — une acheteuse capture en optimiste (sur le storefront), puis l'opérateur ouvre `/admin/leads` et **voit** le lead `captured`. Oracle : le lead `cl_…` apparaît < quelques secondes.
- **F10-S23** : accès sans session admin → refus.

## D. Étapes
1. RTL états/détail (S01-S08) avec fixtures.
2. Actions opérateur (S10/S11) + idempotence + a11y (S22).
3. Projection optimiste==legacy (S21) + reflet e2e (S20).
