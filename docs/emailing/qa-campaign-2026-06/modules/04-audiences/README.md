# Module 04 — Audiences (`/admin/emails/audiences`)

> Périmètre : moteur de segmentation FemiGlow (M5.3) — builder de règles
> récursif AND/OR, compilation règles → SQL, exclusions, preview (taille +
> échantillon), snapshot (matérialisation figée), purge, autocomplétions, CRUD.
> Inventaire : **F-040 → F-046**.

---

## 1. Fonctionnement optimal (état cible)

### 1.1 Grammaire des règles — `rules-types.ts`

Une audience est définie par un `RulesGroup` récursif (`kind: 'all' | 'any'`,
profondeur max 4) et des `exclusionFlags`. Chaque feuille est une `Rule`
discriminée par `kind`. **15 types de règles** :

| # | kind | Sémantique cible | Colonne/table |
|---|------|------------------|----------------|
| 1 | `email_pattern` | filtre email (contains/starts/ends/equals/in) | `leads.email` (ILIKE / =) |
| 2 | `country` | pays du lead | **PAS de colonne** → écart A-AUD-1 |
| 3 | `consent_marketing` | consentement marketing booléen | `leads.consent_marketing` |
| 4 | `created_at` | date de création (before/after/between/within) | `leads.created_at` |
| 5 | `order_count` | nombre de commandes (since/until) | subquery `orders` |
| 6 | `order_total` | somme dépensée (cents) | subquery `SUM(orders.total_cents)` |
| 7 | `has_ordered_product` | a commandé un produit donné | `EXISTS orders.form_id` |
| 8 | `last_order_at` | date dernière commande | `MAX(orders.created_at)` |
| 9 | `email_opened` | a ouvert (within/minCount) | `email_event type=opened` |
| 10 | `email_clicked` | a cliqué (within) | `email_event type=clicked` |
| 11 | `received_without_open` | reçu N sans ouvrir | `email_event sent vs opened` |
| 12 | `inactive_since` | inactif depuis N jours | `NOT EXISTS user_event` |
| 13 | `session_count` | nb de sessions distinctes | `COUNT(DISTINCT session_id)` |
| 14 | `has_tag` | possède un tag | `EXISTS lead_tag` |
| 15 | `not_has_tag` | ne possède pas un tag | `NOT EXISTS lead_tag` |

### 1.2 Compilateur — `rules-compiler.ts`

`compileRulesToSql(rules, exclusions) → { where: SQL }`. Caractéristiques cibles :

- **Paramétrisation Drizzle** native (aucune string-concat de valeur opérateur).
- `validateDepth()` avant compilation (anti-DoS, MAX_DEPTH=4).
- `compileGroup` : `all → AND(...)`, `any → OR(...)` ; groupe `all` vide → `TRUE`,
  groupe `any` vide → `FALSE`.
- `applyExclusions` : `NOT IN (SELECT email FROM email_suppression WHERE reason IN
  (...))` selon flags + `consent_marketing=true` si `marketing_optout`.
- `within` relatif (`30d`, `12h`) → `now() - interval '...'`.

