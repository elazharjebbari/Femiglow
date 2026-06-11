# 05 — Guide : brancher une nouvelle feature

Playbook concret pour qu'une feature soit « DoD-complete » dès la première PR : i18n, tracking,
admin, données, tests. Suivre ces étapes évite la dette et reste cohérent avec le socle.

---

## 1. UI publique → i18n dès le départ

1. Créer la page/section sous `app/[locale]/...` (pas sous `(marketing)/`).
2. **Chrome UI** (CTA, labels, en-têtes) → clés `messages/{fr,ar,en}.json`, namespace
   `marketing.<page>.<section>.<field>`, `snake_case`, **pas de tableaux** (clés nommées).
3. Composant de présentation **dumb** : strings en props, défaut FR ; wrapper `*Bound` (server
   `async`) qui résout `getTranslations({ locale, namespace })` ou lit le `content` locale-aware.
4. **Contenu éditorial** → CMS / mocks locale-aware (`*.ar.ts`, `*.en.ts`) via `cms.get*({ locale })`.
5. **RTL** : utiliser les logical properties (`ms/me/ps/pe`, `text-start/end`), miroir des
   éléments directionnels. Vérifier avec `scripts/audit-rtl-classes.py`.
6. Vérifier : `pnpm i18n:scan-fr -- /ar/<route>` = 0 token FR ; `/fr` inchangé.

> Si l'i18n n'est pas encore mergé sur la branche cible : au minimum, **externaliser les strings**
> (pas de texte brut dans le JSX) pour faciliter la trilinguisation ultérieure.

## 2. Conversion / événement → tracking

1. Déclarer l'événement dans le **plan de tracking** (versionné en base) + mapping par provider
   (taxonomy unifiée, cf. `attribution-fix`).
2. Émettre :
   - côté client → `POST /api/track` (consent-gated, dédupé) ;
   - côté SSR → `serverFire()` (dispatch + persiste) ;
   - côté webhook → `serverEmit()`.
3. Vérifier le consentement (Consent Mode v2) et que l'event apparaît dans `tracking_events_log`
   + `/admin/live-health`.

## 3. Collecte de données → conformité d'abord

1. Si la feature collecte des **PII** (email, téléphone, nom, adresse) : **chiffrer** via
   `lib/crypto` (R1 — ne pas ajouter une colonne `text` en clair de plus).
2. Mutation → `withIdempotency` + transaction Drizzle. Route publique → **rate-limit** (Redis).
3. Prévoir la suppression/pseudonymisation (droit à l'oubli) si la donnée est personnelle.

## 4. Capacité back-office → section admin

1. Page RSC sous `app/admin/<x>/page.tsx` (admin **100 % FR**, pas d'i18n).
2. Route API `app/api/admin/<x>/route.ts` : Zod + erreurs typées + `audit_log` pour les actions
   sensibles.
3. Query Drizzle dans `lib/db/queries/<x>.ts`. Réutiliser le pattern d'une section voisine
   (`products`, `seo`, `leads`).

## 5. Donnée éditoriale → seed (déploiement prod)

1. Ajouter/étendre un `scripts/seed-<x>.ts` **idempotent** et **locale-aware**.
2. L'enregistrer dans `pnpm seed:all` et fournir un mode `--dry`.
3. Garantir la **parité mocks dev ↔ seed prod** (clés/ids identiques) — sinon « marche en dev,
   FR en prod ».

## 6. Déploiement à risque → feature flag

- Créer le flag dans `lib/feature-flags/` (pattern `live-systems`/`kit-layout`).
- Rollout **Canary 10 % → Ramp 50 % → Full**, rollback < 60 s via env var.
- Gates de promotion : taux d'erreur, latence P95, breakers, dead letters.

## 7. Tests (non négociable)

| Niveau | Outil | Quoi |
|---|---|---|
| Unit | Vitest (+ MSW) | logique métier, validateurs, helpers ; co-localisé `*.test.ts` |
| i18n | `messages-parity.test.ts` + `pnpm i18n:scan-fr` | parité catalogues + 0 token FR sur `/ar`,`/en` |
| e2e | Playwright + axe | parcours critique, a11y ; tags `@i18n`, `@live-*` |
| Commerce | Playwright `@live-*` | si la feature touche le tunnel : commande end-to-end (3 locales) |

---

## 8. Definition of Done (checklist réutilisable)

- [ ] UI sous `app/[locale]/`, strings dans `messages/*` (3 locales) ou props défaut-FR ; scanner FR = 0.
- [ ] RTL vérifié (logical properties, miroir, Cairo), zéro flash, axe vert × 3 locales.
- [ ] Événements de conversion déclarés au plan de tracking + visibles dans `live-health`.
- [ ] PII chiffrées (`lib/crypto`) ; mutation idempotente + transactionnelle ; route publique rate-limitée.
- [ ] Action sensible journalisée (`audit_log`) ; erreurs typées ; pas de `console.log`.
- [ ] Seed idempotent locale-aware + parité mocks↔seed ; mode `--dry`.
- [ ] Derrière feature flag si risque revenu/prod ; rollback documenté.
- [ ] Tests unit + i18n + e2e verts ; `pnpm typecheck` + `pnpm lint` clean.
- [ ] Doc module au gabarit maison (cahier → archi → data → backend → frontend → tests → runbook).
