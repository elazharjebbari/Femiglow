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
