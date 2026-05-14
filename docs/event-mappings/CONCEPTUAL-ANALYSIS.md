# Conceptual Analysis — Event Mappings

> Analyse des problèmes, des 3 approches alternatives par axe de décision,
> et la recommandation finale. Sert de base aux ADRs détaillés.

## Problème 1 — Source de vérité des mappings

**Constat** : aujourd'hui `event-mapping.ts` (code) est la SSOT. Toute modif
= PR + deploy. Pas de self-service marketing.

### Option 1A — Tout code (statu quo)
- ✅ Versionnage git, review obligatoire
- ❌ Modif = PR/build/deploy → cycle long
- ❌ Marketing dépendant des devs

### Option 1B — Tout DB éditable
- ✅ Self-service total
- ❌ Risque d'écart silencieux (typo `Purchasee`)
- ❌ Aucun versionnage, audit faible

### Option 1C — **Hybride code + DB override (recommandé)** ★
- Code = mapping par défaut (audit + bisect)
- DB = override versionné avec rollback au default en 1 click
- Fonction de résolution `resolveEventMapping(eventName, providerKind)` lit DB puis fallback code
- ✅ Self-service contrôlé + safety net code
- ✅ Cohérent avec D-005 (déjà fait pour `categorization`)

## Problème 2 — Granularité du versioning

**Constat** : un mapping peut comporter ~30 events × 6 providers = 180 cellules.

### Option 2A — 1 row par cellule
- Versionnage = 1 row DB modifiée
- ❌ Reconstruire la "version active" = JOIN compliqué
- ❌ Pas d'atomicité (modif partielle visible)

### Option 2B — 1 version = 1 JSONB monolithique
- Toutes les cellules sérialisées dans un `mappings: jsonb`
- ✅ Atomique : 1 row = 1 version
- ✅ Activate/rollback = `UPDATE active_id`
- ❌ Diff fine moins direct, mais résolu côté UI

### Option 2C — **Hybride : table `mapping_versions` (1 row = 1 snapshot) + table `mapping_entries` (cellules dépliées pour query)** ★
- Versionnage atomique via `mapping_versions.mappings_jsonb`
- Vue/SELECT direct via `mapping_entries` (générée à chaque activation)
- ✅ Le meilleur des 2 mondes : atomicité + query performance
- ❌ Synchro DB plus complexe — résolu via trigger Postgres ou job applicatif

**Trade-off final** : on choisit **2B** pur (1 version = 1 JSONB) pour la
V1. Le query depuis JSONB est rapide en Postgres avec index GIN. Si on
identifie un besoin réel de query par cellule en V2 → bascule vers 2C.

## Problème 3 — Workflow versioning

**Constat** : on a besoin de create/edit/activate/duplicate/archive/delete + retour au default.

### Option 3A — Édition in-place
- Une seule "version" mutable
- ❌ Pas d'audit trail des changements
- ❌ Aucun rollback sans backup externe

### Option 3B — **Immutable + nouvelle version sur édition (recommandé)** ★
- Édition = clone de la version → nouvelle version draft
- "Activer" = pointer `active_id` vers la nouvelle
- Status par version : `draft | active | archived | deleted`
- Soft-delete pour rollback simple
- ✅ Audit trail naturel
- ✅ Bisect simple ("quelle version a cassé Meta ?")
- ✅ Cohérent avec D-003 (déjà décidé pour GTM configs)

### Option 3C — Branching (git-style)
- Plusieurs branches "exp1", "exp2" actives simultanément
- ❌ Surcharge énorme pour V1
- → Reporté V2 si besoin réel

## Problème 4 — Configuration par défaut

**Constat** : il faut pouvoir "revenir au default" facilement.

### Option 4A — Default = état du code TS au moment du seed
- ❌ Le code évolue, le default DB devient obsolète

### Option 4B — Default = fichier JSON versionné dans `docs/event-mappings/20-data/default-mapping.json`
- Le fichier est la SSOT du default
- Le seed lit ce fichier et l'insère comme version `id=__default__`, `status=archived`, `is_default=true`
- "Reset au default" = activate la version `__default__`
- ✅ Versionnable git
- ✅ Marketing peut PR sur le default si besoin
- ✅ Recovery garanti (le fichier est immutable git)
- ★ **Recommandé**

### Option 4C — Default généré à la volée depuis `event-mapping.ts`
- ✅ Toujours sync avec le code
- ❌ Couple le default au code → si on supprime un event du code, le default change silencieusement

**Choix final** : **4B** + un test CI qui détecte les divergences entre `default-mapping.json` et `event-mapping.ts` (cf. ADR-002).

## Problème 5 — Export vers GTM

**Constat** : l'utilisateur veut **importer directement dans son container GTM Web**.

### Option 5A — Export JSON brut → import manuel via GTM UI
- ✅ Pas d'OAuth requis
- ❌ Étape manuelle, risque d'erreur copy-paste

### Option 5B — Export au format GTM Container JSON officiel (compatible Import)
- L'export produit un `gtm-container-import.json` exactement au format que GTM UI accepte via "Admin → Import Container"
- ✅ Workflow ops "Export → drag-drop GTM UI → confirm"
- ★ **Recommandé pour V1**

### Option 5C — Push direct via Tag Manager API v2 (OAuth)
- ✅ Zéro étape manuelle
- ❌ OAuth complexité (déjà skippé pour Google Ads en chantier 1)
- → Reporté V2 (cf. Option B de la discussion précédente)

## Récapitulatif des choix

| Problème | Choix | ADR |
|---|---|---|
| Source de vérité | Hybride code (default) + DB (override versionné) | ADR-001 |
| Granularité | 1 version = 1 JSONB monolithique (V1) | ADR-004 |
| Workflow versionning | Immutable + nouvelle version sur édition | ADR-001 |
| Default config | Fichier JSON versionné git + seed | ADR-002 |
| Export GTM | Container JSON officiel (compatible Import GTM UI) | ADR-003 |

## Risques majeurs identifiés (détail dans `90-plan/risks.md`)

1. **R1** : drift `default-mapping.json` vs `event-mapping.ts` → test CI obligatoire
2. **R2** : version active corrompue (admin save un mapping invalide) → validation Zod stricte côté serveur + bouton "Tester avant publier"
3. **R3** : export GTM format change avec une nouvelle version Google → tests d'intégration import GTM mensuels
4. **R4** : concurrence édition (2 admins simultanément) → optimistic locking via `updated_at`

## Critères de succès (détail dans `00-overview/success-criteria.md`)

- ✅ Admin peut éditer le mapping d'1 event pour 6 providers sans toucher au code
- ✅ Versioning : create/edit (clone)/activate/duplicate/archive/delete fonctionnent
- ✅ Reset au default en 1 click
- ✅ Export GTM JSON importable réellement dans GTM Web sans erreur
- ✅ Audit log de toutes les actions (qui/quand/quoi)
- ✅ A11y WCAG AA, navigation clavier complète
- ✅ Coverage tests > 85%
