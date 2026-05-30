# Admin Feature Spec — Moteur de suggestion (`/admin/i18n/engine`)

> **Source de vérité** : [`../../CONTRACT.md`](../../CONTRACT.md) §7 — artefacts figés (`useLocaleSuggestionEngine`, `evaluateSuggestionPolicy`, `collectSignals`, `guessPreferredLocale`, `LocaleSuggestionPrompt`), section `i18n_suggestion_engine`, INV-13..INV-20.
> **Schéma** : [`engine-config-schema.yaml`](./engine-config-schema.yaml). **Catalogues** : [`profiles-catalog.csv`](./profiles-catalog.csv), [`../03-data/signals-catalog.csv`](../03-data/signals-catalog.csv).
> **Patterns à mirrorer** : `../../06-admin/admin-feature-spec.md` (`requireAdmin` + `AdminShell` + `getSection` + éditeur optimiste), `../../03-data/admin-config-model.md` (app_config + version + snapshots + `logAuditEvent` + `unstable_cache` + `safeValidate`→defaults, ADR-009). Précédent de code : `apps/web/src/app/admin/settings/flags/page.tsx`, `apps/web/src/app/api/admin/settings/[section]/route.ts`.

---

## 1. (a) Fonctionnement optimal — ce que l'admin peut faire

Onglet **« Moteur »** de `/admin/i18n` (route dédiée `/admin/i18n/engine`). Server Component : `requireAdmin('/admin/i18n/engine')` → `getAdminEngineConfig()` (section `i18n_suggestion_engine` + `version`) → rend un client editor dans `<AdminShell active="settings">`. **Une seule** config singleton (PUT atomique `If-Match`).

L'admin pilote, **sans redéploiement** (INV-18) :

1. **Interrupteur global** (`engineEnabled`) — un toggle maître. **OFF par défaut** (INV-13). Tant qu'il est off, le moteur ne propose **jamais** rien, quels que soient les profils.
2. **Activer/désactiver chaque profil** — liste des profils trigger + never. Chaque trigger porte un toggle `enabled` (défaut **false**, INV-13). **Garde-fou** : les never-profiles `NEVER-CHECKOUT` et `NEVER-FORM` ont leur toggle **grisé/verrouillé** (impossible à désactiver — V-QUIETZONE-LOCKED, §7.5/INV-14).
3. **Profile builder no-code** — créer/éditer/supprimer **trigger ET never** profils (INV-18) en composant des **conditions** sur le catalogue de signaux :
   - sélecteur `signal` (liste depuis `signals-catalog.csv` : nom + catégorie + DefaultSafeValue affiché en aide), `op` (`eq/ne/gt/gte/lt/lte/notNull/increasing/eqServed/neServed`), `value` typée selon le signal ;
   - logique inter-conditions `all` (ET) / `any` (OU) ;
   - champs : `name`, `kind` (trigger/never), `priority`, `minConfidence`, `cooldownHours`, `maxImpressions`, `surface` (pearl/toast pour trigger, none pour never), `opportuneMoment[]` (multi-select de breakpoints), `reason`.
4. **Poids des stratégies** (`strategyWeights` S1..S7 — `detection-strategies.md`) — sliders [0,1]. `geoIpTieBreaker` reste **désactivé** par défaut et ne peut servir que de tie-breaker faible (INV-20 : pas de géoloc dure).
5. **Seuils & budget** — `globalConfidenceFloor`, `defaults.{cooldownHours,maxImpressions,minConfidence}`, `deferTtlMs`, `behaviorThresholds.*` (fresh/deepRead/fastScroll/idleBreak).
6. **Surfaces** (`surfaces.pearl`, `surfaces.toast`) — enabled, autoDismissMs ; `respectReducedMotion` **verrouillé true** (INV-7). **Pas** de surface modale (refusée par le schéma `.strict()` — anti-pattern D1).
7. **Live preview + dry-run / simulate** — un panneau qui exécute `evaluateSuggestionPolicy(sampleSignals, draftConfig)` **côté client** (fonction pure, déterministe) contre des jeux de signaux d'exemple éditables, et **affiche la décision** (`show`/`suppress`/`defer`), le `reason`, le `profileMatched`, et — si `show` — un rendu du `LocaleSuggestionPrompt` (perle/toast, AR en `dir=rtl`). Aucune écriture, aucun event émis : c'est une simulation sur le **brouillon non publié**.
8. **Reset profil / reset config** — restaurer un profil aux defaults, ou la config entière (publié via le même PUT, confirmation).

---

## 2. UX de l'éditeur

