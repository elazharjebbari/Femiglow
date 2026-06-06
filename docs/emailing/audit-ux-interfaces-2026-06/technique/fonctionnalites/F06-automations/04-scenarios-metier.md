# F06 — Automations — scénarios métier

> 5 scénarios opérateur (admin emailing FemiGlow). Chaque scénario mappe un spec
> E2E Playwright (`SM-F06-nn`) exécuté contre l'instance dédiée
> (`femiglow_emailqa` + Mailpit), JAMAIS la prod. Oracles binaires, observables.

---

## SM-F06-01 — Debugger une automation « panier abandonné » cassée

**Persona** : Salma, responsable CRM. Une relance panier ne part plus depuis ce
matin ; le dashboard signale « 1 run en erreur ».

**Préconditions** :
- automation `cart-1h` active (event `cart.abandoned` → wait 1 h → branch
  `email.opened ?` → send `relance-douce` / send `relance-remise` → tag) ;
- le template `relance-douce` a été renommé/supprimé → un run a calé en
  `errored` au step send avec `_trace` contenant `outcome:'error'`.

**Déroulé** :
1. Salma ouvre `/admin/emails/automation/runs?status=errored` ; le **compteur**
   indique « 1 run ». Elle ouvre le détail.
2. La **timeline** montre : ✓ wait 1 h (14:02→15:02, 60 min) · ✓ branch évaluée
   VRAI · ✗ send `relance-douce` 15:02 — **ERREUR : template introuvable**.
3. Le **FlowView** (mode run) surligne le step send en **rouge** (étape courante
   = erreur).
4. Salma corrige le template (slug rétabli côté templates), revient au run et
   clique **« Réinitialiser & rejouer »** → ConfirmDialog danger → confirme.
5. Le run repart à **#1** ; au tick suivant il déroule jusqu'au tag et passe
   **completed**. Le compteur « runs en erreur » retombe à **0**.

**Oracles** :
- la cause d'erreur est lisible SANS ouvrir le JSON brut ;
- l'étape en erreur est rouge dans FlowView et ✗ dans la timeline ;
- après replay le run est `completed` et l'ancien `_trace` est archivé
  (`_traceArchive`) ;
- le badge « runs en erreur » décroît.

**Mapping** : `F06-E-001` ; composants `F06-C-006`, `F06-C-027`, `F06-C-060/061`.

---

## SM-F06-02 — Valider un flow VIP à 3 branches avant activation (dry-run)

**Persona** : Karim, growth. Il vient de construire un flow `vip-onboarding` avec
3 branches imbriquées (segmentation par statut lead). Il veut être SÛR du
parcours avant de l'activer en prod.

**Préconditions** : automation `vip-onboarding` en brouillon (inactive), trigger
`lead.status_changed`, 3 niveaux de branches, plusieurs steps send.

**Déroulé** :
1. À l'étape **Revue** du wizard, le **FlowView** rend l'arbre complet read-only :
   les 3 niveaux de branches sont indentés, chaque sous-step numéroté `#Na/#Nb`,
   les branches vides explicitées.
2. Karim clique **[Tester ▾]** → dialog dry-run → contact de test = sa boîte →
   **mode « Simulation seule »** → Lancer.
3. Le run dry s'exécute synchroniquement ; la **timeline** s'ouvre avec un badge
   **« test »** et montre quelle branche a été prise à chaque condition.
4. Karim vérifie en base : **aucune ligne `email_outbox`** n'a été créée
   (simulation), et son **daily cap** n'a pas bougé.
5. Satisfait, il repasse en mode « Envoi réel redirigé » pour recevoir vraiment
   les emails dans sa boîte et contrôler le rendu, puis active.

**Oracles** :
- FlowView rend les 3 niveaux sans nœud manquant/dupliqué ;
- dry-run `simulate` → `count(email_outbox)` inchangé ;
- le run dry porte `is_dry_run=true` et n'apparaît dans AUCUN KPI ;
- dry-run `redirect` → outbox UNIQUEMENT vers la boîte de test.

