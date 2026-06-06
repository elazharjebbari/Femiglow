# F09 — Scénarios métier (Suppression & Events)

> Chaque scénario = 1 spec Playwright (`SM-F09-nn`), instance dédiée
> (`femiglow_emailqa` + Mailpit), JAMAIS contre la prod. Oracles binaires,
> vue opérateur.

---

## SM-F09-01 — Le spike de faux hard-bounces

**Persona** : Salma, opératrice délivrabilité. Un incident transitoire chez
Stalwart (résolution DNS instable pendant 20 min) a fait remonter ~200 faux
`hard_bounce` la nuit dernière. Ces 200 clientes sont maintenant bloquées à
tort — transactionnel ET campagnes.

**Préconditions** :
- 200 lignes `email_suppression` `reason=hard_bounce`, `source=stalwart`,
  `since` dans les dernières 24 h (seed via helper DB).
- Quelques dizaines d'autres suppressions légitimes (autres sources/raisons)
  pour vérifier que le filtre isole bien.

**Déroulé** :
1. Salma ouvre `/admin/emails/suppression`.
2. Elle pose **Source = Stalwart** + **Raison = Bounce permanent** ; l'URL
   reflète `?source=stalwart&reason=hard_bounce`.
3. Elle clique **Export CSV** → elle conserve le fichier
   `suppression-2026-06-06.csv` comme **preuve** avant action (audit interne).
4. Elle coche **tout-la-page**, puis enchaîne les pages (ou, si le pattern
   « sélectionner les N résultats » est livré, sélectionne les 200) et clique
   **Retirer les 200 adresses…**.
5. Le **ConfirmDialog unique** affiche le nombre « Retirer 200 adresses ». Elle
   confirme.
6. Feedback honnête : « 200 retirées · 0 introuvable ». La liste filtrée est
   vide → **EmptyState** « Aucun résultat pour ce filtre ».

**Oracles** :
- L'export contient exactement les 200 lignes du filtre, BOM présent, detail
  RFC4180.
- UN SEUL `POST /bulk-remove` (pas 200 requêtes).
- Après action, un envoi de test vers l'une des 200 adresses arrive dans
  **Mailpit** (l'adresse est de nouveau joignable).
- L'audit-log contient un `mail.suppression.bulk_remove` (removed=200).

**Mapping** : `F09-E-001` ; couvre SUP-03/04/06.

---

## SM-F09-02 — La plainte WhatsApp

**Persona** : Younes, support client. Une cliente écrit sur WhatsApp : « je
reçois trop d'emails, arrêtez tout ». Younes doit (a) comprendre quels emails
elle a reçus, (b) la désabonner proprement avec une trace.

**Préconditions** :
- Des `user_event` pour `cliente@example.com` (ouvertures, clics), dont au
  moins un porte `properties.outbox_id` (lien vers un envoi transactionnel) et
  un autre `properties.campaign_id`.
- L'envoi transactionnel correspondant existe dans le cockpit.

**Déroulé** :
1. Younes ouvre `/admin/emails/events`, filtre **email = cliente@example.com**,
   fenêtre **24 h** d'abord puis bascule **Tout** pour voir l'historique.
2. Il **déplie** les propriétés d'un event : il lit le JSON complet et voit
   `outbox_id` → il clique **« voir l'envoi »** et atterrit sur le détail
   transactionnel (quel template, quand, statut delivered).
3. Revenu sur events, un autre event porte `campaign_id` → **« voir la
   campagne »** lui montre de quelle campagne il s'agit.
4. Une fois le contexte établi, il va sur `/admin/emails/suppression`,
   **+ Ajouter une adresse** : email = cliente@example.com, raison = **Action
   admin** (`manual_admin`), détail **obligatoire** = « Demande WhatsApp du
   06/06, capture jointe ticket #4821 ».
5. Le bouton Ajouter reste désactivé tant que le détail est vide ; rempli, il
   soumet → toast succès, la ligne apparaît.

**Oracles** :
- Le lien event→outbox mène bien au bon détail transactionnel.
- L'ajout sans détail est **refusé** (bouton désactivé / 422) ; avec détail,
  accepté (201).
- Après ajout, un envoi de test vers la cliente est **bloqué** (n'arrive pas
  dans Mailpit) — l'adresse est suppressée.
- La ligne porte raison « Action admin », source « Manuel », detail visible.

**Mapping** : `F09-E-002` ; couvre EVT-01/02/03/04 + SUP-02.

---

## SM-F09-03 — La demande CNDP

**Persona** : Nadia, DPO. Une personne exerce son droit d'effacement (CNDP,
équivalent marocain RGPD). Elle doit être bloquée durablement et la décision
tracée + exportable pour le registre.