- **Layout** : colonne gauche = panneaux (Global / Profils / Stratégies & seuils / Surfaces) ; colonne droite = **Simulateur** sticky (signaux d'exemple + décision live + preview prompt).
- **En-tête « Global »** : le toggle `engineEnabled` est mis en évidence avec un rappel « OFF par défaut — aucune suggestion tant qu'un trigger n'est pas activé » (INV-13). Un badge d'état (« Moteur actif / inactif ») résume.
- **Liste des profils** : groupée `Exclusions (never)` puis `Déclenchements (trigger)`, triée par `priority`. Chaque ligne : nom, kind, priority, enabled-toggle, surface, edit, delete.
  - Les lignes `NEVER-CHECKOUT` / `NEVER-FORM` affichent un **cadenas** + tooltip « Zone calme inviolable — non désactivable, non supprimable (INV-14) ». Toggle et bouton supprimer **désactivés**.
- **Profile builder (modale d'édition)** : formulaire no-code ; chaque condition = ligne `signal / op / value` ajoutable/supprimable ; aperçu textuel de la règle (« SI guessedLocale ≠ servedLocale ET confidence ≥ 0.75 »). Validation inline mappée sur les **V-codes** du schéma (V-CONDITION-SIGNAL-KNOWN, V-SURFACE-ENUM, V-NO-GEO-HARD…).
- **Simulateur (dry-run)** : presets de signaux (« arrivée /fr, Accept-Language ar », « en checkout », « scroll rapide », « deep-read article », « budget épuisé »). On édite n'importe quel signal ; la décision se recalcule **en temps réel** via `evaluateSuggestionPolicy`. Pour un preset checkout, on **voit** la décision `suppress` + `NEVER-CHECKOUT`, même si un trigger est activé (preuve INV-14 avant publication).
- **Validation inline** : toute règle de `engine-config-schema.yaml#validationRules` qui échoue surligne le champ et affiche le message mappé sur le `rule` du 422. **Publier** désactivé tant qu'une erreur bloquante subsiste (Zod client = miroir serveur ; le serveur reste l'autorité).
- **Optimistic save** : clic Publier → `PUT /api/admin/i18n/config` (section engine) avec `If-Match: <version>` + `{ payload, note? }`.
  - **Succès** : `version` locale mise à jour, toast « Publié », état non *dirty*.
  - **422** : on n'écrase pas l'UI ; on affiche les `details[].rule` sur les champs (rollback optimiste).
  - **409 version_conflict** : bannière « Un autre admin a modifié cette config (v{current}). Recharger. » → pas d'écrasement aveugle.
  - **401/403** : redirection login / message permission.
- **Champ `note`** : commentaire d'audit optionnel (« active TRIG-ENTRY-MISMATCH en A/B »), stocké dans le snapshot + audit.
- **Confirmation de suppression** : supprimer un profil (trigger OU never custom) exige une confirmation explicite (nom à confirmer). Les never-plancher ne sont jamais supprimables.

---

## 3. Garde-rails (invariants UI)

| Garde-rail | Règle | Invariant |
|---|---|---|
| OFF par défaut | `engineEnabled` defaut false ; config invalide ⇒ moteur off | INV-13 / §7.5 |
| Zones calmes verrouillées | NEVER-CHECKOUT & NEVER-FORM : toggle + delete désactivés ; toute tentative API ⇒ 422 + réinjection | INV-14 / §7.5 |
| Never prime trigger | Validation `priority(never) < priority(trigger)` ⇒ erreur sinon | politique §4 / V-NEVER-BEFORE-TRIGGER |
| Pas de modale | `surface ∈ {pearl,toast,none}` ; `modal` rejeté par `.strict()` | D1 anti-pattern |
| Pas de géoloc dure | `geoCountry` interdit en condition ; geoIp tie-breaker only, désactivé | INV-20 / V-NO-GEO-HARD |
| Cap & cooldown bornés | maxImpressions ∈ [0,3], cooldown ∈ [0,168] | INV-16 |
| Reduced-motion | `respectReducedMotion` verrouillé true | INV-7 |
| Priorités uniques | unicité ⇒ ordre d'évaluation déterministe | V-PRIORITY-UNIQUE |

---

## 4. Authz, validation, save, cache

- **Authz** : `requireAdmin('/admin/i18n/engine')` (lecture) ; PUT exige RBAC `write` sur resource `app-config` (ou `i18n`). Sans session ⇒ 401 ; sans droit ⇒ 403 ; aucune mutation/snapshot/audit sur échec.
- **Validation** : Zod `.strict()` côté serveur (autorité), miroir client pour l'UX. Payload invalide ⇒ 422 (`details[].rule`). Le **resolver public** force `engineEnabled=false` sur tout payload non parseable (INV-13).
- **Optimistic save** : `upsertAppConfig('i18n_suggestion_engine', { payload, expectedVersion, actorId, note })` — `WHERE section=... AND version=expected` ; 0 row ⇒ 409 ; sinon `version+1`, snapshot inséré, `logAuditEvent({ action:'i18n-engine.update', resourceType:'app_config', resourceId:'i18n_suggestion_engine', meta:{version,snapshotId,note,before,after} })`.
- **Cache invalidation** : au PUT accepté ⇒ `revalidateTag(I18N_ENGINE_TAG /* 'i18n-suggestion-engine' */)` ⇒ le prochain `getSuggestionEngineConfig()` (consommé par `useLocaleSuggestionEngine` via prop serveur) reflète la nouvelle config. Aucune mise en cache d'un payload invalide.

---

## 5. (b) Éléments à VÉRIFIER / TESTER

### Authz
- [ ] `/admin/i18n/engine` sans session ⇒ redirect `/admin/login?next=/admin/i18n/engine`.
- [ ] Session sans droit `read` ⇒ 403 / page refusée.
- [ ] PUT sans droit `write` ⇒ 403 ; aucune mutation/snapshot/audit.

### OFF par défaut & validation (INV-13 / §7.5)
- [ ] Config neuve / payload invalide ⇒ `engineEnabled=false` servi (resolver), 0 prompt.
- [ ] Chaque fixture invalide saisie ⇒ erreur inline + Publier bloqué + (bypass client) 422 avec le bon `rule`.
- [ ] `globalConfidenceFloor` hors [0,1] ⇒ erreur ; `maxImpressions` hors [0,3] ⇒ erreur ; cooldown hors [0,168] ⇒ erreur.
- [ ] Clé inconnue dans le PUT ⇒ 422 (`.strict()`, V-STRICT-KEYS).

### Zones calmes verrouillées (INV-14 / §7.5)
- [ ] Toggle `NEVER-CHECKOUT` / `NEVER-FORM` grisé en UI ; tenter `enabled:false` via API ⇒ 422 V-QUIETZONE-LOCKED + profil réinjecté.
- [ ] Supprimer `NEVER-CHECKOUT` via API ⇒ réinjecté de force (plancher non désactivable).
- [ ] Simulateur preset checkout + trigger actif ⇒ décision `suppress` / `NEVER-CHECKOUT` (avant publication).

### Profile builder no-code (INV-18)
- [ ] Créer un trigger custom (conditions sur signaux du catalogue) ⇒ persiste, apparaît, **pris en compte sans redeploy**.
- [ ] Créer un never custom ⇒ priorité respectée (avant triggers), prime en simulation.
- [ ] Éditer un profil (priority, minConfidence, surface, opportuneMoment) ⇒ reflété en simulation.
- [ ] Supprimer un profil custom ⇒ confirmation requise ; never-plancher non supprimable.
- [ ] `signal` inexistant / `surface='modal'` / `geoCountry` en condition ⇒ erreurs V-CONDITION-SIGNAL-KNOWN / V-SURFACE-ENUM / V-NO-GEO-HARD.
- [ ] Deux profils même `priority` ⇒ V-PRIORITY-UNIQUE ; never priority > trigger ⇒ V-NEVER-BEFORE-TRIGGER.

### Simulateur (dry-run)
- [ ] La décision affichée == sortie de `evaluateSuggestionPolicy` (même fonction pure que la prod ; table de vérité reproductible).
- [ ] Aucun event émis, aucune écriture pendant la simulation.
- [ ] Preset « arrivée /fr + Accept-Language ar » + TRIG-ENTRY-MISMATCH activé + breakpoint ⇒ `show` ar ; sans breakpoint ⇒ `defer`.
- [ ] Preview prompt AR rend `dir=rtl`, endonyme natif, 0 latin hors `FemiGlow` (INV-6), pas de modale, pas de pulse (charte).

### Optimistic save & cache
- [ ] PUT valide ⇒ `version+1`, 1 snapshot, 1 audit `i18n-engine.update` (before/after/note).
- [ ] 401/403/422/409 ⇒ **aucune** écriture (snapshot/audit/version).
- [ ] Après PUT ⇒ `revalidateTag('i18n-suggestion-engine')` ⇒ `getSuggestionEngineConfig()` reflète la nouvelle valeur ; payload invalide jamais mis en cache.
- [ ] Concurrence : 2 onglets éditant ⇒ le 2e Publier reçoit 409, n'écrase pas (E2E).

### Accessibilité (charte)
- [ ] Éditeur navigable clavier ; toggles labellisés ; erreurs annoncées (`aria-live`).
- [ ] Preview/simulateur respecte `prefers-reduced-motion` ; aucun pop chaud / pulse introduit.
