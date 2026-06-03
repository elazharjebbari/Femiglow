# F02 — Transitions de statut (activer / pauser / archiver)

## Rôle & surface
Permettre à l'opérateur de piloter le cycle de vie d'un coupon depuis le tableau de
`<CouponsManager/>` : passer un brouillon en **Actif**, mettre un coupon actif **En pause**, ou
**Archiver** (verrou terminal). Fichier cible : `apps/web/src/components/admin/coupons/CouponsManager.tsx`.
Fichier de test : `src/components/admin/coupons/CouponsManager.status.test.tsx`.

## Fonctionnement optimal (ce qui DOIT se passer)
Chaque ligne `coupon-row-{id}` affiche des actions **conditionnelles au statut courant** :
- « Activer » : visible si `status !== 'active' && status !== 'archived'` → cible `active`.
- « Pauser » : visible si `status === 'active'` → cible `paused`.
- « Archiver » : visible si `status !== 'archived'` → cible `archived`.
- « Stats » : toujours visible (cf. F03).

Geste nominal (ex. activer) : Karim clique « Activer ». Le composant :
1. `busy=true` (toutes les actions transition deviennent `disabled`) et efface l'erreur ;
2. `POST /api/admin/coupons/{id}/status` body `{ status }` ;
3. sur `res.ok`, appelle `refresh()` = `GET /api/admin/coupons`, **remplace** le tableau ;
4. la cellule `coupon-status-{id}` reflète le nouveau libellé (STATUS_LABEL) et le jeu de boutons
   se recompose : après `active` → « Pauser » et « Archiver » apparaissent, « Activer » disparaît.

Libellés (STATUS_LABEL) : `draft→Brouillon`, `active→Actif`, `paused→En pause`, `archived→Archivé`.
Matrice attendue des actions par statut :
- `draft` : Activer, Archiver, Stats.
- `active` : Pauser, Archiver, Stats. (pas d'Activer)
- `paused` : Activer, Archiver, Stats.
- `archived` : Stats uniquement (état terminal, plus aucune transition).

## Contrat I/O
- `POST /api/admin/coupons/{id}/status`, `credentials:'include'`, body `{ status: 'active'|'paused'|'archived' }`.
- Sur ok → `GET /api/admin/coupons` (refresh) qui relit l'état stateful muté côté MSW.
- Le handler MSW renvoie **409** si la cible n'est pas `archived` alors que le coupon est déjà
  `archived` (lock terminal), et **404** si l'id est introuvable.

## Cas limites & non-happy-path
- **Lock archivé → 409** : tenter une transition sur un coupon `archived` (cas théorique si le bouton
  était forcé) ⇒ `setError('Transition refusée (HTTP 409).')`. En pratique l'UI masque déjà Activer/Pauser/Archiver
  pour `archived` : on assert l'**absence des boutons** comme garde primaire.
- **403** (RBAC `publish` refusé) → `Transition refusée (HTTP 403).`
- **422** → `Transition refusée (HTTP 422).`
- **500** → `Transition refusée (HTTP 500).`
- **'network'** → `Erreur réseau.`
- Sur échec, pas de `refresh()` : le badge de statut reste inchangé, `busy` repasse à `false`.
- Pendant le vol, **toutes** les actions transition de toutes les lignes sont `disabled` (busy global).
- Idempotence d'affichage : ré-activer un coupon déjà `active` n'est pas proposé (bouton absent).
- Charte : libellés sans `%`/`!`/emoji ; pas de couleur terracotta sur les statuts (réservée à l'économie).

## Invariants couverts
- **INV-PERM** : la transition relève du droit `publish` ; refus 403 rendu, pas de changement silencieux.
- Lock terminal `archived` (lacune route status 409) reflété côté UI par l'absence des actions.

## Critères d'acceptation (observables)
- Après « Activer » sur un `draft` : `coupon-status-{id}` = `Actif`, « Pauser » présent, « Activer » absent.
- Après « Pauser » sur un `active` : `coupon-status-{id}` = `En pause`, « Activer » présent.
- Après « Archiver » : `coupon-status-{id}` = `Archivé`, seul « Stats » subsiste sur la ligne.
- Coupon `archived` au montage : aucun bouton « Activer »/« Pauser »/« Archiver » ; « Stats » présent.
- Sur erreur : `role="alert"` contient `Transition refusée (HTTP <code>).` ou `Erreur réseau.`
- Pendant `busy` : les boutons transition portent `disabled`.

## Points à vérifier — tous points de vue
- Backend : route status applique RBAC `publish` + lock `archived`→409.
- Frontend : recomposition correcte des boutons après refresh (pas de bouton fantôme).
- UI/UX/design : actions évidentes, archivage clairement terminal.
- Data : statut affiché = statut serveur après refresh (pas d'optimistic).
- A11y : erreur via `role="alert"` ; boutons avec texte explicite.
- i18n : libellés FR ; AR couvert ailleurs.
