# N08 — Scénarios (Gherkin FR)

Persona : **Karim**, opérateur. Frontière `PATCH /api/admin/settings/nav` mockée par
`navSettingsHandlers` (MSW). Le composant édité provient de N07.

## Scénario N08-S1 — Sauvegarde réussie (happy)
Contexte: Karim a réordonné la nav (version locale 1) et clique « Enregistrer ».
Étant donné que le handler MSW renvoie 200 avec `meta.version: 2`
Quand la requête part
Alors elle porte `If-Match: 1` et un corps `{ payload: { items: [...] } }`
Et le message « Navigation enregistrée. » s'affiche
Et la version locale passe à 2 — un nouveau « Enregistrer » enverrait `If-Match: 2`.

## Scénario N08-S2 — Conflit de version (edge 409)
Contexte: un autre admin a sauvegardé entre-temps ; le handler renvoie 409 `version_conflict`.
Étant donné que Karim clique « Enregistrer » avec `If-Match: 1`
Quand le serveur répond 409
Alors le message « Une autre modification a été enregistrée. Recharge la page. » s'affiche
Et aucune cellule n'est marquée en erreur
Et la version locale reste 1 (pas d'écrasement silencieux).

## Scénario N08-S3 — Validation serveur plus stricte (edge 422)
Contexte: le serveur refuse un href que le client avait laissé passer ; handler 422 avec
`details:[{ path:['items',1,'href'], message:'href doit commencer par /.' }]`.
Étant donné que Karim clique « Enregistrer »
Quand le serveur répond 422
Alors le message global « Validation serveur en échec. » s'affiche
Et la cellule Href de la 2ᵉ ligne passe en `aria-invalid="true"` avec son message
Et Karim peut corriger et resauvegarder.

## Scénario N08-S4 — Coupure réseau (edge network)
Contexte: le réseau tombe pendant la sauvegarde ; handler `HttpResponse.error()`.
Étant donné que Karim clique « Enregistrer »
Quand le `fetch` est rejeté
Alors un message d'erreur réseau s'affiche via `role="alert"`
Et l'état `saving` repasse à false
Et le bouton « Enregistrer » redevient cliquable (réessayable).

## Scénario N08-S5 — Garde client avant tout réseau (edge)
Contexte: Karim a introduit une clé dupliquée et clique « Enregistrer ».
Étant donné cette nav localement invalide
Quand il clique « Enregistrer »
Alors aucune requête PATCH n'est émise (compteur MSW = 0)
Et le message « 1 erreur(s) à corriger. » s'affiche localement.
