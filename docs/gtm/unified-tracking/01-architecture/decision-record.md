# ADRs — Architecture Decision Records

Format : décision atomique, contexte, options, choix, conséquences.

---

## ADR-001 — Modèle unique `TrackingPlan` en JSONB

**Date :** 2026-05-14
**Statut :** Accepté

### Contexte
Les 5 sous-systèmes actuels persistent dans 3 tables + 1 settings JSONB, sans liaison de version. Cause racine des incohérences.

### Options
- **A.** Modèle relationnel fin (plans, providers, events, env_profiles avec FKs).
- **B.** Modèle JSONB unique (1 table, `plan` JSONB).
- **C.** Event-sourcing (stocker les patches successifs).

### Choix : B

### Justification
- Volume faible (un plan ~50 KB). Pas besoin d'index relationnels fins.
- L'invariant principal est l'atomicité d'un plan : JSONB le garantit naturellement.
- Migration des données existantes simple (un map TS produit le JSON).
- Performance Postgres JSONB excellente avec GIN sur clés fréquentes (`bundleId`, `status`).
- Schéma Zod côté code = source de vérité, validé à chaque INSERT/UPDATE.

### Conséquences
- Pas de FK Postgres entre plan et providers : la cohérence est applicative.
- Diff/audit reposent sur `jsonb_diff` ou impl applicative.
- Schéma versionning : champ `plan.meta.schemaVersion` pour migrations futures.

---

## ADR-002 — Export GTM unique et déterministe

**Date :** 2026-05-14
**Statut :** Accepté

### Contexte
Deux chaînes d'export coexistent (`builders.ts` code-driven, `gtm-export.ts` matrix-driven). Sortie divergente. Cause racine des doublons GTM.

### Options
- **A.** Garder les deux, ajouter une orchestration en dessus.
- **B.** Supprimer une des deux, choisir un standard.
- **C.** Réécrire une fonction unique à partir de zéro, snapshots-tested.

### Choix : C

### Justification
- Les deux implémentations actuelles ont des bugs et des couvertures de tests asymétriques.
- Une fonction unique simplifie la vérification de déterminisme.
- Snapshot tests gellent le format → toute régression future est détectée à la build.

### Conséquences
- Refactor incompatible avec le format actuel : la migration doit produire un container identique fonctionnellement (mêmes triggers, mêmes mappings) mais avec une structure JSON re-normalisée.
- Un test de migration vérifie qu'un plan importé depuis l'ancien state produit un export sémantiquement équivalent.

---

## ADR-003 — Wizard et Expert sur la même route

**Date :** 2026-05-14
**Statut :** Accepté

### Contexte
Deux UX cibles (novice / expert). Doit-on les router séparément ?

### Options
- **A.** Routes séparées `/edit/wizard` et `/edit/expert`.
- **B.** Une route `/edit` avec un toggle local (query param `?mode=wizard|expert`).
- **C.** Détection automatique du niveau utilisateur.

### Choix : B

### Justification
- Permet à l'admin de basculer en cours d'édition sans perdre son draft.
- URL canonique partageable.
- Évite la duplication de logique de persistence (un seul store Zustand).

### Conséquences
- Le store doit gérer les deux représentations (wizard step-by-step + expert global).
- Composants de section partagés entre les deux modes (réutilisation maximale).

---

## ADR-004 — Validation côté serveur autoritative

**Date :** 2026-05-14
**Statut :** Accepté

### Contexte
Le validator côté client peut être contourné (devtools, requêtes directes). Comment garantir qu'un plan placeholder ne soit jamais activé ?

### Options
- **A.** Validation client suffisante (rapide, mais contournable).
- **B.** Validation client + serveur (UX réactive + sécurité).
- **C.** Validation serveur seule (lent UX, mais blindé).

### Choix : B

### Justification
- Client donne feedback immédiat pendant l'édition.
- Serveur refuse définitivement l'activation si validation échoue (réponse 422 avec détails).
- Même Zod schema partagé entre client et serveur (un seul truth).

### Conséquences
- Tous les endpoints qui mutent un plan valident d'abord.
- Tests unitaires + intégration sur les cas de bypass tentés.

---

## ADR-005 — Pas d'auth OAuth GTM API en v1

**Date :** 2026-05-14
**Statut :** Accepté

### Contexte
Pourrait-on automatiser l'import du JSON dans GTM via leur API ?

### Options
- **A.** Intégration OAuth GTM API → push automatique.
- **B.** Export JSON manuel + import manuel par admin (statu quo).
- **C.** Push automatique via fichier partagé Google Drive.

### Choix : B

### Justification
- Simplicité de v1.
- GTM API nécessite scopes admin Google sensibles.
- Le download manuel garde un humain dans la boucle (sécurité).

### Conséquences
- L'admin doit toujours faire le download + upload dans GTM UI.
- v2 possible : déclencher l'import via service-to-service workflow si demande croissante.

---

## ADR-006 — Plan migré conservé en archive

**Date :** 2026-05-14
**Statut :** Accepté

### Contexte
À la migration, on convertit l'état (providers + mappings + configs) en un plan unique. Garde-t-on les anciennes tables ?

### Options
- **A.** Drop immédiat.
- **B.** Soft delete (renommer + read-only).
- **C.** Garde en lecture-seule indéfiniment.

### Choix : B (renommer en `*_legacy_v1`, lecture seule, suppression 90 jours plus tard)

### Justification
- Rollback possible si bug post-migration.
- 90 jours = fenêtre confortable pour valider en prod.
- Pas de drop instantané (toujours regrettable).

### Conséquences
- Migration drizzle non-destructive.
- Job cleanup à T+90j avec backup S3 obligatoire.

---

## ADR-007 — Cache plan actif TTL 30s avec invalidation explicite

**Date :** 2026-05-14
**Statut :** Accepté

### Contexte
Le resolver runtime appelle `getActivePlan()` sur chaque event dispatch. Cache nécessaire.

### Options
- **A.** Pas de cache (lecture DB à chaque event).
- **B.** Cache infini avec invalidation manuelle.
- **C.** Cache TTL court (30s) avec invalidation explicite à l'activation.

### Choix : C

### Justification
- TTL court protège contre miss d'invalidation.
- Invalidation explicite garantit cohérence immédiate après activation.
- Compromis perf vs. fraicheur acceptable (30s = SLA propagation activation).

### Conséquences
- Tests d'intégration vérifient : activation → cache invalidé → prochain dispatch lit le nouveau plan.
- Sur multi-instance, Pub/Sub ou Redis pour propagation (post-v1).
