# Scénarios métier — Module 03 Campagnes

Personas :
- **Nadia** — responsable CRM FemiGlow (opérateur admin), prépare les campagnes.
- **Système** — cron de sync Listmonk (poll statuts/métriques).

---

## Scénario CMP-S1 — Campagne Aïd à 50 000 contacts, du brief à l'analyse post-envoi

**Objectif métier** : Nadia diffuse une offre Aïd al-Adha à toutes les clientes
ayant consenti au marketing, et suit l'envoi jusqu'aux KPI.

**Préconditions**
- Une audience FemiGlow `aid-2026` existe (règle `consent_marketing=true`),
  preview-size ≈ 50 000.
- Listmonk joignable ; `MAIL_FROM` configuré.
- Aucun brouillon en cours pour cette campagne.

**Étapes**
1. Nadia ouvre `/admin/emails/campaigns/new`, saisit le nom interne
   « Aïd 2026 — offre rituels ». → brouillon `draft` créé, redirection vers
   `/edit`.
2. Étape 2 : elle sélectionne l'audience native `aid-2026` (radio). Le wizard
   appelle `GET /audiences/{id}` puis `POST /preview-size` → affiche
   « ~50 000 envois (snapshot dynamique au moment du send) ».
3. Étape 3 : elle colle le HTML de l'agence (≥ 10 car.), sans template Listmonk.
4. Étape 4 : sujet « ✨ Aïd Moubarak — ton rituel offert » (≤ 140) + preheader.
5. Étape 5 : mode `now`. Estimation envoi total ≈ 50 000.
6. Étape 6 : récap fidèle, aperçu corps en iframe sandboxée. Elle coche
   l'acquittement et clique « 📨 Envoyer maintenant ».
7. `finalizeCampaign` : `snapshotAudience(aid-2026)` matérialise ~50 000 membres
   → `pushSnapshotToListmonk` crée une liste éphémère → `campaigns.create` →
   `updateStatus(running)` → mirror DB `status='sending'`, `startedAt` posé.
8. Redirection vers le détail ; statut « En cours d'envoi ».
9. Plus tard, le **cron de sync** poll Listmonk : `running→sending` puis,
   en fin de diffusion, `finished→sent` + `finishedAt` + métriques
   (sent/open/click/bounce).
10. Nadia ouvre le détail : KPI cohérents avec Listmonk.

**Oracles**
- Après l'étape 7 : exactement **1** campagne Listmonk créée ; `listmonkCampaignId`
  non nul en DB ; `status='sending'`.
- Le snapshot lié (`snapshotId`, `snapshotListmonkListId`) est persisté.
- Après l'étape 9 : `status='sent'`, `finishedAt` non nul, compteurs == Listmonk.
- Pendant la fenêtre de poll (≤ H+24) les métriques évoluent ; au-delà elles
  figent (écart A-CMP-3 documenté).

---

## Scénario CMP-S2 — Crash réseau pendant la finalisation, l'opérateur retente

**Objectif métier** : garantir qu'un incident réseau pendant l'envoi ne produit
**ni double envoi ni campagne fantôme**.

**Préconditions**
- Brouillon `draft` complet (audience native, sujet, corps).
- Listmonk répond `create` + `updateStatus`, puis la connexion DB tombe juste
  avant l'`UPDATE` mirror.

**Étapes**
1. Nadia clique « Envoyer maintenant ».
2. `finalizeCampaign` crée la campagne Listmonk (`lmCampaignId=777`) et appelle
   `updateStatus(777, running)` → l'envoi DÉMARRE côté Listmonk.
3. L'`UPDATE` mirror échoue (perte DB) → l'action server lève ; le wizard
   affiche un message d'erreur ; le bouton se réactive.
4. Nadia, croyant l'envoi échoué, **reclique** « Envoyer maintenant ».

**Oracles (état cible)**
- Au re-clic, `finalizeCampaign` recharge le brouillon : s'il a été marqué
  `sending` → l'action **rejette** (« cette campagne ne peut plus être
  finalisée »), `campaigns.create` n'est **PAS** rappelé → **une seule**
  campagne Listmonk.
- Si le brouillon est resté `draft` (cas du crash avant tout marquage), un
  mécanisme d'idempotence (clé idempotency ou unique `listmonk_campaign_id`)
  doit empêcher la **création d'une 2e** campagne — sinon double envoi.
- Aucune campagne Listmonk « fantôme » non référencée en DB ne doit subsister
  silencieusement (détectable par un test de réconciliation).

> Ce scénario matérialise l'écart **A-CMP-1 / A-CMP-2**. Le test d'intégration
> `finalize-atomicity.integration.test.ts` injecte le crash mid-flow.

---

## Scénario CMP-S3 — Campagne planifiée corrigée en brouillon

**Objectif métier** : Nadia planifie pour demain 09:00, puis se rend compte
d'une coquille et corrige avant l'heure.

**Préconditions** : brouillon prêt ; date planifiée dans le futur.

**Étapes**
1. Wizard étape 5 : mode `scheduled`, date = demain 09:00 (future). → étape 6 OK.
2. Elle envoie → `finalizeCampaign(sendNow=false)` → `updateStatus(scheduled)` →
   `status='scheduled'`, `startedAt=null`.
3. Avant l'heure, Nadia ouvre l'édition.

**Oracles (état cible)**
- L'édition n'est autorisée **que** si `status='draft'`. Une campagne
  `scheduled` ne doit PAS être éditable via le wizard draft sans
  dé-planification explicite (écart A-CMP-5 : transitions/édition non gardées).
- Si édition possible, toute remise en `draft` doit annuler/mettre à jour la
  campagne Listmonk planifiée (pas de divergence DB↔Listmonk).

---

## Scénario CMP-S4 — Webhook/poll rejoué tente une régression de statut

**Objectif métier** : un évènement Listmonk dupliqué ne doit pas corrompre le
statut affiché.

**Préconditions** : campagne `sent` (terminale), `finishedAt` récent.

**Étapes**
1. Le cron poll Listmonk ; un état `running` obsolète (rejeu) est renvoyé.
2. Le mapping calcule `next='sending'`.

**Oracles (état cible)**
- La transition `sent → sending` est **illégale** : la garde rejette le
  changement, `status` reste `sent`. Les métriques peuvent être rafraîchies
  mais jamais le statut régressé.
- Idem `cancelled → sending`.

> Matérialise l'écart **A-CMP-5** ; couvert par `CMP-INT-016/017` et
> `CMP-UNIT-033`.
