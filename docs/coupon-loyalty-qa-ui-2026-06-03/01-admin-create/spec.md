# F01 — Création d'un coupon d'accueil (formulaire opérateur)

## Rôle & surface
Permettre à l'opérateur (Karim) de créer rapidement un coupon d'accueil **en brouillon** depuis le
back-office. Surface : section « Nouveau coupon d'accueil » de `<CouponsManager/>`, montée sur
`/admin/coupons`. Fichier cible : `apps/web/src/components/admin/coupons/CouponsManager.tsx`.
Fichier de test : `src/components/admin/coupons/CouponsManager.create.test.tsx`.

## Fonctionnement optimal (ce qui DOIT se passer)
À l'arrivée, le composant rend `initialCoupons` **sans aucun fetch au montage** (le Server Component
parent fournit la liste). Le formulaire affiche deux champs pré-remplis :
- input `aria-label="Libellé"` valeur initiale `Geste d'accueil`.
- input `aria-label="Montant offert"` (`type=number`) valeur initiale `9000` (centimes).
- bouton `Créer (brouillon)`.

Geste nominal : Karim ajuste le libellé et/ou le montant, clique `Créer (brouillon)`. Le composant :
1. passe `busy=true` (le bouton se désactive, `disabled`) et efface l'erreur courante ;
2. `POST /api/admin/coupons` avec le payload figé ci-dessous ;
3. sur `res.ok`, appelle `refresh()` = `GET /api/admin/coupons` et **remplace** entièrement le tableau
   par `items` ;
4. la nouvelle ligne `coupon-row-{id}` apparaît, son statut `coupon-status-{id}` affiche `Brouillon`,
   sa valeur affiche `90 MAD` (montant/100 arrondi), `busy` repasse à `false`.

La ligne créée n'apparaît **que** parce que le `GET` stateful la renvoie ; on ne fait pas d'optimistic
update. Le formulaire ne se réinitialise pas (libellé/montant conservés — pas d'invariant dessus).

## Contrat I/O
- Props : `CouponsManager({ initialCoupons: SerializedCoupon[] })`. Aucun callback émis.
- `POST /api/admin/coupons`, `credentials: 'include'`, `content-type: application/json`, body exact :
  `{ label, type:'welcome_auto', mode:'auto', status:'draft', valueKind:'fixed_amount', valueAmount, target:'product_price', currency:'MAD' }`.
- `GET /api/admin/coupons` → `{ items: SerializedCoupon[], total }` (déclenché par `refresh()`).
- Réponses d'échec création : 4xx/5xx → message ; rejet du `fetch` (réseau) → message générique.

## Cas limites & non-happy-path
- **403** (RBAC `write` refusé / viewer) → `setError('Création refusée (HTTP 403).')`.
- **409** (conflit) → `Création refusée (HTTP 409).`
- **422** (payload refusé) → `Création refusée (HTTP 422).`
- **500** (serveur) → `Création refusée (HTTP 500).`
- **'network'** (fetch rejette) → `Erreur réseau.`
- Sur échec, `refresh()` n'est **pas** appelé : le tableau reste inchangé, `busy` repasse à `false`
  (bloc `finally`), le bouton redevient cliquable.
- Latence : pendant le vol, le bouton reste `disabled` (oracle d'état transitoire).
- Montant = `0` → la requête part quand même (validation serveur, ici hors scope UI).
- Charte : aucun texte UI ne doit contenir `%`/`!`/emoji/compte à rebours ; le montant s'affiche en
  MAD absolus (`90 MAD`), jamais en pourcentage pour un `fixed_amount`.

## Invariants couverts
- **INV-PERM** : la création relève du droit `write` ; un refus 403 doit être rendu à l'opérateur
  (pas d'écriture silencieuse, pas de fausse ligne).
- Lacune d'audit : `CouponsManager` avait **0 test composant** sur le chemin de création.

## Critères d'acceptation (observables)
- Au montage, exactement `initialCoupons.length` lignes `coupon-row-*`, aucun appel réseau.
- Après création OK : une ligne supplémentaire dont `coupon-status-{id}` = `Brouillon`.
- Le payload POST contient `type:'welcome_auto'`, `mode:'auto'`, `status:'draft'`, `valueKind:'fixed_amount'`, `target:'product_price'`, `currency:'MAD'` et le `label`/`valueAmount` saisis.
- Sur chaque code d'erreur : `role="alert"` contient `Création refusée (HTTP <code>).` ; sur réseau : `Erreur réseau.`
- Le bouton est `disabled` pendant `busy` et redevient actif ensuite (succès comme échec).

## Points à vérifier — tous points de vue
- Backend : payload conforme au schéma `order.ts`/route create ; RBAC `write`.
- Frontend : pas de fetch au montage ; remplacement (non append) de la liste via `refresh()`.
- UI/UX/design : libellé/montant pré-remplis sensés ; bouton clairement désactivé pendant l'envoi.
- Data : `valueAmount` en centimes → affichage `90 MAD` ; pas d'optimistic stale.
- A11y : erreur exposée via `role="alert"` ; champs nommés par `aria-label`.
- i18n : libellés FR ; en AR, `dir="rtl"` et montants en `درهم` (couverts ailleurs, non régressés ici).
