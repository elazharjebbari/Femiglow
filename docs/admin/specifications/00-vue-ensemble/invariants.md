# Invariants (non négociables)

> Règles structurelles vérifiées pendant la revue de chaque PR. Une PR
> qui viole un invariant doit être bloquée et reformulée.

---

## I-01 — Cohabitation marketing intacte

Aucun ajout admin ne doit altérer le rendu, les performances ou l'a11y
des routes publiques `(marketing)`, `(commerce)`, `commander`.

**Vérification.** Tests Playwright sur la home, le panier, le checkout
publient des screenshots inchangés ; pas de régression Lighthouse > 2 pt.

## I-02 — Stack unique

Pas de seconde stack pour l'admin. On réutilise :

- Tailwind 3.4 (palette earthen)
- Cormorant Garamond + Inter
- Zod
- react-hook-form
- Composants `src/components/ui/*`
- `cn()` utility

**Vérification.** Recherche dans la PR de toute import suspect
(`@radix-ui`, `@mantine`, `material-ui`, `shadcn`, etc.) → bloque.

## I-03 — Sécurité par défaut

Toute route sous `/admin/*` (sauf `/admin/login`) et `/api/admin/*` (sauf
`/api/admin/login`) **doit** :

1. Être interceptée par `middleware.ts`.
2. Renvoyer 401 si la session est invalide.
3. Ne **jamais** servir de réponse partielle à un utilisateur non
   authentifié.

**Vérification.** Tests MSW + middleware unit tests couvrent
exhaustivement les chemins `/admin/*` et `/api/admin/*`.

## I-04 — Aucun lead silencieusement perdu

Tout `POST /api/contact`, `/api/checkout`, `/api/newsletter` qui
retourne 2xx **doit** avoir persisté le lead en DB **avant** la réponse.

Si l'INSERT échoue après 3 tentatives, retourner **503** avec corps
`{ error: 'persistence_unavailable' }` — ne jamais retourner 200.

**Vérification.** Test MSW `scenario-public-form-checkout-db-down.md`
+ test d'intégration explicite.

## I-05 — Webhook asynchrone non-bloquant

Le succès ou l'échec du webhook **ne doit pas** influencer la réponse à
l'utilisateur public. Le délai d'envoi vers le partenaire est traité par
le cron, pas par le route handler.

**Vérification.** `POST /api/checkout` répond en < 500 ms p95 même si le
partenaire est down.

## I-06 — Souveraineté des données

Aucun PII (email, téléphone, nom, adresse, IP) ne transite par un
service tiers autre que :

- Vercel (hébergement, EU)
- Neon (DB, Frankfurt)
- Sentry (logs, EU instance)
- Le partenaire explicitement configuré dans `webhook_endpoints`

**Vérification.** Audit dépendances, pas d'ajout SaaS sans ADR.

## I-07 — Pas de secrets en clair en DB

Les secrets HMAC des endpoints webhook sont chiffrés at-rest via
`pgcrypto.pgp_sym_encrypt(secret, WEBHOOK_MASTER_KEY)`. Les `.dump()`
DB ne révèlent jamais les secrets en clair.

**Vérification.** Test d'intégration insère un endpoint, lit la colonne
brute → vérifie que le contenu n'est pas le secret en clair.

## I-08 — Idempotence webhook

Chaque livraison transporte `Idempotency-Key: <lead.id>` et
`X-FemiGlow-Signature: sha256=<hex>`. Le partenaire peut recevoir N
fois le même payload sans effet de bord.

**Vérification.** Test MSW `scenario-webhook-delivery-retry.md` vérifie
que les 3 retries portent le même `Idempotency-Key`.

## I-09 — Audit trail complet

Toute action admin (login, changement de statut, ajout note,
suppression, replay webhook, modification endpoint) émet une entrée
`lead_events` ou un log structuré `pino` avec `actor`, `action`,
`target_id`, `at`.

**Vérification.** Test pour chaque action vérifie qu'une `lead_events`
est insérée avec les bons champs.

## I-10 — Voix de marque préservée

Les libellés admin respectent la voix FemiGlow : phrases complètes, pas
de jargon, féminin par défaut, ponctuation soignée.

| Mauvais | Bon |
|---|---|
| "Status updated" | "Statut mis à jour." |
| "Submit" | "Enregistrer" |
| "Are you sure?" | "Confirmer la suppression ?" |
| "User created" | "Administratrice créée." |

**Vérification.** Revue de PR par référent design.

## I-11 — Accessibilité ≥ WCAG 2.1 AA

- Tous les contrôles ont un `label` accessible.
- Focus visible partout (anneau `outline-2 outline-encre/40`).
- Navigation clavier complète (Tab, Shift+Tab, Esc, Enter).
- Contraste texte ≥ 4.5:1, contraste UI ≥ 3:1.

**Vérification.** `jest-axe` sur chaque page + audit manuel checklist.

## I-12 — Pas d'API publique pour l'admin

Aucune route admin n'est appelée depuis le frontend public. Les routes
publiques (`/api/contact`, etc.) ne lisent jamais la session admin.

**Vérification.** Recherche grep : aucune référence à `getSession()`
dans `app/api/contact`, `app/api/checkout`, `app/api/newsletter`.

## I-13 — Migration DB versionnée

Toute modification de schéma passe par une migration Drizzle dans
`apps/web/src/lib/db/migrations/`. Pas de `ALTER TABLE` direct en prod.

**Vérification.** CI vérifie que `drizzle-kit check` ne signale aucun
drift.

## I-14 — Tests obligatoires

Tout endpoint nouvellement ajouté doit avoir :

1. Un schéma Zod d'entrée + un test unitaire.
2. Un scénario MSW happy path + au moins 2 cas d'erreur.
3. Une couverture ≥ 80 % de la fonction.

**Vérification.** CI échoue si Vitest coverage < 80 % sur les fichiers
modifiés.

## I-15 — Compatibilité serverless

- Pas de `setInterval`, `setTimeout` longue durée hors d'un cron.
- Pas d'état mémoire entre requêtes (sauf rate limit accepté comme
  dégradé).
- Pas de processus worker permanent.

**Vérification.** Revue de PR + lint personnalisé interdisant
`setInterval` en hors-cron.
