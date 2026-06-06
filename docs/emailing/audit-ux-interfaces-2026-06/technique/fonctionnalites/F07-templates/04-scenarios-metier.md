# F07 — Scénarios métier (E2E Playmight, IDs SM-F07-nn)

> Instance dédiée (worktree + base `femiglow_emailqa` + Mailpit), JAMAIS la prod.
> Helpers : `e2e/_helpers/{emails-db,mailpit,unsub-token}.ts`. Un spec par
> scénario. Oracles binaires, vue opérateur. `test.step()` pour le triage,
> retries=1 (retry = bug).

---

## SM-F07-01 — La refonte du template « bienvenue »

**Persona** : Imane, responsable CRM. Elle doit moderniser le template
`welcome-j0` (onboarding J0) : nouveau bloc d'accueil personnalisé, vérifier le
rendu mobile, s'envoyer une épreuve, puis figer en version.

**Préconditions** : template `welcome-j0` existant (v7), un lead réel
`fatima@example.com` avec 3 commandes en base, Mailpit vide.

**Déroulé**
1. Imane ouvre `/admin/emails/templates`, recherche « welcome », ouvre l'éditeur.
2. Dans l'éditeur CodeMirror, elle place le curseur après `<h1>Bienvenue ` et
   tape `{{` → l'autocomplete propose les variables ; elle filtre `fir` et insère
   `{{firstName}}`.
3. Elle saisit le contexte `fatima@example.com` → la preview affiche « Bienvenue
   Fatima » et le panneau variables montre `firstName=Fatima · orderCount=3 ·
   totalSpent=… MAD`.
4. Elle bascule en **Mobile 375px** → l'iframe se réduit ; le rendu reste lisible
   (aucun re-fetch).
5. Elle clique **Tester** → saisit `imane@femiglow-maroc.com` → toast « Épreuve
   envoyée à imane@femiglow-maroc.com ».
6. Elle clique **Créer une version** avec message « bloc d'accueil personnalisé »
   → v8 apparaît en tête.

**Oracles**
- Mailpit reçoit **1** message à `imane@femiglow-maroc.com`, sujet rendu, corps
  contenant « Bienvenue Fatima ».
- La liste des versions affiche **v8 (actuelle)** après save.
- Le brouillon localStorage est **purgé** après le save (pas de dialogue au
  rechargement suivant).

**Mapping** : `F07-E-118`.

---

## SM-F07-02 — Le crash de 18 h

**Persona** : Imane, fin de journée. Elle a passé ~2 h à réécrire un template
(jamais enregistré en version) quand le navigateur crashe (onglet tué).

**Préconditions** : template ouvert, ~2 h de modifications non enregistrées
(brouillon localStorage écrit par autosave), `savedAt` récent > `updatedAt`.

**Déroulé**
1. Imane édite longuement (sujet, html, preheader) ; l'indicateur « Brouillon
   auto-enregistré il y a Ns » se met à jour.
2. Le navigateur est fermé brutalement (simulé : nouveau contexte de page, même
   `localStorage`/origin).
3. Elle rouvre l'éditeur du même template → un **dialogue de restauration**
   apparaît : « Un brouillon non enregistré existe (modifié il y a N min). »
4. Elle clique **Restaurer** → les champs reprennent l'état de 18 h.

**Oracles**
- Le dialogue de restauration **apparaît** au rechargement (brouillon plus récent
  que la version DB).
- Après **Restaurer**, le `htmlSource` éditeur **égale** celui d'avant le crash.
- Si elle avait cliqué **Ignorer**, l'état serait revenu à la version DB et le
  brouillon purgé (variante testée).

**Mapping** : `F07-E-119`.

---

## SM-F07-03 — La variable piégée

**Persona** : Yassine, stagiaire marketing. Il a copié un template d'ailleurs où
la variable est écrite `{{firstname}}` (minuscule) au lieu de `{{firstName}}`.

**Préconditions** : template avec `{{firstname}}` dans le sujet et le corps ; lead
réel `fatima@example.com`.

**Déroulé**
1. Yassine ouvre l'éditeur et saisit le contexte `fatima@example.com`.
2. La preview rend **un sujet sans prénom** (`Bienvenue ` au lieu de `Bienvenue
   Fatima`) : `firstname` n'existe pas → chaîne vide.
3. Le **panneau variables** montre que la bonne clé est `firstName=Fatima` (et non
   `firstname`). En tapant `{{fir`, l'autocomplete propose `firstName`.
4. Il corrige `{{firstname}}` → `{{firstName}}` ; la preview affiche « Bienvenue
   Fatima ».

**Oracles**
- Avant correction : le sujet preview **ne contient pas** « Fatima ».
- Le panneau variables **ne propose jamais** `firstname` (casse exacte) ; il
  propose `firstName`.
- Après correction : le sujet preview **contient** « Fatima ».

**Mapping** : `F07-E-120`.

---

## SM-F07-04 — Supprimer l'ancien template encore branché

**Persona** : Imane fait le ménage. Elle veut supprimer `welcome-old`, mais il est
encore référencé par l'étape `send` de l'automation active `welcome-flow`.

**Préconditions** : template `welcome-old` ; automation `welcome-flow` (active)
avec un step `send` ciblant `welcome-old`.

**Déroulé**
1. Imane ouvre l'éditeur de `welcome-old` → une **bannière** « Utilisé par 1
   automation active (welcome-flow) » est visible.
2. Elle clique **Supprimer** → ConfirmDialog danger.
3. Elle confirme → l'API répond **409** ; un dialogue **pédagogique** liste
   l'automation bloquante `welcome-flow` avec un **lien** vers elle.
4. Le template **n'est pas** supprimé ; il reste dans la liste.

**Oracles**
- La bannière d'usage est présente avant l'action.
- Après confirmation, un dialogue liste `welcome-flow` (+ lien) ; aucun toast de
  succès de suppression.
- `welcome-old` est **toujours présent** dans la liste après l'opération.

**Mapping** : `F07-E-121`.

---

## SM-F07-05 — L'injection du stagiaire

**Persona** : Yassine colle un fragment HTML « trouvé sur internet » qui contient,
à son insu, du code hostile (`<script>`, un `<iframe>`, un `onerror`, un
`<form>` de phishing, un `style="…expression(…)"`).

**Préconditions** : template vierge, un lead réel pour la preview, Mailpit vide.

**Déroulé**
1. Yassine colle le bloc hostile dans l'éditeur.
2. La **preview** s'affiche : le contenu visible légitime (texte, liens https)
   reste, mais aucun script/iframe/form/handler n'est présent dans l'iframe.
3. Il s'envoie une **épreuve** via Tester.

**Oracles**
- Le HTML de la preview (iframe `srcDoc`) **ne contient** ni `<script`, ni
  `<iframe`, ni `<form`, ni `onerror`, ni `expression(`.
- Le message reçu dans **Mailpit** est sanitizé à l'identique (charge active
  absente, contenu légitime conservé).
- Aucune erreur n'est levée (la sanitization est **silencieuse** : elle nettoie,
  elle ne bloque pas l'édition).

**Mapping** : `F07-E-122`. Gate sécurité : ce scénario double, au niveau parcours,
la batterie unitaire `F07-U-089..103`.
