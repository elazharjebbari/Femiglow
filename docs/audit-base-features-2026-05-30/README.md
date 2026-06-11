# Audit-base FemiGlow — Socle pour les prochaines fonctionnalités

> Date : 2026-05-30 · Périmètre : monorepo `apps/web` · Branche de référence : `master`
> (live-systems mergé) + `feat/i18n-foundation` (chantier i18n actif).
> Mode : lecture seule du code + relecture des audits antérieurs (`docs/audit*`,
> `docs/live-systems-*`, `docs/i18n-strategy-2026-05`).

## Pourquoi ce dossier

Les audits précédents photographiaient le produit à un instant T pour **corriger**. Celui-ci a un
autre but : servir de **base de départ commune** pour **ajouter de nouvelles fonctionnalités**
sans rouvrir les chantiers passés ni recréer ce qui existe déjà. Il consolide quatre vagues
d'audit (11 → 30 mai) en un seul point d'ancrage : capacités réutilisables, fondations
techniques, dette qui contraint, et playbook pour brancher une feature proprement.

> Règle d'usage : aucune nouvelle fonctionnalité ne devrait s'écarter des constats consignés ici
> sans justification explicite. Avant de bâtir, on vérifie d'abord ce que le socle offre déjà
> (doc `01` et `02`).

## Plan du dossier

| # | Document | Pour qui | Objet |
|---|---|---|---|
| 00 | [Synthèse exécutive](00-synthese-executive.md) | décideur / lead | Verdict, score, ce qui a bougé depuis le 18 mai |
| 01 | [Cartographie fonctionnelle](01-cartographie-fonctionnelle.md) | tous | Inventaire des capacités existantes, par statut |
| 02 | [Fondations techniques](02-fondations-techniques.md) | dev | Stack + briques/patterns réutilisables |
| 03 | [Chantiers en cours](03-chantiers-en-cours.md) | lead | i18n (Phase 8), live-systems (mergé), reste à finir |
| 04 | [Dette & risques ouverts](04-dette-risques-ouverts.md) | lead / DPO | Contraintes P0/P1 à respecter avant d'élargir |
| 05 | [Guide nouvelle feature](05-guide-nouvelle-feature.md) | dev | Playbook : i18n, tracking, admin, seed, tests, DoD |
| 06 | [Opportunités de features](06-opportunites-features.md) | décideur / lead | Backlog priorisé aligné Kolenda + socle |

## TL;DR

- **Verdict** : codebase tier 1, stack moderne tenue, `typecheck` vert. Score de maturité estimé
  **7,7 / 10** (vs 7,4 le 18 mai) — la hausse vient du chantier **live-systems intégralement
  livré et mergé** (moderation chat, Redis dédup/breaker/idempotency, crons, batching CAPI,
  dashboards `/admin/live-health`).
- **Chantier actif** : **i18n FR/AR/EN** (Phase 8) sur `feat/i18n-foundation` — 797 clés ×
  3 locales, scanner FR + gate, seed bindings. ~177 fichiers en cours, non encore mergé.
- **Ce qui contraint les nouvelles features** : **PII leads en clair** (R1, toujours ouvert),
  **pas de Sentry/APM** (logger maison seulement), composants « godzilla » du tunnel commerce,
  rate-limiting partiel sur quelques routes publiques.
- **Le socle est riche** : commerce/checkout, chat IA multi-provider, tracking multi-canaux,
  publishing social, CMS composants, content-studio, emailing, SEO, media, i18n. Toute feature
  nouvelle réutilise ces briques plutôt que d'en créer.

## Méthode

1. Relecture des audits : `AUDIT-2026-05.md`, `audit-complet-2026-05-18/`,
   `live-systems-audit-2026-05/`, `i18n-strategy-2026-05/`, `audit/`.
2. Mesures fraîches sur le working tree (`feat/i18n-foundation`, 2026-05-30) :
   2 640 fichiers `.ts/.tsx`, 343 route handlers, 141 pages admin, 76 migrations,
   ≈787 fichiers de tests unitaires, 95 specs e2e. `pnpm typecheck` = vert.
3. Vérification de l'écart « plan → réalité » sur les fixes live-systems et l'i18n.

## Conventions

Français soigné, accents et apostrophes corrects. Statuts de sévérité 🔴 P0 / 🟠 P1 / 🟡 P2 /
🟢 OK, alignés sur les audits récents du repo. Citations `file:line` quand un appui code aide.
