# F04 — Section « Codes de fidélité émis » (chargement à la demande + masquage PII)

## Rôle & surface
Permettre à l'opérateur de consulter les **codes de fidélité émis** (grants) sans jamais exposer le
téléphone de la cliente en clair. Surface : section testid `coupons-grants-section` de
`<CouponsManager/>`. Fichier cible : `apps/web/src/components/admin/coupons/CouponsManager.tsx`.
Fichier de test : `src/components/admin/coupons/CouponsManager.grants.test.tsx`.

## Fonctionnement optimal (ce qui DOIT se passer)
Au montage, `grants === null` : le tableau `coupons-grants-table` **n'est pas rendu**, et le bouton
porte le texte « Charger ». Geste nominal : Karim clique « Charger ». Le composant :
1. `GET /api/admin/coupons/grants` (`credentials:'include'`) ;
2. sur `res.ok`, `setGrants(items)` → le tableau apparaît, et le bouton devient « Rafraîchir ».

Pour chaque grant, une ligne `grant-row-{id}` avec colonnes :
- **Code** (classe `font-mono`) : ex. `FG-SAUGE-7212`.
- **Téléphone** : affiché **tel quel** = déjà masqué par le serveur (ex. `0612…78`). Le composant ne
  démasque ni ne reformate.
- **Valeur** : `{valueCents/100} MAD` arrondi (ex. 2000 → `20 MAD`).
- **Statut** : `g.status` brut (ex. `issued`, `active`, `redeemed`, `expired`).
- **Activation** / **Expiration** : `new Date(x).toLocaleDateString('fr-MA')` ou `—` si null.

Liste vide : ligne unique « Aucun code émis. ». « Rafraîchir » relance le même GET et remplace.

## Contrat I/O
- `GET /api/admin/coupons/grants` → `{ items: GrantRow[], total }`. Filtres serveur `phone`/`status`
  supportés côté handler MSW mais **non câblés** dans cette UI (pas de champ de filtre rendu).
- `GrantRow` : `{ id, code, phone (MASQUÉ), valueCents, status, activatesAt, expiresAt }`.
- En cas d'échec (`!res.ok` ou throw), `setGrants` n'est pas appelé : le tableau reste absent, le
  bouton reste « Charger », **aucun role=alert** (chemin sans gestion d'erreur — comportement constaté).

## Cas limites & non-happy-path
- **Liste vide** → « Aucun code émis. » (le tableau est rendu mais sans ligne de données).
- **Téléphone masquage (INV-PII)** : le `phone` rendu doit matcher un motif masqué (`…` ou `*`) et
  **ne jamais** contenir 6 chiffres consécutifs ou plus. Oracle : `/\d{6,}/` ne matche pas le texte
  du téléphone. C'est le test PII central de tout le dossier.
- **Dates null** → cellule `—` (activatesAt et/ou expiresAt manquants, ex. grant `issued` non encore
  activé).
- **Valeur** : `valueCents` 2000 → `20 MAD` ; jamais en `%`.
- **403** (RBAC `read` refusé) / **500** / **'network'** : tableau non rendu, bouton reste « Charger »,
  pas d'alerte.
- **Rafraîchir après échec** : un second clic réussi doit pouvoir afficher la liste (pas d'état bloqué).
- **Statut brut** : `g.status` affiché tel quel (pas de STATUS_LABEL ici) ; c'est volontaire.
- Charte : aucun `%`/`!`/emoji ; le code en `font-mono` ; pas de terracotta sur ces lignes.

## Invariants couverts
- **INV-PII** : le téléphone n'apparaît jamais en clair côté admin (masqué `06…78`). Le composant
  fait confiance au serveur (masquage en sérialisation) — le test verrouille ce contrat côté UI pour
  attraper une régression de fixture/handler qui exposerait un numéro complet.
- Lacune d'audit : section grants de `CouponsManager` non testée (chargement, masquage, vide, dates).

## Critères d'acceptation (observables)
- Au montage : `queryByTestId('coupons-grants-table')` null ; bouton textContent === « Charger ».
- Après « Charger » OK : tableau présent, bouton === « Rafraîchir », N lignes `grant-row-*`.
- Téléphone rendu matche `/…|\*/` ET ne matche pas `/\d{6,}/`.
- Code rendu porte la classe `font-mono`.
- Valeur rendue === `20 MAD` (pour 2000 centimes).
- Dates null rendues `—`.
- Liste vide → texte « Aucun code émis. ».
- Échec (403/500/network) : tableau absent, bouton reste « Charger », aucun `role="alert"`.

## Points à vérifier — tous points de vue
- Backend : route grants masque le téléphone en sérialisation ; RBAC `read`.
- Frontend : rendu conditionnel (`grants===null`), bascule du libellé bouton, pas de démasquage.
- UI/UX/design : code en `font-mono` lisible, dates locales `fr-MA`.
- Data : `valueCents/100` ; null → `—` ; statut brut.
- A11y : tableau structuré (thead/tbody) ; pas de role=alert sur ce chemin.
- i18n : `toLocaleDateString('fr-MA')` ; libellés FR ; RTL AR hors scope ici.
- **Sécurité/PII** : assertion forte « pas de 6 chiffres consécutifs » sur chaque téléphone.
