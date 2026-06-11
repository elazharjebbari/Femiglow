# Audit & observabilité du moteur — `/admin/i18n/engine/audit`

> **Source de vérité** : [`../../CONTRACT.md`](../../CONTRACT.md) §7 — vue d'audit `/admin/i18n/engine/audit` (§7.1), 5 events (§7.3), **INV-19** (auditable : chaque évaluation montrée OU supprimée est traçable avec sa raison et son profil ; une vue le confirme), INV-14/15/16.
> **Events** : [`../03-data/events-telemetry.json`](../03-data/events-telemetry.json). **Config-change audit** : mirror `app_config_snapshots` + `logAuditEvent` (ADR-009, cf. [`../../03-data/admin-config-model.md`](../../03-data/admin-config-model.md) §5.2).

Ce document fige **(a) le fonctionnement optimal** de l'observabilité et **(b) ce qu'il faut vérifier/tester** pour qu'un admin puisse **confirmer que le moteur marche — et seulement là où il faut** (INV-19).

---

## 1. (a) Deux pistes d'audit complémentaires

| Piste | Question répondue | Source | Stockage |
|---|---|---|---|
| **Audit de DÉCISIONS** (runtime) | « Le moteur se déclenche-t-il bien, et **seulement** aux bons endroits ? » | events `locale_suggestion_evaluated` + `locale_suggestion_suppressed` (+ shown/accepted/dismissed) | sink analytics/audit (events-telemetry.json) |
| **Audit de CONFIGURATION** (qui a changé quoi) | « **Qui** a activé ce trigger, **quand**, et **avant/après** ? » | `logAuditEvent('i18n-engine.update')` + `app_config_snapshots` | snapshots before/after (ADR-009) |

---

## 2. Audit de décisions — ce que `locale_suggestion_evaluated` capture (INV-19)

L'event maître (CONTRACT §7.3) est émis à **chaque** appel `evaluateSuggestionPolicy`, qu'il aboutisse à `show` ou `suppress`. Il porte :

- `decision` (`show`|`suppress`) — la sortie,
- `reason` (motif machine, ex. `engine-off`, `quiet-zone:NEVER-CHECKOUT`, `no-trigger`, `budget`, `same-lang`, `defer-abandon`, `show`),
- `profileMatched` (ProfileID never **ou** trigger qui a tranché, ou null),
- `suggested` / `served` / `page`.

Pour l'audit (debug), on **joint un snapshot de signaux** non exposé à l'analytics public : les valeurs des signaux clés (`servedLocale`, `guessedLocale`, `confidence`, `dwellMs`, `scrollDepth`, `inCheckout`, `formFocused`, `cooldownActive`, `impressionsThisVisitor`, `dismissedPersistent`…) au moment de la décision. C'est ce qui rend chaque décision **explicable** (A3 retenu pour son explicabilité — comparative-approaches §1).

