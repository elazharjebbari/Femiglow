# CPN-11 — Cycle de vie du statut (opérateur)

> Périmètre : machine à états du statut d'un coupon et son **effet observable sur
> `/kit`**. Route à créer : `POST /api/admin/coupons/[id]/status`.
> UI : badge de statut + bouton(s) de transition sur la liste et l'édition
> (`/admin/coupons`, `/admin/coupons/[id]`).
> Le CRUD de base est en CPN-10 ; la résolution `/kit` côté visiteur en CPN-06 ;
> l'invalidation de cache en CPN-18 ; le RBAC en CPN-13.
> Criticité **P0** — c'est le **levier qui rend une remise visible ou non** sur
> `/kit`. Une transition mal gérée = remise fantôme ou perte d'offre.

---

## (a) Fonctionnement optimal — parcours opérateur détaillé

### Machine à états
```
draft ──activer──▶ active ──pauser──▶ paused
  │                  │                   │
  │                  └──archiver───────┐ │
  │                                    ▼ ▼
  └──archiver──────────────────────▶ archived
                                       ▲
                       paused ─archiver┘

  paused ──reprendre──▶ active
  archived ──(réactivation interdite)──✗
```

**Règles de transition (autorisées)** :
- `draft → active` (activer)
- `draft → archived` (abandonner un brouillon)
- `active → paused` (pauser)
- `active → archived` (retirer définitivement)
- `paused → active` (reprendre)
- `paused → archived`

**Transitions interdites (→ `409 conflict` + message)** :
- `archived → *` (un coupon archivé est terminal ; pour réutiliser, **dupliquer**).
- `draft → paused` (on ne pause pas ce qui n'a jamais été actif).
- transition vers le **même statut** (no-op explicite → `409` ou `200` idempotent ;
  ce dossier fige : **idempotent 200** si statut identique demandé, sans audit en double).

### Parcours opérateur
1. Sur la liste ou l'édition, chaque coupon affiche un **badge de statut** et le(s)
   bouton(s) de transition pertinents :
   - `draft` → bouton **« Activer »**.
   - `active` → bouton **« Mettre en pause »**.
   - `paused` → bouton **« Reprendre »** (réactiver).
   - `archived` → aucune action de transition (badge gris, lecture seule).
2. L'opérateur clique « Activer ». Une **confirmation** s'affiche pour les
   transitions à effet public (« Activer ce coupon ? Il deviendra visible sur le
   site. »).
3. `POST /api/admin/coupons/[id]/status` `{ to: "active", version }`.
4. Succès `200` → badge mis à jour, toast « Coupon activé ». **Effet `/kit`** :
   `revalidateTag('coupons')` → la remise devient visible (CPN-06/18).
5. **Unicité welcome_auto actif** : un seul coupon de type `welcome_auto` peut
   être `active` à un instant donné. Activer un second `welcome_auto` quand un
   autre est déjà actif → `409 conflict` avec message « Un coupon d'accueil est
   déjà actif (… ). Mettez-le en pause d'abord. » (ou propose de pauser l'autre).

---

## (b) Contrats I/O

