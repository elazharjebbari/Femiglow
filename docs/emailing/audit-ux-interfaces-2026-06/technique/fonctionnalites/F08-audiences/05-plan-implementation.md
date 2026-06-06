# F08 — Audiences — plan d'implémentation (phase P2.4)

> Ordre dicté par le risque : on neutralise d'abord le défaut **critique** (AUD-01,
> ciblage silencieusement faux), puis les validations, puis le drift/membres, puis les
> textes. Chaque étape se termine quand sa tranche de `03-batterie-tests.csv` est verte
> (gate G1) et que `tsc + lint + next build` passent (G5).

---

## Étape 1 — Neutralisation des tags (AUD-01) — PRIORITÉ ABSOLUE — 3 lignes de défense

Le défaut est critique (envoi de masse hors cible). On le ferme aux **3 surfaces** dans
le même PR, pour qu'aucune ne puisse être contournée.

1. **Compilateur** (`rules-compiler.ts`) — fondation : `has_tag` → `FALSE`,
   `not_has_tag` → `FALSE` ; retirer l'import/usage de `leadTag` pour ces 2 kinds ;
   `logger.warn('audience.rules.tag_neutralized', { kind, tag })`. Garder le rebranchage
   M5.5 documenté (flag `TAGS_ENABLED`).
   → Tests d'abord : F08-U-001..004, F08-I-095.
2. **Menu** (`AudienceRulesBuilder/AddRuleMenu`) : items tag `disabled` + `aria-disabled`
   + suffixe « (bientôt — M5.5) » ; `onPick` non appelé.
   → F08-C-026/027/028.
3. **Règle existante** (`RuleEditor/TagEditor` + validation étape 2 de `AudienceWizard`) :
   bannière `role="alert"` + blocage de Continuer + retrait possible.
   → F08-C-029/030/031.

**Sortie d'étape** : aucune audience tag ne peut être créée ni sauvée ; les legacy sont
visiblement signalées ; un snapshot d'audience tag donne size 0 (prouvé en intégration).

---

## Étape 2 — Validations de règles (AUD-02/05/07/09)

D'abord la **logique pure** (helpers testables hors UI), puis le **branchement UI**.

**2a. Unitaires purs**
- `validateBetween`/`swapBounds` (numérique + date) — F08-U-005..009.
- `isKnownCountry` + test d'alignement `countries.ts` ↔ `COUNTRY_CALLING_CODE` —
  F08-U-010/011/012/016/017.
- conversions MAD↔cents (existant, non-régression) — F08-U-013/014/015.

**2b. UI (composant)**
- `RuleEditor` : message borne + bouton « Inverser les bornes » (numérique + date) —
  F08-C-038..042.
- `CountryMultiSelect` chips + bascule eq↔in avec **ConfirmDialog** (réutilise le socle
  F01) — F08-C-045/046/050/051/052/053.
- `email_pattern in` en chips (trim / anti-doublon / vide) — F08-C-047/048/049.
- Blocage étape 2 sur code pays inconnu — F08-C-054.

---

## Étape 3 — Drift, snapshots, membres paginés (AUD-03/06/11)

- **Drift** (`SnapshotsPanel` + helper `driftPct`) : âge relatif, live count (1 appel
  preview-size par chargement, hors boucle 4 s), écart %, surlignage > 10 %, purge —
  F08-U-021/022/023, F08-C-072..076.
- **Membres « Charger plus »** : offset = `members.length`, concat dédoublonnée, bouton
  masqué à épuisement, export CSV — F08-C-077/078/079/080, F08-I-096, F08-U-024.
- **Non-régression cycle** : auto-refresh 4 s, errored→Relancer, idempotence
  snapshotKey — F08-C-068..071, F08-I-092/093.

---

## Étape 4 — Textes pédagogiques & finitions (AUD-04/08/13 + TRV-01)

- Mention ET/OU dès la 1re règle — F08-C-036.
- Mode d'évaluation : textes détaillés verbatim sous chaque radio — F08-C-081/082.
- Message **timeout preview dédié** (route preview-size détecte 57014 + UI) —
  F08-C-064, F08-I-094.
- Hint R-011 sur règle pays (détail) — F08-C-085/086.
- **ConfirmDialog suppression** (remplace `window.confirm`) — F08-C-087/088/089.
- a11y builder (fieldset/legend) + axe — F08-C-055/056, F08-A-101/102.
- E2E métier — F08-E-098/099/100.

---

## Risques & atténuations

| Risque | Impact | Atténuation |
|---|---|---|
| **Faux positifs de validation sur audiences legacy en édition** | une audience valide créée avant les nouvelles règles devient « non sauvable » (ex. borne déjà inversée, code pays exotique, `in` historique en CSV) | la validation bloquante ne s'applique **qu'à la sauvegarde** (étape 2), jamais au chargement ; proposer l'auto-correction (auto-swap, « retirer la règle morte ») plutôt que bloquer sans issue ; migration de lecture tolérante (CSV `in` historique → chips). |
| **Coût du live count sur la liste des snapshots** | un `count(*)` borné par snapshot multiplierait les requêtes lourdes à chaque ouverture du détail | live count calculé **une seule fois** par page (l'audience a un seul ciblage live), **hors** de la boucle d'auto-refresh 4 s ; réutilise `previewAudienceSize` (txn `statement_timeout`). Si timeout : afficher « live indisponible » plutôt que bloquer le drift. |
| **Neutralisation tag qui casse un snapshot legacy** | un snapshot figé d'avant la neutralisation reste valide ; mais un **re-snapshot** d'audience tag donne maintenant 0 | comportement voulu (ne plus envoyer hors cible) ; documenté ; la bannière prévient avant tout re-snapshot. |
| **Régression `not_has_tag` → TRUE** | retour silencieux du défaut critique | test de verrouillage F08-U-002 + intégration F08-I-095 (size 0) ; revue obligatoire que le compilateur n'émet **jamais** `NOT EXISTS`/`TRUE` pour un tag. |
| **Drift % division par zéro** | snapshot vide (size 0) | `max(1, size)` au dénominateur — F08-U-022. |
| **Charger plus : doublons / total mouvant** | membres dupliqués ou total faux entre deux clics | offset = `members.length` + dédoublonnage par email — F08-C-077. |

---

## Rollback

- **Granularité** : chaque étape est un commit/PR indépendant ; rollback = `git revert`
  du commit concerné (les 4 étapes ne partagent pas de migration de schéma).
- **Pas de migration DB** dans F08 (les champs `evaluationMode`, `purgeableAfter`,
  `snapshotKey`, `email_audience_snapshot_member` existent déjà) → rollback purement
  applicatif, suivi de `pnpm build` + `systemctl restart femiglow.service`.
- **Tags** : si la neutralisation devait être levée d'urgence (M5.5 livré plus tôt),
  un seul flag `TAGS_ENABLED` rebranche compilateur + menu + retire la bannière —
  pas de revert massif.
- **Garde-fou de déploiement** : ne jamais déployer l'étape 1 (tags) **partiellement**
  (ex. UI sans compilateur) — les 3 défenses partent ensemble, sinon le défaut critique
  reste ouvert par l'une des surfaces.
</content>
