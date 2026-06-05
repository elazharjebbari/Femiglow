# Scénarios métier — Module 04 Audiences

Personas :
- **Nadia** — responsable CRM (opérateur), construit les segments.
- **Système** — moteur de compilation/snapshot/purge.

---

## Scénario AUD-S1 — Cibler les clientes de Casablanca ayant acheté sans ouvrir d'email depuis 60 jours, et PROUVER l'exactitude du ciblage

**Objectif métier** : campagne de réactivation ultra-ciblée. Le ciblage DOIT
être exact : aucune cliente hors cible, aucune cliente cible oubliée.

**Préconditions (jeu de données seedé en vraie DB)**
- `L1` — Casablanca, 2 commandes, dernière ouverture email il y a 90 j.
- `L2` — Casablanca, 1 commande, a ouvert un email il y a 5 j.
- `L3` — Rabat, 3 commandes, jamais ouvert.
- `L4` — Casablanca, 0 commande.
- `L5` — Casablanca, hard_bounce (suppressé).
- Cible métier attendue = **{ L1 }** (Casablanca + a acheté + pas d'ouverture 60 j + non suppressé).

**Étapes**
1. Nadia ouvre `/admin/emails/audiences/new`, construit dans le builder :
   `all[ country=Casablanca, order_count gte 1, received_without_open(within 60d, threshold 1) ]`,
   exclusions `hard_bounce=true`.
2. Elle clique « Aperçu » → `preview-size` + `preview-sample`.
3. Le système compile les règles → SQL, exécute le count + échantillon.

**Oracles (état cible vs écarts)**
- **État cible** : `preview-size == 1`, échantillon = `{ L1 }`.
- **Écart A-AUD-1** (`country` → `TRUE`) : le filtre Casablanca n'a aucun effet →
  L3 (Rabat) entre indûment. Le test `AUD-CMP-008` **prouve** ce bug (count
  inchangé par le filtre country).
- **Écart A-AUD-2** (`received_without_open`/email events non corrélés au lead) :
  la condition d'ouverture s'évalue globalement → L2 (qui a ouvert) n'est pas
  correctement exclue. Le test `AUD-CMP-023/025` **prouve** le tout-ou-rien.
- L5 (hard_bounce) DOIT être exclue par l'exclusion → `AUD-CMP-037`.

> Ce scénario est la pierre angulaire : il transforme « l'audience a l'air
> juste » en **preuve chiffrée** ligne à ligne sur un jeu connu.

---

## Scénario AUD-S2 — Snapshot, crash, et le piège de l'idempotence

**Objectif métier** : figer une audience pour un envoi reproductible, et garantir
qu'un incident ne produit pas un snapshot inutilisable réutilisé en boucle.

**Préconditions** : audience valide ; `snapshotKey='campaign-aid-2026'`.

**Étapes**
1. Premier snapshot lancé : `INSERT (status=running)`, puis le process CRASHE
   pendant l'`INSERT…SELECT members` → la ligne reste `running` (zombie).
2. La campagne retente le snapshot avec **le même** `snapshotKey`.

**Oracles (état cible vs écart A-AUD-4)**
- **État cible** : l'idempotence ne doit renvoyer un snapshot existant **que s'il
  est `done`**. Un snapshot `running`/`errored` doit être ré-exécuté (ou un
  reaper doit l'avoir marqué `errored`).
- **Écart A-AUD-4** : l'idempotence actuelle renvoie le snapshot **quel que soit
  son statut** → la campagne récupère le **zombie `running`** (`size=0`,
  membres absents) → envoi vide. Le test `AUD-SNAP-005/006` **prouve** ce piège.

---

## Scénario AUD-S3 — Audience VIP par cumul d'achats, combinaison imbriquée

**Objectif métier** : « VIP » = a passé ≥ 3 commandes **ET** (a dépensé ≥ 1000 MAD
**OU** possède le tag `ambassadrice`).

**Préconditions (seedé)**
- `V1` — 3 commandes, 1200 MAD, sans tag → **cible**.
- `V2` — 5 commandes, 200 MAD, tag `ambassadrice` → **cible**.
- `V3` — 2 commandes, 5000 MAD → hors cible (< 3 commandes).
- `V4` — 4 commandes, 300 MAD, sans tag → hors cible.

**Étapes**
1. Builder : `all[ order_count gte 3, any[ order_total gte 100000, has_tag(ambassadrice) ] ]`.
2. Preview.

**Oracles**
- Cible attendue = `{ V1, V2 }`. Le test `AUD-CMP-034` vérifie la sémantique
  `A ET (B OU C)` exactement.
- `has_tag(ambassadrice)` doit fonctionner contre le **vrai** schéma `lead_tag`
  (écart A-AUD-5 : drift uuid/text) — `AUD-CMP-030`.

---

## Scénario AUD-S4 — Exclusions flag par flag

**Objectif métier** : valider que chaque exclusion retire **exactement** la bonne
population, sans sur-filtrer.

**Préconditions (suppressions seedées)**
- `S1` — reason `hard_bounce`.
- `S2` — reason `unsubscribe`.
- `S3` — reason `manual_admin`.
- `S4` — non suppressée, `consent_marketing=false`.
- `S5` — non suppressée, consentante → toujours présente.

**Étapes**
1. Audience large `all[ consent_marketing=true ... ]` ré-évaluée 4 fois, en
   activant un flag d'exclusion à la fois.

**Oracles**
- `hard_bounce=true` retire S1 (et seulement S1) → `AUD-CMP-037`.
- `unsubscribe=true` retire S2 → `AUD-CMP-038`.
- `manual_suppression=true` retire S3 → `AUD-CMP-039`.
- `marketing_optout=true` retire S4 (consent=false) → `AUD-CMP-040`.
- S5 reste présente dans tous les cas.