> **Échantillonnage** (CONTRACT §7.3) : `evaluated` est échantillonnable, MAIS `decision='show'` et les suppressions de **zone calme** (`quiet-zone:*`) sont **toujours** conservés à 100 % (sinon l'audit ne pourrait pas prouver INV-14). Les suppressions de masse (`engine-off`, `same-lang`) sont échantillonnées (défaut 5 %).

---

## 3. La vue `/admin/i18n/engine/audit`

Server Component : `requireAdmin('/admin/i18n/engine/audit')` → lit le flux d'audit de décisions + le journal de config. Trois zones.

### 3.1 Décisions récentes (table)
Liste paginée des dernières évaluations, **filtrable** par `decision`, `reason`, `profileMatched`, `page`, locale.

| Colonne | Contenu |
|---|---|
| Horodatage | quand |
| Décision | `show` / `suppress` (badge) |
| Raison | `reason` machine + libellé |
| Profil | `profileMatched` (never ou trigger) |
| served → suggested | ex. `fr → ar` |
| Page | pathname localisé |
| Signaux | snapshot dépliable (confidence, dwell, scrollDepth, inCheckout, budget…) |

Chaque ligne `show` se relie à son `locale_suggestion_shown` (et, si présent, `accepted`/`dismissed`) → on suit le **cycle de vie complet** d'une suggestion.

### 3.2 Santé agrégée (cartes)
Sur une fenêtre glissante (24 h / 7 j) :

| Métrique | Définition | Cible (consumer-psychology §6) |
|---|---|---|
| **Taux d'affichage** | shown / evaluated(eligibles) | observé, par profil |
| **Taux d'acceptation** | accepted / shown | **élevé** (pertinence) |
| **Dismiss < 2 s** | dismissed avec msToDecision<2000 / shown | **bas** (proxy d'agacement) |
| **Suppressions en zone calme** | suppressed `neverProfile ∈ {NEVER-CHECKOUT,NEVER-FORM,NEVER-DEEP-READ}` | doit être **le SEUL** chemin d'une suppression checkout/form/lecture — **0 shown** y est tolérée (INV-14/15) |
| **Compteurs par profil** | fire count par ProfileID (trigger: shown ; never: suppressed) | visibilité du « qui tire » |
| **% au breakpoint** | shown dont `trigger ∈ opportuneMoment` / shown | ~100 % (INV-17) |
| **Fréquence / visiteur** | shown / visiteur unique | ≤ 1 / cooldown (INV-16) |

### 3.3 Journal de configuration (cf. §5)
Les dernières entrées `i18n-engine.update` (acteur, version, note, diff before/after).

---

## 4. Alerting — seuils

| Alerte | Condition | Sévérité | Sens |
|---|---|---|---|
| **A-QUIETZONE-LEAK** | ≥ 1 `locale_suggestion_shown` sur une page checkout/form OU corrélée à `inCheckout/formFocused=true` | **CRITIQUE** | viole INV-14/15 — bug à corriger immédiatement |
| **A-ENGINE-ON-UNEXPECTED** | `decision='show'` alors que `engineEnabled=false` en config | **CRITIQUE** | viole INV-13 |
| **A-OVER-CAP** | fréquence/visiteur > maxImpressions (cap dépassé) | haute | viole INV-16 |
| **A-ANNOYANCE** | Dismiss<2s rate > seuil (ex. 40 %) sur un profil | moyenne | profil mal calibré → envisager désactivation |
| **A-OFF-BREAKPOINT** | % au breakpoint < ~100 % (shown hors opportuneMoment) | moyenne | viole INV-17 |
| **A-DEFER-STARVE** | taux d'`evaluated` `defer-abandon` anormalement haut | info | TTL trop court / breakpoints trop rares |

> Les alertes critiques sont les **invariants durs** (INV-13/14/15) : une seule occurrence est un défaut, pas une tendance.

---

## 5. Audit de configuration — qui/quand/avant-après (ADR-009)

Identique au write path de la config (admin-config-model §5.2). À **chaque** PUT accepté sur la section `i18n_suggestion_engine` :

1. `upsertAppConfig('i18n_suggestion_engine', { payload, expectedVersion, actorId, note })` → `version+1`.
2. INSERT dans `app_config_snapshots` : `{ payload (état APRÈS), version, actorId, note, capturedAt }` (le **before** = snapshot précédent → diff reconstituable).
3. `logAuditEvent({ action:'i18n-engine.update', resourceType:'app_config', resourceId:'i18n_suggestion_engine', meta:{ version, snapshotId, note, before, after } })`.

La vue audit (§3.3) affiche le **diff** lisible : ex. « TRIG-ENTRY-MISMATCH.enabled : false → true par admin@…, v7→v8, note: 'A/B 50%' ». C'est ainsi qu'on retrace **qui a allumé le moteur** et **avec quels profils**.

> Échec (401/403/422/409) ⇒ **aucun** snapshot/audit (cohérent admin-config-model §7).

---

## 6. (b) Comment TESTER que l'audit reflète la réalité (INV-19)

### Décisions ↔ réalité
- [ ] Forcer un `show` (trigger activé + signaux matchants + breakpoint) ⇒ la vue audit montre 1 ligne `show` + le `profileMatched` attendu + le snapshot de signaux cohérent ; un `locale_suggestion_shown` correspond.
- [ ] Forcer un `suppress` en checkout (`inCheckout=true`) ⇒ vue montre `suppress` / `NEVER-CHECKOUT` ; **0** `show` ; alerte A-QUIETZONE-LEAK **non** levée.
- [ ] Injecter (en test) un faux `show` sur page checkout ⇒ A-QUIETZONE-LEAK levée (test négatif de l'alerte).
- [ ] `engineEnabled=false` ⇒ toutes les lignes sont `suppress reason='engine-off'` ; aucun `show` ; A-ENGINE-ON-UNEXPECTED **non** levée. Forcer un show ⇒ alerte levée (négatif).

### Agrégats ↔ events bruts
- [ ] Le « taux d'acceptation » de la carte == accepted/shown recomptés depuis les events bruts (réconciliation).
- [ ] « Suppressions en zone calme » == count des `suppressed` avec `neverProfile ∈ {checkout,form,deep-read}` ; aucune autre source de suppression checkout.
- [ ] « % au breakpoint » == shown dont `trigger ∈ opportuneMoment` / shown (INV-17).
- [ ] Fréquence/visiteur ≤ maxImpressions ; une 2e impression au-delà du cap ⇒ A-OVER-CAP (INV-16).

### Échantillonnage
- [ ] `show` et `quiet-zone` jamais droppés par l'échantillonnage (présents à 100 % même sous forte charge).
- [ ] `same-lang`/`engine-off` respectent `evaluatedSampleRate` (volume réduit mais représentatif).

### Audit de configuration
- [ ] Un PUT acceptant `engineEnabled:true` ⇒ 1 entrée `i18n-engine.update` (acteur, v, note) + 1 snapshot ; le diff before/after affiché est exact.
- [ ] Restaurer un snapshot antérieur ⇒ nouvelle entrée d'audit (pas de réécriture silencieuse de l'historique).
- [ ] 401/403/422/409 ⇒ **aucune** entrée d'audit / snapshot.
- [ ] Reset d'un `dismissedPersistent` (action admin) ⇒ tracé (qui/quand) ; les évaluations suivantes peuvent à nouveau aboutir (cohérent INV-16 « sauf reset admin »).
