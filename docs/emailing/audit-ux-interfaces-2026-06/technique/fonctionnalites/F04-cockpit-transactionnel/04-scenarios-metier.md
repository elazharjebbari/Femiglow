# F04 — Scénarios métier du cockpit transactionnel

> Chaque scénario = un parcours opérateur réaliste de bout en bout, mappé sur UN
> spec Playwright `SM-F04-nn` (cf. `03-batterie-tests.csv` couche E et
> `modeles-code/exemple-e2e.spec.ts`). État initial posé par helpers DB
> (`e2e/_helpers/emails-db.ts` : `seedOutbox`, `truncateEmails`), jamais par
> l'UI. Oracles = ce que l'opérateur LIT. Cible : instance worktree +
> `femiglow_emailqa`, jamais la prod.

---

## SM-F04-01 — La matinée d'astreinte : drainer la DLQ

**Persona.** Sofia, opérations emailing, prend l'astreinte à 9 h.

**Préconditions (seed).** `truncateEmails()` puis 3 emails `status:dlq`
(`order-confirmation` x2, `welcome` x1, attempts 5) + 47 `delivered`.

**Déroulé.**
1. Sofia ouvre `/admin/emails` ; le HealthBadge signale « DLQ 24h : 3 ».
2. Elle clique le deep-link santé → arrive sur
   `/transactional?status=dlq&from=health`.
3. La **bannière contexte santé** confirme pourquoi elle est là.
4. La table montre 3 lignes ; elle coche « tout » (3 ≤ page → pas de sélection
   globale, mode `page`).
5. Clic **Retry (3)** → feedback honnête « 3 relancés ».
6. Elle rafraîchit ; la file se vide (« Aucun email ne correspond à ces
   filtres »).
7. Retour dashboard : badge « DLQ 24h : 0 ».

**Oracles.** Bannière santé visible · « 3 relancés » exact · table vide après
drain · badge DLQ retombé à 0.

**Mapping.** `F04-E-001` (déjà modelé dans `exemple-e2e.spec.ts`), composant
`F04-C-073`.

---

## SM-F04-02 — Le domaine pourri : `to:*@bad.tld` → preuve CSV → blocage global

**Persona.** Karim, lead délivrabilité, repère un domaine destinataire qui
génère 100 % de hard bounces.

**Préconditions (seed).** 5 320 emails dont 5 312 vers `*@bad.tld`
(`bounced_permanent`) + 8 légitimes ailleurs.

**Déroulé.**
1. Karim saisit `to:*@bad.tld` dans ⌘K. La table montre « 1–50 sur 5 312 ».
2. Il coche « tout » la page → la **bannière d'amorce** apparaît :
   « **[Sélectionner les 5 312 emails correspondant aux filtres]** ».
3. Il clique → mode `filter`, bannière « 5 312 emails sélectionnés (filtre :
   `to:*@bad.tld`) [annuler] ».
4. **Preuve d'abord** : il clique « Exporter CSV (serveur, ~5 312 lignes) ».
   Le serveur streame ; un fichier `emails-transactionnels-2026-06-06.csv` est
   téléchargé (BOM, RFC 4180). Il l'archive comme preuve avant action
   destructive.
5. Il lance le blocage global du domaine (suppress par filtre — réservé,
   confirmé par ConfirmDialog adresses distinctes).
6. Feedback honnête sur le nombre traité.

**Oracles.** Bannière d'amorce visible (car total>page) · libellé export
« serveur, ~5 312 lignes » (honnête) · fichier CSV daté téléchargé · compteur
de blocage exact.

**Mapping.** `F04-E-002` ; composant `F04-C-010/011/033/074` ; intégration
export `F04-I-003..007`.

---

## SM-F04-03 — L'enquête sur un client : recherche → détail → timeline → retrait

**Persona.** Léa, support N2, reçoit « je n'ai jamais reçu ma confirmation ».

**Préconditions (seed).** 1 email vers `cliente@exemple.test`,
`status:sent` (jamais `delivered`), source webhook muette ; cette adresse est
aussi en liste de suppression.

