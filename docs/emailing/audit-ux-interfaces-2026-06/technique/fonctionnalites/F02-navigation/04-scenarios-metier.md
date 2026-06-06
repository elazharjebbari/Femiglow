# F02 — Scénarios métier (E2E Playwright)

> Chaque scénario = un spec E2E sur instance dédiée (worktree + `femiglow_emailqa`).
> Oracles binaires, point de vue opérateur. IDs `SM-F02-nn`. Mapping vers la
> batterie `03-batterie-tests.csv` (couche E) en fin de chaque scénario.

---

## SM-F02-01 — « Le tour du propriétaire au clavier »

**Persona.** Nadia, admin emailing FemiGlow, sans souris (trackpad capricieux),
veut vérifier que toutes les sections sont atteignables au clavier depuis
n'importe quel écran.

**Préconditions.**
- Instance seedée avec au moins un objet par section (1 campagne, 1 automation,
  1 audience, 1 template, 1 suppression event).
- `nav-counters` répond 200 (compteurs quelconques, badges éventuels présents).
- Nadia est sur `/admin/emails` (dashboard).

**Déroulé.**
1. Nadia presse `Tab` jusqu'à entrer dans la barre d'onglets.
2. Elle parcourt les 9 onglets au `Tab` ; le focus est visible sur chacun.
3. Sur l'onglet Transactionnel elle presse `Entrée` → l'écran Transactionnel
   s'ouvre, l'onglet Transactionnel porte `aria-current="page"`.
4. Elle continue : Campagnes, Automations, Audiences, Templates, **Suppression**,
   Events, Listmonk — à chaque fois l'écran change ET l'onglet correspondant
   devient l'unique onglet actif.
5. Sur Suppression elle vérifie que la page Suppression s'affiche (pas un 404,
   pas un détour par le dashboard).

**Oracles (binaires).**
- O1 : pour chacune des 9 sections, après activation, l'URL correspond à la
  section ET un **unique** onglet porte `aria-current="page"`.
- O2 : la section Suppression est atteinte **sans passer par le dashboard**.
- O3 : aucune étape ne requiert la souris.

**Mapping batterie.** F02-E-001 (tour clavier bout-en-bout), F02-E-002
(Suppression découvrable), appui composant F02-C-017/018 (clavier onglets).

---

## SM-F02-02 — « L'astreinte voit le badge DLQ monter et clique »

**Persona.** Karim, d'astreinte, surveille la santé d'envoi. Des messages
tombent en DLQ ; il doit les voir sans ouvrir le cockpit en permanence.

**Préconditions.**
- Instance seedée avec **3 messages en DLQ** (et 0 run en erreur).
- `nav-counters` répond 200 `{ dlq: 3, automationErrors: 0, listmonkSyncFailed: 0 }`.
- Karim est sur le dashboard, onglet navigateur au premier plan.

**Déroulé.**
1. Karim regarde la barre : l'onglet **Transactionnel** porte une pastille
   **« 3 »** (token danger), libellé accessible « Transactionnel, 3 en DLQ ».
2. Les onglets Automations et Listmonk n'ont **aucune** pastille (compteurs 0).
3. Karim clique l'onglet Transactionnel → le cockpit transactionnel s'ouvre ; il
   applique le quick filter DLQ et voit ses 3 messages.

**Oracles (binaires).**
- O1 : la pastille « 3 » est visible sur Transactionnel ; aucune pastille
  ailleurs.
- O2 : le clic ouvre le cockpit transactionnel (onglet actif = Transactionnel).
- O3 : le badge n'est pas qu'une couleur — le nombre « 3 » est dans le texte
  accessible.

**Mapping batterie.** F02-E-003 (badge DLQ clic), appui composant F02-C-006
(badge 3), F02-C-005 (0 masqué), F02-A-003 (annonce texte).

---

## SM-F02-03 — « nav-counters en panne, l'admin travaille quand même »

**Persona.** Sophie, admin, pendant un incident infra : l'endpoint
`nav-counters` renvoie 500 (ou ne répond pas). Elle doit pouvoir continuer à
naviguer normalement.

**Préconditions.**
- Instance configurée pour que `/api/admin/emails/nav-counters` renvoie **500**
  (ou pende) au niveau réseau de l'instance (suite `emails-degraded`).
- Le reste de l'application fonctionne.
- Sophie arrive sur `/admin/emails`.

**Déroulé.**
1. La barre d'onglets s'affiche **immédiatement** avec les 9 onglets, **sans
   aucune pastille**.
2. Aucun bandeau d'erreur bloquant, aucun toast rouge persistant ne s'impose.
3. Sophie navigue Dashboard → Campagnes → Suppression → Transactionnel : tout
   fonctionne, l'onglet actif suit.
4. Le rendu des pages n'est pas ralenti par l'endpoint en panne (la page
   s'affiche sans attendre `nav-counters`).

**Oracles (binaires).**
- O1 : les 9 onglets sont rendus et cliquables malgré le 500/hang.
- O2 : aucune pastille de compteur n'apparaît, aucun message d'erreur bloquant.
- O3 : la navigation entre au moins 4 sections aboutit (écran + onglet actif
  corrects).

**Mapping batterie.** F02-E-004 (dégradation infra), appui composant F02-C-010
(500 sans badge mais cliquable), F02-C-011 (hang non bloquant).

---

## SM-F02-04 — « Je crée une campagne depuis la palette »

**Persona.** Inès, admin, veut lancer une nouvelle campagne sans chercher le
bouton ; elle connaît ⌘K.

**Préconditions.**
- Instance seedée, Inès sur n'importe quel écran emails (p. ex. Audiences).
- `/admin/emails/campaigns/new` est câblé (NAV-F06).

**Déroulé.**
1. Inès presse ⌘K (mac) ou Ctrl-K → la palette s'ouvre, placeholder mentionnant
   « Cmd-K / Ctrl-K ».
2. Elle tape « nouvelle camp » → l'action « Nouvelle campagne » apparaît.
3. `Entrée` → navigation vers `/admin/emails/campaigns/new` qui aboutit au flux
   de création (pas un 404), breadcrumb « Emails › Campagnes › Nouvelle
   campagne », onglet Campagnes actif.
4. Bonus : elle réouvre la palette, tape « suppr » → l'entrée Suppression est
   listée et y mène.

**Oracles (binaires).**
- O1 : `/admin/emails/campaigns/new` n'est pas un 404 et affiche le flux de
  création.
- O2 : l'onglet Campagnes est actif sur cette route, breadcrumb cohérent.
- O3 : l'entrée Suppression est trouvable dans la palette et y navigue.

**Mapping batterie.** F02-E-005 (campaigns/new aboutit), F02-E-002 (Suppression
via palette), appui composant F02-C-024/025/026 (palette Suppression,
placeholder), intégration F02-I-008 (new non-404).
