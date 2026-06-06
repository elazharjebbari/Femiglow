# F05 — Campagnes — scénarios métier

> Un spec E2E Playwright par scénario (IDs `SM-F05-nn`), instance dédiée +
> `femiglow_emailqa` + Mailpit (cf. 05-strategie-tests §2.4). États initiaux
> posés par helpers DB (`e2e/_helpers/emails-db.ts`), JAMAIS via l'UI quand
> évitable. Dégradations infra simulées au niveau réseau de l'instance (Listmonk
> → port mort ; preview-size 500). Oracles binaires, vue opérateur.

---

## SM-F05-01 — « Campagne de A à Z avec épreuve »

**Persona** : Salma, responsable CRM, lance la newsletter mensuelle.
**Préconditions** :
- Seed : 1 audience FemiGlow « Newsletter » (~1 234 contacts, snapshot prêt),
  1 template Listmonk « Charte FemiGlow », Listmonk + Mailpit up.
- Salma authentifiée admin.

**Déroulé** :
1. Liste campagnes → « Nouvelle campagne » (route `/new`) → saisie « Newsletter
   juin » → redirect `/edit` (wizard é1).
2. é1 Nom (déjà rempli) → Suivant.
3. é2 Audience : sélectionne l'audience « Newsletter » → estimation s'affiche
   (~1 234) → Suivant.
4. é3 Contenu : choisit le template « Charte FemiGlow », édite le corps →
   l'aperçu iframe se met à jour → Suivant.
5. é4 Sujet « ✨ Rituels de juin » + preheader → mock inbox reflète → Suivant.
6. é5 Planif : « Envoyer maintenant » → Suivant.
7. é6 Vérif : « Envoyer un test » à `salma@femiglow-maroc.com` → feedback
   « Épreuve envoyée ».
8. Coche l'ack chiffrée (« ~1 234 ») → « Envoyer maintenant ».
9. Redirect détail → statut « En cours d'envoi ».

**Oracles** :
- L'épreuve arrive dans **Mailpit** pour `salma@…` (sujet attendu).
- Après envoi, le détail affiche le statut **sending** (Pill).
- Métriques : Envoyés ≥ 0 réel ; **Livrés = n/d** avec tooltip honnête.
- Audit-log : `mail.campaign.test_sent` puis `mail.campaign.finalized`.

**Mapping E2E** : `F05-E-001`.

---

## SM-F05-02 — « La responsable interrompue »

**Persona** : Salma est appelée en réunion à mi-wizard ; revient plus tard,
parfois depuis un autre poste.
**Préconditions** :
- Seed : 1 draft « Promo été » à l'étape 4 (wizard_step=4, nom/audience/contenu/
  sujet déjà saisis), autosave actif.

**Déroulé** :
1. Salma est à l'étape 4, a tapé un sujet ; 2 s plus tard l'indicateur passe à
   « ✓ Brouillon enregistré il y a 2 s ».
2. Elle ferme l'onglet (réunion).
3. Elle rouvre `/admin/emails/campaigns/{id}/edit` (F5 / nouveau poste).

**Oracles** :
- Le wizard **rouvre à l'étape 4** (pas é1).
- Le sujet, l'audience, le contenu saisis sont **tous restitués**.
- Pendant une rafale de frappe rapide, **un seul POST** d'autosave est émis
  (compteur réseau).
- Un autosave échoué (coupure) laisse la saisie intacte + « ⚠ réessayer ».

**Mapping E2E** : `F05-E-002`.

---

## SM-F05-03 — « Listmonk en panne au mauvais moment »

**Persona** : Salma crée une campagne pendant une coupure Listmonk.
**Préconditions** :
- Listmonk → **port mort** (instance E2E). Audience FemiGlow disponible.

**Déroulé** :
1. é2 Audience : le chargement des **listes Listmonk** échoue.
2. Salma tente quand même de finaliser plus tard (Listmonk toujours down).

**Oracles** :
- é2 affiche un bandeau **honnête** « Listmonk indisponible — impossible de
  charger les listes. » (PAS de liste fantôme, PAS de faux hint vide — LMK-04).
- Les **audiences FemiGlow restent sélectionnables** (chemin alternatif).
- Si finalize est tenté : message d'erreur honnête, **aucun faux succès**, le
  draft reste finalisable plus tard (R-010 : déréservation propre, retour draft).