**État cible métier** : pour un jeu de données connu, le SQL compilé doit
sélectionner **exactement** les leads attendus — ni plus, ni moins. C'est la
garantie centrale (cf. scénario A-S1 « prouver l'exactitude du ciblage »).

### 1.3 Preview — `preview.ts`

- `previewAudienceSize(rules, exclusions)` → `{ size, durationMs }`, borné par
  `SET LOCAL statement_timeout = 5000`.
- `previewAudienceSample(rules, exclusions, limit≤50)` → `{ samples, size }`.

### 1.4 Snapshot — `snapshot.ts`

Matérialise une audience en liste figée. Cycle de vie cible :

```
INSERT snapshot (status=running) → INSERT…SELECT members → UPDATE size,status=done
                                  └─(erreur)→ UPDATE status=errored, erroredReason
```

Idempotence : si `snapshotKey` fourni et un snapshot `(audienceId, key)` existe
déjà, on **retourne l'existant** sans réinsérer. Purge à J+90 (`purgeableAfter`).

### 1.5 Builder UI — `AudienceRulesBuilder.tsx` + `RuleEditor.tsx`

Composant **contrôlé** récursif : ajout de règle (menu hiérarchique par
catégorie), suppression, toggle ET/OU (visible si ≥ 2 conditions), ajout de
sous-groupe (kind opposé au parent), récursion limitée à `maxDepth`.
Autocomplétions : tags, produits, pays, templates.

---

## 2. Fichiers sources concernés

| Domaine | Fichier |
|---------|---------|
| Types/grammaire | `apps/web/src/lib/mail/audiences/rules-types.ts` |
| Compilateur | `apps/web/src/lib/mail/audiences/rules-compiler.ts` |
| Preview | `apps/web/src/lib/mail/audiences/preview.ts` |
| Snapshot | `apps/web/src/lib/mail/audiences/snapshot.ts` |
| Purge | `apps/web/src/lib/mail/audiences/purge.ts` |
| Schémas API | `apps/web/src/lib/mail/audiences/schemas.ts` |
| Builder UI | `apps/web/src/components/admin/emails/audiences/AudienceRulesBuilder.tsx`, `RuleEditor.tsx` |
| Autocomplétions | `.../audiences/{Tag,Product,Country,Template}Autocomplete.tsx` |
| Defaults | `.../audiences/rule-defaults.ts` |
| API | `apps/web/src/app/api/admin/emails/audiences/**` |
| Schéma DB | `apps/web/src/lib/db/schema-emails.ts` (`emailAudience`, `emailAudienceSnapshot[_member]`) |

---

## 3. Écarts d'audit ciblés

| Réf | Défaut constaté | Test garde-fou |
|-----|-----------------|----------------|
| **A-AUD-1** | Règle `country` compile en `sql\`TRUE\`` → **matche TOUT LE MONDE**. Un ciblage « Casablanca » envoie à toute la base. | `rules-compiler-exhaustive.test.ts` : assert SQL contient `TRUE` et, en DB, le filtre country ne réduit PAS l'ensemble (RED, écart documenté). |
| **A-AUD-2** | `email_opened` / `email_clicked` : `EXISTS` **global** sur `email_event` (non corrélé au lead) → tout-ou-rien : soit toute la base matche, soit personne. | DB seedée : un lead a un évènement `opened`, un autre non → on prouve qu'ils matchent **tous deux** (bug) au lieu du seul lead concerné. |
| **A-AUD-3** | `inactive_since` : `sql.raw(String(rule.days))` — fragile (injection si non validé en amont, format). | Test : valeurs limites (0, 3650) + assertion que le SQL est paramétré/borné. |
| **A-AUD-4** | Snapshot **zombie** `running` à vie si crash ; pire, l'idempotence par `snapshotKey` **renvoie le zombie** au lieu d'en refaire un. | `snapshot-lifecycle.integration.test.ts` : zombie running + re-snapshot même key → on prouve qu'on récupère un zombie inutilisable. |
| **A-AUD-5** | `has_tag` dépend de `lead_tag` (drift uuid/text connu, M5.5). | Test DB : seed `lead_tag` au vrai schéma, has_tag/not_has_tag sélectionnent correctement (attrape le drift). |
| **A-AUD-6** | Exclusions à vérifier flag par flag (suppression/bounce/optout). | Suppressions seedées par raison → chaque flag retire exactement les bons emails. |

---

## 4. Couverture & livrables

- `test-matrix.csv` — ≥ 60 lignes (chaque règle + combinaisons + exclusions +
  preview + snapshot + builder + suppression référencée).
- `scenarios-metier.md` — 4 scénarios bout-en-bout.
- `test-plan.yaml` — suites machine-lisibles.
- `cycle-snapshot.puml` — cycle de vie du snapshot.
- `specs/rules-compiler-exhaustive.test.ts` — table-driven, chaque règle (unit +
  DB seedée : qui matche / qui ne matche pas).
- `specs/audience-builder.msw.test.tsx` — composant + MSW (preview, autocompletes).
- `specs/snapshot-lifecycle.integration.test.ts` — vraie DB (cycle/zombie/idempotence/purge).