### `POST /api/admin/coupons/[id]/status`
- Body : `{ to: "active" | "paused" | "archived" | "draft"? , version: number }`.
  (`draft` n'est généralement pas une cible de transition manuelle ; reste réservé.)
- `200` : `{ id, status: <to>, version: <version+1> }`.
- `422 invalid_input` si `to` absent/invalide.
- `409 conflict` si transition interdite (ex. depuis `archived`, ou
  `draft→paused`) → `{ error: { code: "conflict", message } }`.
- `409 conflict` (welcome_auto unicité) si activation d'un 2e `welcome_auto`
  alors qu'un autre est `active` → `{ error: { code: "conflict", message,
  conflictingId } }`.
- `409 version_conflict` si `version` stale.
- `404 not_found` si coupon inconnu.
- `401`/`403` selon auth/RBAC (CPN-13 ; action requise `write`).
- Effet : `logAuditEvent({ action: 'admin.coupon.status_changed', meta: { from,
  to } })` + `revalidateTag('coupons')`.

### Effet `/kit` (vérifié bout-en-bout)
- `active` → la remise du coupon est **visible** sur `/kit` (prix barré +
  prix remisé selon CPN-06).
- `paused`/`archived`/`draft` → **fallback plein tarif** (pas de remise affichée).
- L'effet n'est visible qu'**après** `revalidateTag('coupons')` (cohérent CPN-18).

---

## (c) Points de vérification par axe

**Backend**
- Table de transitions appliquée côté serveur (source de vérité), pas seulement UI.
- Unicité `welcome_auto` actif vérifiée transactionnellement (pas de race « deux
  actifs »).
- `version` (compare-and-set) sur la transition aussi.

**Frontend**
- Le bouton affiché dépend du statut courant (Activer/Pauser/Reprendre).
- Confirmation pour les transitions à effet public (active, et reprise).
- Badge statut mis à jour optimiste puis confirmé (rollback si erreur).

**UI/UX opérateur**
- Toasts explicites : « Coupon activé », « Coupon mis en pause », « Coupon repris »,
  « Coupon archivé ».
- Message clair sur transition interdite et sur conflit d'unicité welcome_auto
  (avec nom du coupon en conflit).

**Design / charte admin**
- Badges sobres : draft=neutre, active=sauge, paused=ambre doux, archived=gris.
  Aucun rouge retail, aucun countdown.

**Data**
- `status` ∈ {draft, active, paused, archived}. `usageCount` inchangé par une
  transition.
- L'archivage conserve la ligne (cf. CPN-10 soft delete).

**Sécurité / RBAC**
- Transition = mutation → exige `write`. Lecture seule → `403` (CPN-13).
- Vérifier la permission AVANT toute écriture/revalidate.

**Performance**
- Transition O(1) + une invalidation de tag. Pas de recalcul global.

**Accessibilité**
- Badge avec texte (pas couleur seule). Bouton transition focusable, libellé clair.
- Confirmation = dialog avec focus piégé, Échap pour annuler.

**i18n**
- Libellés de statut et de bouton clés i18n (FR Phase 1).

**Observabilité / audit**
- Chaque transition réussie → `admin.coupon.status_changed` avec `from`/`to`.
- Pas d'audit sur no-op idempotent (statut identique).

---

## (d) Edge cases & matrice d'états

| Catégorie | Cas | Attendu |
|---|---|---|
| Nominal | `draft → active` | `200`, badge active, toast, `/kit` montre la remise après revalidate |
| Nominal | `active → paused` | `200`, badge paused, `/kit` repasse plein tarif |
| Nominal | `paused → active` | `200` (reprise), remise de nouveau visible |
| Nominal | `active → archived` | `200`, badge archived, plus d'action |
| Interdit | `archived → active` | `409 conflict` « coupon archivé, dupliquez-le » |
| Interdit | `draft → paused` | `409 conflict` |
| Limite | transition vers même statut | `200` idempotent, pas d'audit doublon |
| Invalide | `to` inconnu (`"banana"`) | `422 invalid_input` |
| Conflit unicité | activer 2e welcome_auto | `409 conflict` + `conflictingId` |
| Concurrence | 2 opérateurs activent le même coupon | 1er `200`, 2e `409 version_conflict` (ou idempotent si même `to`) |
| Concurrence | 2 opérateurs activent 2 welcome_auto distincts | 1 réussit, l'autre `409` unicité |
| Erreur réseau | `403` (lecture seule) | toast « Action non autorisée », badge inchangé |
| Erreur réseau | `500` | toast « Une erreur est survenue », rollback badge optimiste |
| Latence | transition lente | bouton désactivé + spinner pendant l'appel |
| Cache | activer puis charger `/kit` | remise visible **après** revalidate, pas avant |
| Cache | pauser puis charger `/kit` | fallback plein tarif après revalidate |
| Double-clic | clic « Activer » ×2 | une seule requête (bouton désactivé) |

---

## (e) Risques

| ID | Risque | Impact | Mitigation testée |
|---|---|---|---|
| R-11-1 | Transition interdite acceptée | Coupon archivé réactivé | Table de transitions serveur → `409` |
| R-11-2 | Deux welcome_auto actifs | Remise ambiguë sur `/kit` | Unicité transactionnelle → `409` + conflictingId |
| R-11-3 | `/kit` non rafraîchi après transition | Remise fantôme / offre perdue | `revalidateTag('coupons')` + test E2E admin→/kit |
| R-11-4 | Course entre deux opérateurs | Écrasement / double activation | `version` CAS + unicité |
| R-11-5 | Badge optimiste non rollback sur erreur | UI ment sur l'état réel | Rollback testé (I) sur 500/403 |
| R-11-6 | Transition sans audit | Traçabilité perdue | `admin.coupon.status_changed` testé |
| R-11-7 | Double-clic → double transition/audit | Bruit + course | Bouton désactivé + idempotence |
| R-11-8 | Mutation sans contrôle RBAC | Lecture seule modifie l'état | Permission `write` AVANT écriture (CPN-13) |

---

## (f) Critères d'acceptation

- **AC-11-1** : `draft → active` → `200`, badge « active », toast « Coupon activé »,
  audit `admin.coupon.status_changed` `{from:'draft',to:'active'}`, `revalidateTag('coupons')`.
- **AC-11-2** : E2E — activer en admin puis charger `/kit` → la remise est visible
  (prix remisé) ; pauser puis recharger `/kit` → plein tarif.
- **AC-11-3** : `archived → active` → `409 conflict`, message « coupon archivé »,
  statut inchangé.
- **AC-11-4** : `draft → paused` → `409 conflict`.
- **AC-11-5** : activer un 2e `welcome_auto` alors qu'un autre est actif → `409
  conflict` avec `conflictingId` du coupon en conflit.
- **AC-11-6** : `to` invalide → `422`.
- **AC-11-7** : transition concurrente (version stale) → `409 version_conflict`.
- **AC-11-8** : sur erreur `500`, le badge optimiste revient à l'état initial.
- **AC-11-9** : double-clic « Activer » → une seule requête, un seul audit.
- **AC-11-10** : transition vers le même statut → `200` idempotent, aucun audit
  supplémentaire.
