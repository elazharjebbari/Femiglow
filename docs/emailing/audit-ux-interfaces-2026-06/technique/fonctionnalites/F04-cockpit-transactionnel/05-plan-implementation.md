# F04 — Plan d'implémentation

> F04 est le chantier le plus dense de la section. Découpé en lots P2.2 / P2.3
> ordonnés du **moins risqué au plus risqué**, chaque lot livrable et testé
> indépendamment. Principe directeur : **la lisibilité d'abord (sans backend),
> les routes serveur ensuite (avec tests d'intégration AVANT le branchement UI),
> la sélection globale en dernier** (c'est elle qui orchestre tout).
>
> Gate transverse (cf. `05-strategie-tests.md` §5) à chaque PR : batterie F04
> verte · suite emails verte · tsc+lint+next build · axe 0 serious/critical ·
> grille réseau 6/6 par action · conformité de contrat pour tout endpoint touché.

---

## Lot P2.2-A — Lisibilité pure (aucun backend)

**Contenu (frontend uniquement, données déjà disponibles) :**
- CKPT-03 : erreurs de parsing visibles (liseré + section warning). Le parser
  produit DÉJÀ `errors[]` → pur rendu.
- CKPT-02 (moitié) : map `SKIP_REASON_FR` + branchement dans le feedback bulk
  existant (par ids). Source de vérité unique, réutilisée plus tard côté serveur.
- CKPT-05/06 : tooltips « 5 000+ » et placeholder sparkline file.
- CKPT-07 : feedback reap précisant le statut résultant.
- CKPT-12 : saut de page (calcul offset pur).
- DASH-12 : bannière `?from=health`.
- CKP-F13 : timeline pédagogique (légende, badges source, encart sent stagnant,
  retour sticky) — rendu serveur du détail.

**Tests d'abord :** `F04-U-013..035` (parser err, map skip, saut page, csvEscape)
+ `F04-C-006..009, 041..047, 049..063`.

**Risque :** quasi nul (pas d'I/O nouvelle). **Rollback :** par flag d'affichage
ou revert du lot — aucune migration, aucun effet DB.

---

## Lot P2.2-B — Route EXPORT serveur (CKPT-01, critique)

**Contenu :**
- `POST /api/admin/emails/transactional/export` : Zod `ExportInputSchema`
  (filterState sans pagination), `requireAdmin`, audit-log, **réutilise
  `buildWhere` de `search.ts`** (interdiction de dupliquer le compilateur).
- Streaming `ReadableStream` (`text/csv`), BOM + RFC 4180, **keyset pagination**
  `(createdAt, id)`, **cap 100 000** + flag `capped`, en-têtes (filename daté,
  no-store).

**Tests AVANT branchement UI (couche I) :** `F04-I-001..009` — conformité de
contrat, auth, BOM, échappement RFC 4180 sur données piégées, **keyset stable
sous insertions concurrentes**, cap exact à 100 000, nom de fichier daté, audit.

**Puis UI :** libellé honnête page vs serveur (`F04-C-031..034`) + grille réseau
export (`F04-C-035..040`).

**Risques :**
- *Perf export* : un OFFSET sur 100 000 lignes serait O(n²) — d'où le keyset
  obligatoire ; test `F04-I-005` prouve la stabilité sous charge concurrente.
- *Mémoire* : ne jamais matérialiser le CSV entier → stream chunké, test de
  volume `F04-I-006`.
- *Divergence d'ensemble* : si l'export ne réutilisait pas `buildWhere`, il
  exporterait un sous-ensemble différent de `/search` → interdiction stricte de
  duplication (vérifiée en revue + test d'ensemble côté bulk-by-filter `I-010`).

**Rollback :** retirer le bouton « serveur » → l'UI retombe sur l'export client
« (page) » (chemin existant intact). La route reste inerte si non appelée.

---

## Lot P2.3-A — Route BULK-RETRY-BY-FILTER + dry-count (CKPT-02)

**Contenu :**
- `POST /bulk-retry-by-filter`, `{ filterState, dry_run }`. **Réutilise
  `buildWhere`** (même compilateur que `/search` et `/export`).
- `dry_run:true` → `{ count }` (éligibles) ; `dry_run:false` → `{ retried,
  skipped[] }`. **Cap dur 10 000** → 422 `cap_exceeded`. Audit-log.

**Tests AVANT UI (couche I) :** `F04-I-010..017` — en particulier `I-010` **MÊME
ensemble que `/search`** pour le même filtre (l'invariant central), `I-011`
dry_run ne mute rien, `I-013` cap 422, `I-014` auth, `I-015` conformité contrat.

**Puis UI :** dry-count → ConfirmDialog « 5 312 emails seront relancés »
(`F04-C-020..024`) + grille réseau (`F04-C-025..030`).

**Risques :**
- *Charge du dry-count* : un COUNT exact sur un gros filtre peut être lent ;
  borner via le seuil `truncated` existant et arrêter le compte à `cap+1` (on
  n'a pas besoin du nombre exact au-delà de 10 000, juste « > cap »).
- *Divergence compilateur* : idem export — duplication interdite, prouvée par
  `I-010`.

**Rollback :** masquer l'entrée « retry par filtre » → seul le retry par ids
(existant) reste. La route inerte si non appelée. Aucune migration.

---

## Lot P2.3-B — Sélection globale (mode page|filter) — orchestration (CKPT-04)

**Dernier car il câble tout** : il consomme l'export serveur (P2.2-B) et le
bulk-by-filter (P2.3-A). Sans eux, une sélection « 5 312 » n'aurait aucune action
honnête à offrir.

**Contenu :**
- Machine d'état de sélection `page | filter` (cf. `02-spec-technique.yaml §5`) :
  bannière d'amorce (visible ssi `total>page`), bascule, **survie au changement
  de page/tri**, **annulation au changement de filtre avec toast info**, décochage
  rompt l'exhaustivité.
- Libellés dynamiques des boutons (« Retry (5 312) », « Exporter CSV (serveur,
  ~5 312 lignes) »).

**Tests :** `F04-C-010..019` (transitions, compteurs, survie/annulation) +
parcours `F04-C-074` + a11y bannière `F04-A-003`.

**Risque :** bugs d'enchaînement d'états (le mode le plus subtil) — couverts par
les tests « parcours opérateur » longs (§3.3 stratégie). **Rollback :** retirer
le lien d'amorce → on retombe sur la sélection page-only (existante, avec son
avertissement `select-all-page-warning` déjà en place).

---

## Lot P2.3-C — E2E scénarios métier + a11y de fin

**Contenu :** les 6 specs `SM-F04-01..06` (`F04-E-001..006`) + axe Playwright
pages (`F04-A-001/002`). SM-F04-01 est déjà modelé dans
`modeles-code/exemple-e2e.spec.ts`.

**Gate de fin de phase (G8) :** 100 % des E2E F04 verts contre `femiglow_emailqa`.

---

## Ordre de fusion et dépendances

```
P2.2-A (lisibilité, 0 backend)        ──┐
P2.2-B (export serveur + I-tests)     ──┤
P2.3-A (bulk-by-filter + I-tests)     ──┼──► P2.3-B (sélection globale)
                                         │        │
                                         └────────┴──► P2.3-C (E2E + a11y)
```

- P2.2-A indépendant (peut partir en premier, sans risque).
- P2.2-B et P2.3-A indépendants entre eux ; **chacun verrouille son contrat par
  des tests d'intégration AVANT tout branchement UI**.
- P2.3-B dépend des deux routes (sinon pas d'action honnête à brancher).
- P2.3-C clôt en validant les parcours de bout en bout.

## Risques transverses récapitulés

| Risque | Mitigation | Test garant |
|---|---|---|
| Perf export (OFFSET sur 100k) | keyset `(createdAt,id)` + stream chunké | F04-I-005, F04-I-006 |
| Divergence compilateur si dupliqué (INTERDIT) | réutiliser `buildWhere` partout | F04-I-010 |
| Charge du dry-count | arrêt du compte à cap+1, pas de COUNT exact au-delà | F04-I-013 |
| Faux sentiment d'exhaustivité | libellés honnêtes + annulation au chgt de filtre | F04-C-014, F04-C-033 |
| Faux succès réseau | grille 6 cas systématique par action | F04-C-025..040, 048, 069, 071, 072 |
