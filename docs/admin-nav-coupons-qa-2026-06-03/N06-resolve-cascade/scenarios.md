# N06 — Scénarios (Gherkin FR)

Persona : le **système** (résolveur de config) au démarrage d'une requête admin, et **Karim**
côté badge « valeur défaut ». Frontière DB mockée (`getAppConfigRow`).

## Scénario N06-S1 — Environnement frais sans ligne nav (happy)
Contexte: la base ne contient aucune ligne `section='nav'`.
Étant donné que `getAppConfigRow('nav')` renvoie `null`
Quand le système résout la section `nav`
Alors le payload servi est exactement `navDefault`
Et le meta indique version 0, `isDefault: true`
Et aucun avertissement de corruption n'est journalisé
Et la sidebar fonctionne avec les onglets par défaut (dont Coupons).

## Scénario N06-S2 — Navigation personnalisée enregistrée (happy)
Contexte: Karim a déjà réordonné/édité la nav (version 4 en base).
Étant donné une row valide différente du défaut
Quand le système résout `nav`
Alors le payload servi est celui de la base (validé)
Et le meta indique version 4, `isDefault: false`
Et le badge « valeur défaut » n'apparaît PAS dans l'éditeur.

## Scénario N06-S3 — Payload base corrompu (edge failsafe)
Contexte: une migration boguée a écrit un payload nav avec une clé dupliquée (version 7).
Étant donné une row dont le payload viole `navSchema`
Quand le système résout `nav`
Alors `safeValidate` échoue et `logger.warn('admin_config.zod_fail', { section:'nav', issues })` est émis
Et le payload servi retombe sur `navDefault` (failsafe)
Et le meta conserve version 7 mais force `isDefault: true`
Et l'opérateur ne voit jamais d'écran cassé — seulement la nav par défaut.

## Scénario N06-S4 — Navigation identique au défaut mais persistée (edge isDefault)
Contexte: Karim a sauvegardé une nav qui, par coïncidence, est identique au défaut (version 2).
Étant donné une row valide structurellement égale à `navDefault`
Quand le système résout `nav`
Alors `isDefault` vaut `true` (comparaison `JSON.stringify`)
Mais la version reste 2 (la donnée vient bien de la base, pas du failsafe)
Et ce cas distingue « égal au défaut » de « jamais configuré ».

## Scénario N06-S5 — Corruption isolée à une section (edge agrégation)
Contexte: `nav` est corrompue mais `flags` est valide.
Étant donné `getAppConfig()` qui agrège les 4 sections
Quand il résout l'ensemble
Alors `cfg.nav` retombe sur les defaults et `cfg.meta.nav.isDefault` vaut `true`
Et `cfg.flags` reste servi intact, sans contamination par l'échec de `nav`.
