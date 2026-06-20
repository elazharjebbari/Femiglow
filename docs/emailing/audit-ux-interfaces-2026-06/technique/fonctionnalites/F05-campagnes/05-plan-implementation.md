# F05 — Campagnes — plan d'implémentation

> Phase P3 du programme. Contrainte absolue : **migrations additives, livrées
> AVANT le code lecteur** (déploiement single-instance en 2 temps, cf.
> 02-modele-donnees.md §3). `pnpm build` → `systemctl restart femiglow.service`
> obligatoire (mémoire). Gate G1 (batterie F05 100 % verte) + G2 (suite emails
> globale) à chaque PR.

---

## Vue d'ensemble des lots

```
P3.1 ── MIGRATION D'ABORD (2 temps) + non-régression machine d'états
P3.2 ── Adoption Wizard partagé (SOC-F05) + autosave + reprise + TZ é5 + /new + unicité
P3.3 ── Fallback estimation + test send outbox + détection orpheline + actions/toasts + métriques
```

Ordre impératif : **P3.1 avant tout code lecteur** ; P3.2 avant P3.3 (le
fallback et l'orpheline s'appuient sur le wizard refondu et les colonnes).

---

## Lot P3.1 — Migration d'abord (déploiement 2 temps)

**Temps 1 — migration seule (aucun code lecteur)** :
- `ALTER TABLE email_campaign_link ADD COLUMN IF NOT EXISTS wizard_step smallint;`
- `ALTER TABLE email_campaign_link ADD COLUMN IF NOT EXISTS schedule_timezone text;`
- Génération Drizzle (`drizzle-kit generate`) → **relire le SQL produit** (gotcha
  drift schema.ts/DB réel). Appliquer sur `femiglow_test` puis `femiglow_emailqa`.
- Test `schema-drift` (introspection vs schema.ts) vert sur les DEUX bases.
- Prod : `psql` transactionnel + smoke `SELECT wizard_step, schedule_timezone` +
  restart service. Les colonnes sont **inertes** tant que P3.2 n'est pas livré.

**Temps 2 (dans ce lot ou P3.2)** : factories + presets de test
(`makeCampaignLink` étendu, presets `orphanCampaign`, `draftAtStep`) + handlers
MSW pour les nouveaux contrats (`saveWizardProgress`, `*ViaOutbox`,
`reassociate`, `name-available`, `preview-size`).

**Non-régression incluse** : verrouiller `isLegalTransition` (table 7×7,
`F05-U-001..025`) et R-010 (`F05-I-011`) AVANT toute refonte — filet de sécurité.

**Tests du lot** : `F05-U-001..030`, `F05-I-005`, `F05-I-011`, `schema-drift`.

---

## Lot P3.2 — Wizard partagé + autosave + reprise + TZ + /new + unicité

**Contenu** :
1. **Adoption du Wizard partagé (SOC-F05)** : remplacer la mécanique
   `useState<Step>` locale de `CampaignWizard.tsx` par `useWizard` (stepper
   cliquable CAMP-05, Ctrl+flèches CAMP-14, focus management). Le *contenu* des 6
   étapes est conservé ; seule la navigation est déléguée.
