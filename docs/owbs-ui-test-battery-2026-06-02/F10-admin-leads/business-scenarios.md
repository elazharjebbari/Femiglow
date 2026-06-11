# F10 — Scénarios métier réalistes (opérateur)

## BM-F10-1 — Nadia traite les leads du matin
**Parcours :** ouvre `/admin/leads`, filtre `captured` (non convertis), ouvre un
détail, lit la chronologie + le panier, ajoute une note, change le statut.
**Attendu :** tout est lisible, exact, les actions ont un feedback, pas de double-action.
**Bug recherché :** états incohérents, leadId `cl_` mal affiché, action dupliquée.

## BM-F10-2 — Nadia vérifie un lead « capturé mais pas converti »
**Contexte :** une acheteuse a validé en optimiste puis abandonné.
**Attendu :** le lead est `captured`/`abandoned` avec les bons horodatages ; le
panier est visible pour une relance.
**Bug recherché :** lead invisible (latence projection) ou état faux.

## BM-F10-3 — Suivi d'une conversion en direct
**Parcours :** une acheteuse convertit ; Nadia rafraîchit → le lead passe `purchased`
avec la commande liée.
**Bug recherché :** lead resté `captured` malgré la commande (désync projection).

## BM-F10-4 — Réconciliation « zéro lead perdu » (transverse F04/F14)
**Attendu :** le total des leads admin == soumissions ; les leads optimistes
(upsert) et legacy sont indistincts et complets.