**Préconditions** : adresse `demande-cndp@example.com` non encore suppressée.

**Déroulé** :
1. Nadia ouvre `/admin/emails/suppression` → **+ Ajouter une adresse**.
2. Email = demande-cndp@example.com ; raison = **Demande CNDP**
   (`cndp_request`) → la **source** est posée à `cndp` côté serveur (pas
   `manual`). Détail facultatif mais elle écrit « Demande d'effacement
   reçue le 05/06, réf CNDP-2026-114 ».
3. Soumission → toast succès, ligne visible (raison « Demande CNDP », source
   « CNDP »).
4. Elle filtre **Source = CNDP** et clique **Export CSV** → fichier daté à
   verser au registre.

**Oracles** :
- Source résolue à `cndp` (pas `manual`) en base pour une raison `cndp_request`.
- L'export filtré source=cndp contient la ligne, colonnes
  `reason/reason_label/source/source_label/detail/since` correctes, BOM.
- L'adresse est suppressée (test send bloqué).

**Mapping** : `F09-I-038`, `F09-U-033`, `F09-C-039/073` ; couvre SUP-02/06.

---

## SM-F09-04 — Le stagiaire tente de bloquer info@femiglow-maroc.com (refus pédagogique)

**Persona** : Karim, stagiaire. Croyant « nettoyer », il essaie d'ajouter
l'adresse interne `info@femiglow-maroc.com` à la liste de suppression. Si ça
passait, **toutes** les notifications internes (nouveaux leads chat) seraient
silencieusement coupées (R-009).

**Préconditions** : allowlist par défaut active
(`info@femiglow-maroc.com` + `@femiglow-maroc.com`).

**Déroulé** :
1. Karim ouvre le dialog d'ajout, saisit `info@femiglow-maroc.com`, raison
   « Action admin », détail « ménage ».
2. Soumission → **409** : message dédié **« Adresse interne protégée :
   info@femiglow-maroc.com ne peut pas être ajoutée à la liste de suppression
   (allowlist R-009). »** Le dialog reste ouvert, sa saisie est préservée.
3. Il tente une variante `marketing@femiglow-maroc.com` (autre adresse du
   **domaine** interne) → même refus (la règle couvre tout `@femiglow-maroc.com`).
4. La liste ne contient à aucun moment d'adresse interne.

**Oracles** (non-régression R-009) :
- 409 `code=internal_allowlisted`, message distinct du doublon.
- Aucune ligne interne insérée en base (vérif intégration).
- `isSuppressed('info@femiglow-maroc.com')` reste `false`, donc les
  notifications lead continuent d'arriver dans Mailpit.

**Mapping** : `F09-C-040`, `F09-I-032`, `F09-I-040/041`, `F09-U-035/036` ;
couvre SUP-07 / R-009.

---

## SM-F09-05 (optionnel) — Le faux positif unitaire réversible

**Persona** : Salma. Une seule cliente signale ne pas avoir reçu sa
confirmation ; son adresse a un `soft_bounce_repeated` douteux.

**Déroulé** : recherche email → **Retirer** (ConfirmDialog danger, conséquences
explicites) → toast succès → la ligne disparaît. Si le serveur renvoie 500, la
**ligne reste** et un `role=alert` s'affiche (zéro faux succès), Réessayer
rejoue.

**Oracles** : migration socle effective (dialog ≠ window.confirm), ligne
préservée sur erreur.

**Mapping** : `F09-C-082/083/084` + IDs modèle `F09-C-001/010..015/020` ;
couvre SUP-F04 / TRV-01.