- Aucune campagne Listmonk fantôme créée.

**Mapping E2E** : `F05-E-003` (suite `emails-degraded.spec.ts`).

---

## SM-F05-04 — « L'API d'estimation morte un vendredi de promo »

**Persona** : Salma doit lancer une promo flash ; l'API d'estimation d'audience
(`preview-size`) est en panne, mais l'envoi ne peut PAS attendre.
**Préconditions** :
- `preview-size` → **500 systématique**. Audience FemiGlow sélectionnée.
  Listmonk up.

**Déroulé** :
1. é2 : l'estimation échoue → « Réessayer » (échec 1).
2. Salma reclique « Réessayer » → échec 2, puis échec 3.
3. À é6, le bouton **dégradé** « Envoyer sans estimation… » apparaît.
4. Elle clique → **ConfirmDialog** « Vous allez envoyer SANS connaître le volume…
   Taper ENVOYER ».
5. Saisit `ENVOYER` → confirme.

**Oracles** :
- Avant 3 échecs : SEUL « Réessayer » est offert (pas de fallback).
- Le bouton de confirmation reste **désactivé** tant que la saisie ≠ `ENVOYER`.
- Après confirmation : finalize part avec `skipEstimate:true` ; statut → sending ;
  audit-log `meta.skipEstimate=true`.
- **Succès tardif** : si `preview-size` revient et Salma reclique « Réessayer »,
  le nombre s'affiche, le bouton dégradé **disparaît**, la case d'ack chiffrée
  reprend (on n'est pas coincé en mode dégradé).

**Mapping E2E** : `F05-E-004`.

---

## SM-F05-05 — « Le brouillon dupliqué pour le ramadan »

**Persona** : Salma réutilise la campagne « Newsletter juin » comme base pour la
campagne « Newsletter ramadan », à planifier (DST/heure suspendue).
**Préconditions** :
- Seed : 1 campagne « Newsletter juin » **sent** avec planification d'origine.

**Déroulé** :
1. Détail « Newsletter juin » → « Dupliquer ».
2. Toast « Campagne dupliquée — **planification réinitialisée**. [La conserver] ».
3. Salma ouvre la copie, va à é5, planifie un envoi pendant le ramadan (TZ
   `Africa/Casablanca`, heure d'été suspendue).

**Oracles** :
- La copie est « Newsletter juin (copie) », statut **draft**, `scheduledFor=null`,
  `listmonkCampaignId=null`.
- Le toast offre **[La conserver]** ; cliquer recopie la planif source.
- é5 affiche la **TZ explicite** et la phrase « reçu à HH:MM heure locale Maroc » ;
  la conversion respecte l'offset DST au moment T (pas d'offset codé en dur).
- Une date passée est refusée (« date dans le futur »).

**Mapping E2E** : `F05-E-005`.

---

## SM-F05-06 — « La campagne orpheline après crash déploiement »

**Persona** : Karim, ops, découvre après un redeploy une campagne bloquée en
« envoi » sans référence Listmonk.
**Préconditions** :
- Seed : 1 campagne **orpheline** (`status='sending'`, `listmonk_campaign_id=NULL`,
  `started_at = now()-15min`) — preset `orphanCampaign`.
- Optionnel : 1 campagne Listmonk réelle (#777) pour le test de ré-association.

**Déroulé (sortie A — sûre)** :
1. Détail → **bannière danger** « en envoi sans référence Listmonk ».
2. Karim clique **[Marquer en échec]** → ConfirmDialog → confirme.

**Déroulé (sortie B — récupération)** :
1. Même bannière → **[Ré-associer (id Listmonk : ___)]**.
2. Saisit `777` (valide) → la campagne reprend ; saisit `999` (invalide) →
   `role=alert`.

**Oracles** :
- La bannière **apparaît** au critère exact ; **absente** si `started_at` < 10 min
  ou si `listmonk_campaign_id` présent.
- Sortie A : statut → **failed**, `finishedAt` posé, toast, bannière disparaît.
- Sortie B (valide) : `listmonk_campaign_id` écrit, bannière disparaît, toast
  « Ré-associée à #777 », le sync reprend.
- Sortie B (invalide) : `role=alert` « id Listmonk introuvable », **aucune
  écriture**, bannière toujours là.

**Mapping E2E** : `F05-E-006` (suite `emails-degraded.spec.ts`).