2. **Autosave (CMP-F10)** : hook autosave du socle branché sur
   `saveWizardProgress` (debounce 2 s trailing, flush au passage d'étape + blur).
   Indicateur Freshness « enregistré il y a Xs ». Persistance `wizard_step`.
3. **Reprise** : la page `/edit` lit `wizard_step` + payload et hydrate le wizard
   à la bonne étape.
4. **é5 TZ explicite (CMP-F07)** : annotation `Africa/Casablanca`, conversion
   wall-clock→UTC via `Intl`/`date-fns-tz`, persistance `schedule_timezone`,
   validation futur sur l'instant converti.
5. **Route /new (CMP-F08)** : RSC crée le draft + redirect `/edit`.
6. **Unicité du nom (CMP-F12)** : `checkCampaignNameAvailable` + warning non
   bloquant (debounce 500 ms).
7. **Chips listes é2 (CMP-F11)** + erreur honnête Listmonk down (CMP-F09/LMK-04).

**Tests du lot** : `F05-C-010..034`, `F05-A-001..006`, `F05-C-001..009`,
`F05-I-001..002`, `F05-I-012..013`, `F05-U-026..035`, `F05-E-002`.

---

## Lot P3.3 — Fallback estimation + test send outbox + orpheline + actions + métriques

**Contenu** :
1. **Fallback estimation (CMP-F08 / CAMP-01)** : machine à états tentatives
   1..3 → bouton dégradé → ConfirmDialog (socle, saisie `ENVOYER`) →
   `finalize(skipEstimate:true)` ; succès tardif réactive le chemin normal.
2. **Test send corps libre (CMP-F09 / CAMP-04)** : `sendCampaignTestViaOutbox`
   (INSERT outbox + idempotency_key) ; routage UI selon présence de template.
3. **Détection orpheline (CMP-F13 / CAMP-15)** : `detectOrphan` + bannière +
   `markCampaignFailed` + `reassociateCampaign` (validation distante de l'id).
4. **Actions détail (CMP-F11)** : migrer `window.confirm` → ConfirmDialog (socle)
   + toasts ; duplication toast « planif réinitialisée / conserver » (CAMP-06).
5. **Métriques (CMP-F12)** : tooltips n/d honnêtes (CAMP-02), spinner + toast
   refresh, toast d'erreur honnête (CAMP-10).

**Tests du lot** : `F05-F-001..007`, `F05-T-001..112`, `F05-D-001..102`,
`F05-P-001..003`, `F05-O-001..006`, `F05-M-001..004`, `F05-I-003..010`,
`F05-I-014`, `F05-E-001/003/004/005/006`, `F05-X-001..004`.

---

## Risques & mitigations

| Risque | Détail | Mitigation |
|---|---|---|
| **Conflit autosave / transitions d'étape** | Le wizard existant persiste à chaque transition (`persistDraft`) ; l'autosave 2 s peut entrer en course avec un flush de passage d'étape ou avec finalize | Autosave **trailing avec flush au goNext** (le passage d'étape annule le timer en vol et écrit immédiatement) ; `saveWizardProgress` `WHERE status='draft'` → ne peut JAMAIS écrire sur une campagne finalisée. Test `F05-I-002`. |
| **Double création test send** | Un double-clic ou deux POST concurrents (outbox) pourraient livrer 2 épreuves | `testSending` posé AVANT l'await (verrou synchrone, pattern existant `sending`) + **idempotency_key** outbox `ON CONFLICT DO NOTHING`. Tests `F05-T-004`, `F05-I-004`. |
| **TZ et DST** | `Africa/Casablanca` suspend l'heure d'été (ramadan) → offset variable ; un offset codé en dur produit un envoi à la mauvaise heure | Conversion via `Intl`/`date-fns-tz` (offset lu **à l'instant T**, jamais constant) ; `schedule_timezone` persisté pour ré-affichage cohérent. Tests `F05-U-026..027`. |
| **Régression machine d'états** | La refonte du wizard pourrait introduire une transition illégale (poll rejouant un terminal) | `isLegalTransition` verrouillé en P3.1 (table 7×7) + garde serveur `controlCampaign`. Tests `F05-U-001..025`, `F05-I-005`. |
| **Orpheline mal détectée** | Critère trop laxiste → fausse bannière sur une campagne saine ; trop strict → orpheline ratée | Critère binaire exact (3 conditions) testé positif ET négatif (`F05-O-001..003`). |
| **Fallback contournement silencieux** | Le fallback pourrait masquer une vraie panne et envoyer aveuglément trop tôt | Seuil 3 échecs RÉELS + ConfirmDialog avec saisie `ENVOYER` + audit-log `skipEstimate`. Tests `F05-F-001/002/005`, `F05-I-010`. |

---

## Rollback

- **Code uniquement** : les colonnes `wizard_step` / `schedule_timezone` sont
  additives et inertes ; aucune migration descendante. Un rollback de chantier =
  redéploiement du commit précédent + restart. Les drafts en cours retombent sur
  le comportement legacy (wizard rouvre é1, TZ navigateur) sans perte de données.
- **Par lot** : P3.3 est rollback-able indépendamment de P3.2 (le wizard reste
  fonctionnel sans le fallback ni le test-send outbox — on retombe sur le test-send
  template-only et l'estimation bloquante d'origine). P3.2 rollback-able sans
  toucher la migration P3.1.
- **Garde-fou prod** : ne JAMAIS lancer les E2E Playwright contre la prod (pas
  d'isolation DB) — tout E2E sur instance dédiée + `femiglow_emailqa`.

---

## Enrichissement barème relevé (2026-06-20) — gates G10–G15

> Référence : ../../09-charte-ux-qualite.md. Ces exigences s'ajoutent au plan
> ci-dessus et conditionnent le gate de phase (cf. 07-plan-action-global.yaml,
> 08-runbook.md §5). Nouvelles couches de batterie à créer : **F05-D-*** (design)
> et **F05-S-*** (sécurité).

### Design haut calibre (G10)
- Figer un jeu de tokens dédié au périmètre campagnes : échelle typographique,
  échelle d'espacement 4/8 px, couleurs sémantiques succès/warning/danger/info —
  aujourd'hui le dossier ne fait que « consommer le socle » (Pill, Toast,
  EmptyState, ConfirmDialog) sans intention visuelle ; tracer un test de design qui
  vérifie l'emploi des tokens plutôt que des valeurs en dur.
- Spécifier la mise en page du **wizard 6 étapes** (écran phare) : grille avec
  **récap latéral persistant à é6**, densité, hiérarchie titre d'étape / aide
  contextuelle / champs, et progression visuelle du stepper au-delà des glyphes
  ✓/●/○ (états cliquables CAMP-05).
- Dessiner les **micro-interactions** : transition de passage d'étape (slide/fade),
  apparition des chips listes é2, transition « Enregistrement… » → « enregistré »
  (indicateur Freshness), apparition du bouton dégradé fallback estimation,
  disparition de la bannière orpheline.
- Soigner le rendu de l'**aperçu** : chrome de la boîte de réception simulée é4
  (avatar expéditeur, troncature réaliste sujet/preheader, état dark-mode inbox) et
  iframe template é3/é6 — point précis où le calibre se distingue.
- Dessiner les états **SKELETON/chargement** des données distantes (combobox
  templates Listmonk, liste des listes é2, estimation d'audience) — seul le cas
  d'ERREUR (bandeau honnête Listmonk down) est aujourd'hui dessiné ; éviter flash de
  contenu vide / spinner générique.
- Traiter le **responsive aux 3 breakpoints** (mobile/tablette/desktop) du wizard :
  stepper horizontal vs vertical, récap é6, `datetime-local` é5, et la table Liste
  6 colonnes (Nom, Sujet, Statut, Audience, Date, Actions) qui déborde.
- Spécifier la hiérarchie/densité/troncature/état de tri visuel de la **table Liste**
  et le layout de la **page Détail** (bloc métriques, barre d'actions, bannière
  danger orpheline) au-delà de « quels boutons selon le statut ».
- Snapshots visuels de non-régression **F05-D-*** à créer : un par écran — liste,
  wizard é1..é6, détail (Playwright screenshot / Chromatic).

### Assistance à la saisie (G11)
- **Email du test-send (é6)** → smart default = email de l'admin connecté +
  `datalist` des adresses admin récentes / domaine femiglow-maroc.com (aujourd'hui :
  input + validation Zod email seule). Test : « le champ test propose l'email admin
  par défaut ».
- **Nom interne de campagne (é1 / /new)** → suggestion de nom (ex. « Newsletter
  <mois> », dérivé du template ou d'une campagne existante) en plus du warning
  d'homonymie debounce 500 ms (qui est de la validation, pas de l'autocomplétion).
  Test : la saisie vide propose un nom dérivé.
- **Combobox template Listmonk (é3)** → typeahead avec surlignage du terme + tri par
  récence/usage (qualifier « recherchable » en critère testable). Test : « la frappe
  filtre et surligne ».
- **Liste des listes Listmonk (é2)** → champ de filtre / recherche (la liste peut
  être longue) en plus des checkboxes + chips. Test : filtre réduisant les options.
- **Sujet & preheader (é4)** → menu de jetons de personnalisation auto-complétables
  `{{ … }}` + détection emoji/spam-words, en plus des compteurs N/140 et N/200.
  Test : insertion d'un jeton via le menu ; variable inconnue signalée.
- **Corps HTML (é3)** → autocomplétion des merge-tags Listmonk `{{ … }}` disponibles
  + snippets, signalement des variables mal nommées. Test : `{{ … }}` propose la
  liste des merge-tags ; jeton inconnu averti.
- **`datetime-local` de planification (é5)** → smart defaults (prochain créneau
  recommandé, arrondi à l'heure pleine, mémorisation de la dernière heure) +
  raccourcis « demain 9h » / « lundi prochain ». Test : raccourci pré-remplit
  l'instant attendu (TZ Africa/Casablanca).
- **id Listmonk de ré-association (orpheline)** → `select` des campagnes Listmonk
  récentes « sending » sans correspondance locale, au lieu d'un entier tapé à
  l'aveugle. Test : la liste propose les candidates plutôt qu'une saisie libre.
- Renseigner chacun de ces champs dans **10-inventaire-assistance.csv** (champ →
  mécanisme autocomplete/smart-default/inline-validation → test associé).

### Sécurité (G12) — batterie F05-S-*
- **Sanitization/CSP du HTML opérateur** : le corps libre é3 et le `bodyHtml` du
  test-send partent dans l'iframe preview ET dans l'outbox/Listmonk — neutraliser le
  XSS stocké/injecté et durcir l'iframe au-delà de `sandbox=''` (CSP). Ce qui part
  réellement dans l'outbox doit être nettoyé. → **F05-S-001** (XSS é3),
  **F05-S-002** (XSS test-send), **F05-S-003** (CSP iframe preview).
- **Anti CSV-injection** : neutraliser les payloads `=,+,-,@` sur tout export/affichage
  tabulaire de la liste campagnes/métriques. → **F05-S-004**.
- **Rate-limit / anti-abus du test-send** : au-delà de l'`idempotency_key` par
  minute, plafonner les envois (vecteur d'abus). `checkCampaignNameAvailable` /
  `name-available` exposent l'existence de noms (énumération mineure) → durcir.
  → **F05-S-005**.
- **Authz exhaustive** : test d'intégration `requireAdmin` sur TOUTES les server
  actions à effet (`saveWizardProgress`, `finalize`, `controlCampaign`,
  `sendCampaignTestViaOutbox`, `reassociateCampaign`, `markCampaignFailed`,
  `preview-size`). → **F05-S-006**.
- **Garde SSRF/appartenance sur `reassociateCampaign`** : le GET Listmonk de l'id
  fourni doit vérifier que l'id appartient bien au compte (pas seulement son
  existence) + log de tentative d'id invalide. → **F05-S-007**.
- **Redaction PII** : ne pas logger l'email de test en clair dans
  `mail.campaign.test_sent` (hash/masquage du `to`). → **F05-S-008**.

### Observabilité / débogabilité (G14)
- Émettre des **logs structurés `<domaine>.<action>` sans champ `event`** (gotcha
  logger) pour les chemins aujourd'hui muets : `mail.campaign.autosave_failed`,
  `mail.campaign.estimate_failed` (1 log par tentative parmi les 3, avec statut +
  raison HTTP/parse/network), `mail.campaign.listmonk_down`,
  `mail.campaign.orphan_detected`. Tests d'émission asserrant code + raison.
- Propager un **correlation-id de session wizard** reliant tout le parcours
  (autosave → estimation → finalize) pour diagnostiquer « l'autosave qui échoue chez
  un opérateur ».
- Tracer explicitement les **chemins d'erreur** du fallback estimation : la cause des
  3 échecs doit être loggée serveur (aujourd'hui seul un compteur client est
  incrémenté). Test : un échec d'estimation émet un log structuré avec code+raison.
- Compteurs d'exploitation agrégés : taux d'autosave en échec, taux de recours au
  `skipEstimate`, nombre d'orphelines détectées. Test d'émission des compteurs.

### Performance / optimal (G13)
- Définir des **budgets p95** pour les server actions chaudes : `saveWizardProgress`,
  `checkCampaignNameAvailable` (frappé toutes les 500 ms), `preview-size`. Test :
  borne de temps en intégration.
- **Index fonctionnel `lower(name)`** pour `checkCampaignNameAvailable`
  (`SELECT EXISTS … lower(name)=lower($1)` à chaque frappe → seq scan sinon) +
  assertion EXPLAIN.
- **Index trigram/ILIKE** pour la recherche liste `?q=` (nom OU sujet) ; pagination
  20/page avec count optimisé / keyset. Test : EXPLAIN confirmant l'index.
- **Budget de bundle** pour `CampaignWizard` (client component lourd : 6 étapes +
  autosave + fallback) ; débounce autosave 2 s trailing déjà posé — verrouiller un
  budget chiffré et le faire échouer le build au dépassement.

### Modularité / évolutivité / concurrence (G15)
- **Frontières testées** : lint d'import interdisant au contenu d'étape de toucher la
  mécanique `useWizard` (SOC-F05) + test du contrat d'interface SOC-F05 ↔ contenu F05
  en isolation (la « délégation de la navigation au socle » doit être asserrée).
- **Conformité de contrat MSW ↔ prod** étendue (aujourd'hui seul `outbox` F05-I-014) :
  `saveWizardProgress`, `reassociateCampaign`, `checkCampaignNameAvailable`,
  `preview-size` — fermer le drift handler/prod sur tous les nouveaux contrats.
- **Versionnage du payload** : `payload_json` schématisé + versionné, mapping nommé
  des étapes (au lieu de `wizard_step` smallint 1..6 figé) ; test « ajout/réordon. d'une
  étape sans casser les drafts en cours » + tolérance aux drafts legacy (`wizard_step`
  null ET payload partiel ancien).
- **Cohérence caps UI ↔ `isLegalTransition`** : un test unique DÉRIVE les boutons
  visibles par statut de la même source que le serveur (au lieu des deux tables
  testées séparément) — éviter le drift UI/serveur.
- **Optimistic-lock multi-onglets** sur l'autosave : ajouter `updated_at`/version au
  payload, rejeter/merger explicitement un autosave périmé ; test d'intégration
  « deux onglets éditent le même draft → pas de perte silencieuse » + oracle du flush
  au blur via `sendBeacon` (remplacer le « best-effort » non testable).
- **Prévention (pas seulement détection) de l'orpheline** : transaction / outbox-pattern
  reliant « création Listmonk » et « persistance id » ; test injectant un crash entre
  les deux et asserrant un état récupérable. Compléter SM-F05-03 par un oracle de
  cohérence référentielle (audience/liste supprimée avant finalize).
- Borner `CampaignWizard.tsx` (risque de god-component) : cible de couverture chiffrée
  + limite de complexité/taille + convention documentée pour ajouter une validation
  d'étape.
