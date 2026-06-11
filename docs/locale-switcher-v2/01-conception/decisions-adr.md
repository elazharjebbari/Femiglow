# ADR — Décisions d'architecture (Locale Switcher V2)

> Format ADR léger : Contexte → Décision → Conséquences → Alternatives rejetées. Toute évolution du `CONTRACT.md` doit créer/mettre à jour un ADR ici.

## ADR-001 — Transition sans reload via View Transitions API + synchro `dir/lang`
**Contexte.** `<html dir/lang>` n'est posé que par le script inline de `app/[locale]/layout.tsx`, exécuté au chargement. En soft-navigation next-intl, le script n'est pas ré-exécuté → la direction ne basculerait pas. La V1 contournait par un reload complet (rupture visuelle).
**Décision.** Envelopper la soft-nav dans `document.startViewTransition(apply)` ; dans `apply()`, **d'abord** poser `document.documentElement.lang/dir`, **puis** `router.replace(url,{locale})`. Le fondu croisé natif masque la bascule ; `dir` est correct dès la nouvelle frame (INV-2).
**Conséquences.** Bascule fluide, scroll préservé (INV-3), URL/SEO intacts. Nécessite un fallback (ADR-002) pour Firefox. Annonce SR à ajouter (la perte du reload supprime l'annonce native — INV-10).
**Alternatives rejetées.** Reload (rupture) ; soft-nav seule (dir non basculé, swap sec) ; swap de messages sans navigation (casse URL/SEO/RSC).

## ADR-002 — Fallback « voile » framer-motion
**Contexte.** View Transitions n'est pas universel (Firefox).
**Décision.** Si `!document.startViewTransition`, jouer un overlay ivoire `LocaleVeil` : opacity 0→1 (160 ms) → `apply()` derrière le voile → 1→0 (160 ms). framer-motion déjà présent.
**Conséquences.** Rendu élégant **cross-browser**, contrôle total de la courbe ; option « rendu identique partout » si on force le voile.
**Alternatives rejetées.** Pas de fallback (dégradation sèche) ; lib View-Transitions polyfill (poids inutile).

## ADR-003 — Placement header + drawer + footer (pas de top-bar)
**Contexte.** Découvrabilité vs invariant Kolenda « 1 point focal par viewport ».
**Décision.** Conserver le placement V1 (header desktop, pills drawer mobile, footer redondance). Rejeter la top-bar pleine largeur.
**Conséquences.** Trouvable < 3 s sans concurrencer le CTA hero.
**Alternatives rejetées.** Top-bar (2e entrée visuelle dans le hero) ; footer seul (sous le fold) ; FAB dédié (conflit launcher chat).

## ADR-004 — Libellé endonyme (pas de code ISO, pas de drapeau)
**Décision.** Afficher l'endonyme dans sa propre écriture (`العربية`, `Français`, `English`).
**Conséquences.** Accessible (langue dans sa langue), supprime le latin `AR` sur /ar (INV-6), pas de raccourci nation↔langue.
**Alternatives rejetées.** Code `FR/AR/EN` (cryptique, latin sur /ar) ; drapeau (anti-pattern charte + sémantiquement faux).

## ADR-005 — Config admin-éditable, lecture publique cachée
**Contexte.** Besoin d'activer/désactiver une locale, éditer endonymes, piloter le nudge sans redéploiement.
**Décision.** Table `i18n_locale_config` ; `GET /api/i18n/config` public + caché ; `GET/PUT /api/admin/i18n/config` admin-only + audit. Config invalide ⇒ valeurs par défaut (INV-12).
**Conséquences.** Souplesse opérationnelle, pas de hardcode ; surface d'admin à sécuriser + auditer.
**Alternatives rejetées.** Config 100 % statique (`i18n.config.ts` seul) — pas d'édition runtime ; config en env — pas d'UI.

## ADR-006 — Nudge contextuel one-shot, résolu serveur (anti-flash)
**Contexte.** La V1 interdisait toute bannière. On veut récupérer la conversion arabophone sans intrusion ni flash.
**Décision.** `resolveSuggestedLocale()` côté serveur (Accept-Language + cookie) → prop passée au rendu ; `LocaleNudge` = « perle » discrète 1×/visiteur, dismiss permanent (cookie `locale_nudge_dismissed`). Jamais de modale, jamais sur le wizard.
**Conséquences.** Pas de flash (résolu serveur), respect « ne pas pousser » (one-shot + dismiss définitif).
**Alternatives rejetées.** Modale plein écran ; bannière persistante ; détection IP/géo (vie privée).

## ADR-007 — `prefers-reduced-motion` et sans-JS
**Décision.** Reduced-motion ⇒ bascule directe sans animation (toujours sans reload). Sans JS ⇒ `<a hreflang>` fonctionnels.
**Conséquences.** Accessibilité + SEO + robustesse (INV-7, INV-8).

## ADR-008 — Feature flag `localeSwitcherV2`
**Décision.** Livrer derrière flag pour bascule progressive + rollback instantané.
**Conséquences.** Déploiement sûr, A/B possible (B1 dropdown vs B2 toggle), rollback = flag off (runbook).

## ADR-009 — Stockage de config : réutiliser `app_config` (section) plutôt qu'une table dédiée
**Contexte.** Le `CONTRACT` nomme `i18n_locale_config`. Or le repo possède déjà un mécanisme générique **`app_config`** (section + JSONB + colonne `version`, table `app_config_snapshots`, audit via `logAuditEvent`, lecture cachée `unstable_cache` + tag, validation `safeValidate`→défauts) — cf. migration `0006`, `lib/admin-config/resolve.ts`, route `settings/[section]` (PATCH, `If-Match`→409, Zod→422, `revalidateTag`).
**Décision.** **Réutiliser `app_config` avec `section = 'i18n_locale_config'`**. On garde le **nom logique** `i18n_locale_config` (comme identifiant de section), mais **zéro nouvelle table** : on hérite gratuitement du versioning, des snapshots, de l'audit et du cache existants.
**Conséquences.** Moins de surface, cohérence avec l'admin existant, INV-12 (fallback défauts) déjà fourni par `safeValidate`. Le `CONTRACT §2` doit lire « section `app_config` » et non « nouvelle table » (note ajoutée). La migration se réduit à un **seed de section** (pas de DDL).
**Alternatives rejetées.** Table dédiée `i18n_locale_config` (duplique audit/cache/snapshot déjà génériques) — gardée seulement si un besoin d'isolation forte émerge.
**À confirmer à l'implémentation.** Nom exact du cookie de session admin (`SESSION_COOKIE` dans `lib/auth/session.ts`) pour l'OpenAPI ; tag de cache i18n.