**Déroulé.**
1. Léa cherche `cliente@exemple.test` (freetext). La ligne sort en statut
   « Envoyé ».
2. Elle ouvre le détail. La **timeline pédagogique** montre `⚙ sent (250)` puis
   l'**encart ⓘ** : « Un mail peut rester "Envoyé" si … boîte locale … ou
   webhook muet ». Léa comprend que le message est bien parti.
3. Le statut `suppressed` affiche le **deep-link** « Voir / retirer dans la liste
   de suppression » → elle décide du retrait.
4. Le **retour sticky** en bas la ramène au cockpit sans scroll.

**Oracles.** Légende `📡/⚙` visible · encart « sent stagnant » présent · badge
source correct par évènement · deep-link suppression fonctionnel · retour sticky
présent.

**Mapping.** `F04-E-003` ; composant `F04-C-060/061/062/063`.

---

## SM-F04-04 — Le faux filtre : la faute de frappe rendue visible

**Persona.** Sofia (astreinte) tape vite et se trompe.

**Préconditions (seed).** Outbox mixte avec quelques `failed`.

**Déroulé.**
1. Sofia saisit `status:failed attempts:abc` (typo : `abc` au lieu d'un nombre).
2. **Avant**, le token fautif était silencieusement avalé → résultats
   incohérents sans explication. **Désormais** : l'input porte un **liseré
   rouge** et une **section warning** : « `attempts:abc` ignoré — attendu : >N,
   <N, =N ».
3. Le filtre VALIDE `status:failed` est quand même appliqué (parsing partiel) :
   elle voit ses échecs.
4. Elle corrige en `attempts:>3` ; le warning et le liseré disparaissent.

**Oracles.** Warning visible avec le bon message · `aria-invalid=true` sur
l'input · `status:failed` appliqué malgré l'erreur · warning disparu après
correction.

**Mapping.** `F04-E-004` ; composant `F04-C-006/007/008/009` ; unitaire
`F04-U-013..019`.

---

## SM-F04-05 — La vue d'équipe : système vs perso

**Persona.** Karim crée une vue partagée pour l'équipe d'astreinte.

**Préconditions (seed).** 2 vues système (« Échecs 24h », « DLQ ») + 0 vue perso.

**Déroulé.**
1. Karim filtre `status:failed,dlq after:-24h`, puis « Enregistrer la vue
   actuelle » → nomme « Astreinte du jour ». POST `/views` ; la vue apparaît
   dans « Mes vues ».
2. Il vérifie qu'une **vue système** (« DLQ ») n'offre PAS rename/delete
   (lecture seule), alors que sa vue perso si.
3. Recharge la page : la vue perso est restituée et, sélectionnée, ré-applique
   `status:failed,dlq after:-24h` + tri.

**Oracles.** Vue créée listée · système non éditable · application restitue
filtres + tri après reload.

**Mapping.** `F04-E-005` ; composant `F04-C-064..069`.

---

## SM-F04-06 — Reap après crash de déploiement

**Persona.** Sofia, après un redéploiement qui a tué le worker en plein envoi.

**Préconditions (seed).** 12 emails figés `status:sending` (process crashé entre
claim et SMTP), dont 2 au plafond de tentatives.

**Déroulé.**
1. Sofia voit des envois qui ne bougent plus. Elle clique « Libérer les envois
   bloqués » → ConfirmDialog.
2. Confirme → feedback **précisant le statut résultant** : « 12 envois bloqués
   libérés → re-mis en file (ou DLQ si plafond) ». Les 2 au plafond partent en
   DLQ, 10 repassent en file.
3. Elle rafraîchit ; la file repart.

**Oracles.** Feedback avec statut résultant (pas juste « fait ») · les 10
repassent `pending`, les 2 en `dlq` (vérifié DB côté intégration) · cas 0 testé
séparément.

**Mapping.** `F04-E-006` ; composant `F04-C-046/047/048` ; intégration
`F04-I-021`.
