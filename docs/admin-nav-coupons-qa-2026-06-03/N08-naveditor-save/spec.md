# N08 — `NavEditor` : sauvegarde réseau (PATCH `/api/admin/settings/nav` via MSW)

## Rôle & surface
Frontière réseau de l'éditeur de navigation : `handleSave` (dans
`apps/web/src/components/admin/settings/NavEditor.tsx`) envoie un `PATCH /api/admin/settings/nav` avec
l'en-tête optimiste `If-Match: <version>` et un corps `{ payload: <NavConfig validé> }`, puis traduit
la réponse en message opérateur et met à jour la version locale. On mocke la frontière HTTP avec un
handler MSW dédié `navSettingsHandlers` (à créer dans `src/test/msw/`). Couche **M** (frontière réseau)
au-dessus du composant. La validation client préalable et l'édition locale sont couvertes par N07.
Fichier cible : `src/components/admin/settings/NavEditor.save.test.tsx` (nouveau).

> **Pré-requis MSW** : `navSettingsHandlers` (nouveau, `src/test/msw/nav-settings-handlers.ts`) expose
> `PATCH /api/admin/settings/nav` avec variantes injectables : **success** (200, `meta.version`
> incrémentée, **écho du `If-Match` reçu** pour assertion), **conflict** (409
> `{error:{code:'version_conflict', details:{currentVersion}}}`), **validation** (422
> `{error:{code:'validation_failed', details:[{path,message}]}}`), **server** (500), **network**
> (`HttpResponse.error()`). Cycle de vie PAR FICHIER (`server.listen`/`resetHandlers`/`close`).

## Fonctionnement optimal (ce qui DOIT se passer)
1. Karim a une nav localement valide et modifiée. Il clique « Enregistrer ».
2. `handleSave` re-valide client (`navSchema.safeParse`) — OK — puis `fetch('/api/admin/settings/nav',
   { method:'PATCH', headers:{ 'Content-Type':'application/json', 'If-Match': String(version) },
   body: JSON.stringify({ payload: parsed.data }) })`.
3. **200** : `data.meta.version` (ex. 2) → `setSuccess('Navigation enregistrée.')`, `set-errors []`,
   `setVersion(2)`. Un Save suivant enverra `If-Match: 2`.
4. Le corps envoyé contient `payload.items` **renumérotés** (`normalizePositions`) et NE contient PAS
   de `requiresRole:'—'` (option neutre → `undefined`, donc absente du JSON).

## Contrat I/O
- **Requête** : `PATCH /api/admin/settings/nav`, `If-Match: <version>` (string du nombre),
  `Content-Type: application/json`, body `{ payload: { items:[…] } }`.
- **Réponses gérées par `handleSave`** :
  - `200` → `{ section, payload, meta:{ version, … }, snapshotId }` ⇒ « Navigation enregistrée. » +
    `setVersion(meta.version)`.
  - `409` → « Une autre modification a été enregistrée. Recharge la page. » (le corps n'est PAS lu).
  - `422` → lit le JSON, message « Validation serveur en échec. », mappe `data.error.details`
    (`[{path,message}]`) vers `set-errors` (donc erreurs par ligne via `errorByRow`).
  - **autre `!res.ok`** (500, 502…) → « Erreur serveur. ».
  - **rejet fetch** (réseau) → `catch` : message = `err.message` ou « Erreur réseau. ».
- **Effets locaux** : `saving` true pendant le fetch (bouton « Enregistrement… »), repassé false en
  `finally`. `success`/`error` exclusifs (reset au début de `handleSave`).

## Cas limites & non-happy-path
- **`If-Match` reflète la version courante** : monter avec `meta.version=1` → 1ᵉʳ Save envoie
  `If-Match: 1` ; après 200 (`meta.version:2`), un 2ᵉ Save envoie `If-Match: 2` (assert sur l'écho du
  handler ou via interception de la requête).
- **409 conflit** : message exact, **version locale inchangée**, aucune erreur par ligne, le corps de
  réponse n'est volontairement pas parsé.
- **422 serveur** : même si le client a laissé passer (ou serveur plus strict), les `details` sont
  mappés par ligne (`aria-invalid` sur la cellule ciblée par `path`). Message global « Validation
  serveur en échec. ».
- **500** : « Erreur serveur. », pas de mapping de ligne, version inchangée.
- **network** (`HttpResponse.error()`) : `catch` → message d'erreur réseau ; `saving` repasse false ;
  le bouton redevient cliquable (réessayable).
- **`saving` pendant l'appel** : double-clic Save ne doit pas empiler les requêtes (vérifier compteur
  de requêtes = 1 par clic ; le `SectionEditorShell` désactive le bouton pendant `saving`).
- **Échec de validation CLIENT** (ex. clé dupliquée) : aucun fetch (frontière N07, rappelé ici comme
  garde — `fetch` non appelé).
- **success puis nouvelle édition** : après « Navigation enregistrée. », éditer remet `dirty` vrai ; le
  message succès n'empêche pas un nouveau Save.

## Invariants couverts
- **NAV-INV-LOCK** : la sauvegarde envoie toujours `If-Match: <version>` ; 409 = conflit géré sans
  écraser ; version locale non corrompue.
- **NAV-INV-PERSIST** : 200 ⇒ version incrémentée appliquée localement (`setVersion`).
- Robustesse réseau (500/network → message lisible, pas de crash).

## Critères d'acceptation (observables)
- Au Save, la requête interceptée a `headers['if-match'] === '1'` et `body.payload.items` défini.
- 200 → `getByText('Navigation enregistrée.')` ; un Save ultérieur envoie `If-Match: 2`.
- 409 → `getByText('Une autre modification a été enregistrée. Recharge la page.')` ; pas de mapping ligne.
- 422 → `getByText('Validation serveur en échec.')` + cellule ciblée `aria-invalid="true"`.
- 500 → `getByText('Erreur serveur.')`.
- network → message d'erreur réseau visible ; bouton Save de nouveau activable.
- Validation client en échec → `fetch` (compteur MSW) non incrémenté.
- Le corps envoyé ne contient jamais `"requiresRole":"—"`.

## Points à vérifier — tous points de vue
- Backend : contrat réel testé en N09 ; ici on vérifie ce que le CLIENT envoie/interprète.
- Frontend : header `If-Match`, parsing conditionnel du corps (422 lu, 409 non), `setVersion`.
- UI/UX : messages exacts FR, état `saving`, exclusivité succès/erreur, bouton non spammable.
- Data : `payload.items` renumérotés, `requiresRole` absent si `—`.
- A11y : message de succès/erreur via `role="status"`/`role="alert"` du `SectionEditorShell`.
- i18n : messages FR figés (éditeur admin FR-only).
