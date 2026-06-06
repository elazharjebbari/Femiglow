# F08 — Audiences — scénarios métier

> 5 scénarios opérateur de bout en bout. Chacun mappe vers un spec Playwright
> `SM-F08-nn` (cf. `e2e/_helpers/emails-db.ts`). Oracles binaires, vue opératrice.
> Persona principale : **Salma**, responsable CRM FemiGlow (non technique, parle
> français, raisonne en MAD et en pays, pas en cents ni en codes ISO).

---

## SM-F08-01 — Le segment « clientes fidèles Casablanca », construit avec erreurs corrigées en route

**Persona** : Salma prépare une promo de fidélité pour les clientes marocaines à fort
panier. Elle construit le ciblage à la main et se trompe deux fois — l'UI la rattrape.

**Préconditions**
- Base `femiglow_emailqa` seedée : ~30 leads MA (phone +212…), quelques FR (+33…),
  des montants `orders.total_cents` variés, 1 lead sans téléphone.
- Aucune audience « clientes-fideles-casa » existante.

**Déroulé**
1. Salma ouvre `/admin/emails/audiences`, clique « + Nouvelle audience ».
2. Étape 1 : nom « Clientes fidèles Casablanca » → slug auto `clientes-fideles-casablanca`.
3. Étape 2 : « + Ajouter un critère → Pays ». Elle choisit « parmi », sélectionne 🇲🇦
   Maroc (chip). Elle ajoute par réflexe « France » puis se ravise et clique ✕ sur la
   chip FR.
4. Elle ajoute « Total dépensé ». Elle met « entre » et tape **500** puis **100** (elle
   a inversé). Un message rouge apparaît : « ⚠ La borne basse doit être ≤ la borne
   haute ». Elle clique **« Inverser les bornes »** → devient 100 et 500.
5. Elle ajoute « Nombre de commandes ≥ 2 ».
6. La mention « ET (toutes les conditions) » est visible (≥ 2 règles). L'aperçu (après
   800 ms) affiche « 🎯 N contacts » ; elle déplie « ciblés − exclus = envoyables ».
7. Étape 3 : elle laisse « Re-évaluer à l'envoi (recommandé) », lit le texte, valide
   « ✓ Créer l'audience ».

**Oracles**
- Après le ✕ FR, la chip France n'est plus présente (binaire).
- Le message de borne disparaît après « Inverser les bornes » et la value envoyée est
  `[10000, 50000]` cents (100/500 MAD).
- L'audience est créée (redirection vers le détail) et l'aperçu n'est **pas** vide.
- Aucune règle `country` ne porte un code hors liste.

**Mapping E2E** : `SM-F08-01` → `F08-E-098`. Batterie : F08-C-039/040/043/045/046/036.

---

## SM-F08-02 — Le snapshot d'il y a 3 semaines : drift détecté avant l'envoi

**Persona** : Salma veut renvoyer la promo sur une liste figée. Elle allait réutiliser
un vieux snapshot — le drift la stoppe.

**Préconditions**
- Audience « clientes-fideles-casablanca » avec un snapshot `done` daté de **J-21**,
  `size=1100`. Entre-temps la base a grossi : le live count est désormais **1234**.

**Déroulé**
1. Salma ouvre le détail de l'audience, section Snapshots.
2. La ligne du vieux snapshot affiche « créé il y a 21 j », « 1 100 », statut Terminé,
   et à côté « live : 1 234 (▲ +134, +12 %) ».
3. La ligne est **surlignée** et porte le bandeau « ⚠ Écart > 10 % avec l'audience
   live — [re-snapshoter] ».