**Mapping** : `F06-E-002` ; `F06-C-038/040/041/047/048`, `F06-I-001/002/003`.

---

## SM-F06-03 — Le run « mystérieusement différé » expliqué par la timeline

**Persona** : Nadia, support. Un client se plaint de ne pas avoir reçu son email
de bienvenue « tout de suite ». Le run est en `running` mais n'avance pas.

**Préconditions** : automation `welcome-flow` avec **quiet hours 22:00→08:00
Africa/Casablanca** ; le déclenchement a eu lieu à 22:40 → le send est différé.

**Déroulé** :
1. Nadia ouvre le détail du run. La **timeline** montre l'entrée send avec
   pastille **⏸ deferred** et la mention inline **« envoi différé 22:40 → 08:00
   (quiet hours Africa/Casablanca) »**.
2. Le FlowView surligne le step send comme **étape courante** (en attente).
3. Nadia explique au client que l'email partira à 08:00 (heure Casablanca, DST
   correct) — pas un bug, un réglage volontaire.

**Oracles** :
- la timeline affiche explicitement la raison (quiet hours) + l'heure cible ;
- aucune action corrective n'est nécessaire (le run n'est ni errored ni bloqué).

**Mapping** : `F06-E-003` ; `F06-C-022`, `F06-I-011`.

---

## SM-F06-04 — Grand ménage : soft-delete d'automations legacy

**Persona** : Salma. Cinq vieilles automations de test/POC traînent dans la
liste. Elle veut les supprimer proprement.

**Préconditions** :
- 4 automations sans run actif (runs passés `completed`/`cancelled`) ;
- 1 automation `promo-legacy` avec **2 runs `running` + 1 `waiting_for_event`**.

**Déroulé** :
1. Salma supprime les 4 premières une à une : ConfirmDialog **danger** → confirme
   → chacune **disparaît de la liste** (et du sélecteur de filtre des runs).
   Leurs runs passés restent consultables.
2. Sur `promo-legacy`, elle clique Supprimer → le serveur **refuse** :
   « Suppression refusée : 3 run(s) actif(s) (2 en cours, 1 en attente
   d'événement). Annulez-les ou attendez leur fin. [Voir les runs →] ». La ligne
   reste en place.
3. Elle annule les runs actifs, réessaie → suppression acceptée.

**Oracles** :
- soft-delete pose `deleted_at` sans **aucun** DELETE physique ni crash FK
  (R-031 corrigé) ;
- refus tant qu'un run `running`/`waiting_for_event` existe, avec décompte exact ;
- l'automation supprimée quitte la liste ET le sélecteur de filtre des runs ;
  ses runs historiques restent visibles.

**Mapping** : `F06-E-004` ; `F06-C-070/071/072`, `F06-I-020/021/022/023/024`.

---

## SM-F06-05 — L'astreinte relance 12 runs en erreur après l'incident template

**Persona** : Yassine, astreinte. Un déploiement a temporairement cassé un
template ; 12 runs de l'automation `order-followup` ont calé en `errored` avant
le rollback.

**Préconditions** : template réparé (rollback fait) ; 12 runs `errored` au step
send avec la même cause « template introuvable » dans leur `_trace`.

**Déroulé** :
1. Yassine ouvre `/admin/emails/automation/runs?status=errored` ; le **compteur**
   annonce « 12 run(s) ».
2. Il vérifie sur un run que la cause est bien l'incident template (timeline ✗
   send), donc relançables tels quels.
3. Il relance chaque run (retry au step courant — pas besoin de replay complet,
   l'erreur est en aval de steps déjà faits) ; au fil des ticks ils passent
   **completed**.
4. Le compteur « runs en erreur » décroît jusqu'à **0** ; aucun email en double
   (idempotency key par run+step préservée).

**Oracles** :
- le compteur de résultats reflète exactement le nombre de runs errored et
  décroît à mesure des relances ;
- aucun envoi en double (les steps déjà `ok` dans `_trace` ne sont pas rejoués) ;
- à la fin, 0 run errored, 12 runs completed.

**Mapping** : `F06-E-005` ; `F06-C-080/084`, `F06-I-033`.