4. Salma clique **re-snapshoter**. Un nouveau snapshot passe pending → running (la
   panneau s'auto-rafraîchit toutes les 4 s) → done avec size 1234.
5. Le nouveau snapshot n'est **pas** surligné (écart 0 %).

**Oracles**
- Le pourcentage affiché = `|1234−1100| / max(1,1100) × 100` ≈ 12 % (binaire : > 10 %).
- Le bandeau d'alerte est présent sur l'ancien, absent sur le neuf.
- Un (et un seul) POST `/snapshot` part au clic re-snapshoter.

**Mapping E2E** : `SM-F08-02` → `F08-E-099`. Batterie : F08-C-072/073/074/068/075.

---

## SM-F08-03 — La tentation du tag VIP (neutralisé, l'opératrice comprend pourquoi)

**Persona** : Salma veut cibler les « VIP ». Elle cherche un critère tag — il est grisé.

**Préconditions**
- Une audience legacy « non-vip » existe déjà avec une règle `not_has_tag=vip` (créée
  avant la neutralisation).

**Déroulé**
1. Salma crée une audience, étape 2, ouvre « + Ajouter un critère ». Sous « 🏷 Tags »
   elle voit « A le tag X (bientôt — M5.5) » et « N'a pas le tag X (bientôt — M5.5) »,
   **grisés**. Un clic ne fait rien.
2. Elle comprend (libellé + survol) que le moteur de tags n'est pas livré et ferme le
   menu.
3. Plus tard, elle ouvre l'audience legacy « non-vip » en édition. Sur la règle
   `not_has_tag`, une **bannière rouge** : « ⛔ Critère inactif : le moteur de tags
   (M5.5) n'est pas livré. Cette règle ne cible actuellement AUCUN contact. »
4. Elle tente « Continuer » → bloquée : « Une règle « tag » est inactive (M5.5 non
   livré). Retirez-la pour continuer. » Elle clique ✕ sur la règle → la bannière
   disparaît, Continuer est de nouveau possible.

**Oracles**
- Les 2 items tag sont `aria-disabled` ; aucun ajout au clic (binaire).
- La bannière `role="alert"` est présente sur la règle legacy.
- Avant retrait : Continuer reste à l'étape 2 ; après retrait : on passe à l'étape 3.
- (Backend) un snapshot de l'audience tag donne `size=0` — jamais toute la base.

**Mapping E2E** : `SM-F08-03` → `F08-E-100`. Batterie : F08-C-026/027/029/030/031,
F08-U-001/002/095.

---

## SM-F08-04 — L'audience trop ambitieuse (timeout preview → simplification guidée)

**Persona** : Salma empile beaucoup de critères d'engagement coûteux ; l'aperçu dépasse
le budget de 5 s.

**Préconditions**
- Une audience avec plusieurs règles `email_opened`/`email_clicked`/`session_count`
  imbriquées, sur une base assez large pour dépasser `statement_timeout=5000`.

**Déroulé**
1. Salma ajoute ses critères. Après 800 ms de debounce, l'aperçu lance le calcul.
2. Le calcul dépasse 5 s : la transaction est annulée (Postgres 57014). L'aperçu
   affiche, en `role="alert"` : « ⏱ Requête trop lourde — simplifiez les critères ou
   créez un snapshot (calcul asynchrone). »
3. Les règles saisies sont **préservées** ; aucun faux « 0 contact ».
4. Salma retire un critère d'engagement. Le nouvel aperçu (≤ 5 s) affiche un compteur.
   Ou bien elle clique « + Snapshot maintenant » : le calcul asynchrone matérialise la
   liste sans bloquer l'UI.

**Oracles**
- Le message timeout est le **message dédié** (distinct de « HTTP 500 »).
- Les règles ne sont pas effacées (le builder garde son état).
- Après simplification, un compteur s'affiche.

**Mapping E2E** : `SM-F08-04` → couvert par F08-C-064 (composant, MSW 504) +
F08-I-094 (intégration timeout réel). Pas de spec Playwright dédié (coût d'orchestrer
un vrai timeout en E2E) : le cas est verrouillé en composant + intégration.

---

## SM-F08-05 — Audit de conformité : export des membres d'un snapshot pour la CNDP

**Persona** : Salma doit prouver, lors d'un contrôle CNDP, **qui exactement** a reçu la
campagne du mois dernier. Le snapshot statique sert de preuve.

**Préconditions**
- Une campagne a tourné en mode `static` sur un snapshot `done` (size 1234,
  reproductible). Le snapshot a `> 50` membres (ex. 120 pour le test).

**Déroulé**
1. Salma ouvre le détail de l'audience, snapshot concerné, clique « Voir les 1 234
   membres ». Les 50 premiers s'affichent, compteur « 1 234 membres (50 affichés) ».
2. Elle clique « Charger plus » : 50 de plus apparaissent (100 affichés), sans
   doublon. Elle continue jusqu'à épuisement → le bouton disparaît.
3. Pour l'archive, elle clique « Exporter CSV » : un fichier `snapshot-…-membres.csv`
   (en-tête `email,name`, RFC-échappé) se télécharge.
4. Elle vérifie que la date de purge (« purge auto le JJ/MM ») lui laisse le temps
   d'archiver avant suppression automatique (90 j).

**Oracles**
- « Charger plus » concatène sans doublon (clé email) ; le bouton disparaît à
  `members.length === total`.
- Le lien CSV pointe sur `?format=csv` ; le contenu commence par `email,name`.
- La date de purge est affichée.

**Mapping E2E** : `SM-F08-05` → couvert par F08-C-077/078/080 (composant) +
F08-I-096 (contrat membres paginé) + F08-U-024 (CSV). Pas de spec Playwright dédié
(téléchargement de fichier) : verrouillé en composant + intégration + unitaire.
</content>
