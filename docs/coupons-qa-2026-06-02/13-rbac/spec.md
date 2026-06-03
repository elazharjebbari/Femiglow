# CPN-13 — RBAC ressource `coupons` (opérateur)

> Périmètre : contrôle d'accès basé sur les rôles pour **toutes** les routes
> `/api/admin/coupons/**` et le masquage/désactivation des actions dans l'UI admin.
> S'appuie sur le socle existant :
> - `RBAC_RESOURCES` dans `apps/web/src/lib/admin-config/schemas.ts` (à étendre
>   avec `'coupons'`).
> - Matrice par défaut `rbacDefault.matrix` dans `lib/admin-config/defaults.ts`
>   (ajouter la colonne `coupons` à chaque rôle).
> - `rbacResourceMatrix` (objet `.strict()`) dans `schemas.ts` (ajouter `coupons`).
> - Pattern d'enforcement runtime : `lib/legal/permissions.ts`
>   (`getAdminRole`, `hasPermission`, `requireLegalPermission`). On crée
>   l'équivalent `requireCouponPermission(action, session)`.
> Criticité **P0** (sécurité : une lecture seule ne doit JAMAIS muter ; un non
> authentifié ne doit jamais atteindre l'admin).

---

## (a) Fonctionnement optimal — parcours opérateur détaillé

### Modèle de permissions
- Ressource : `coupons`. Actions : `read`, `write`, `publish`, `delete`
  (`RBAC_ACTIONS` existantes).
- Mapping verbe → action requise :
  | Route | Verbe | Action requise |
  |---|---|---|
  | `/api/admin/coupons` | GET (liste) | `read` |
  | `/api/admin/coupons` | POST (création) | `write` |
  | `/api/admin/coupons/[id]` | GET (détail) | `read` |
  | `/api/admin/coupons/[id]` | PATCH (édition) | `write` |
  | `/api/admin/coupons/[id]` | DELETE (archivage) | `delete` |
  | `/api/admin/coupons/[id]/status` | POST (transition) | `write` |
  | `/api/admin/coupons/[id]/stats` | GET | `read` |

  > `publish` est réservé pour une future séparation « activer = publier » ; en
  > Phase 1 l'activation (transition de statut) requiert `write`. La matrice
  > expose néanmoins `publish` pour cohérence avec les autres ressources.

### Matrice par défaut proposée (alignée sur les autres ressources)
| Rôle | coupons |
|---|---|
| superadmin | read, write, publish, delete |
| admin | read, write, publish |
| editor | read, write |
| viewer | read |

> Note : `admin` n'a **pas** `delete` (cohérent avec `users`/comportement
> restrictif sur la suppression) → un `admin` peut créer/éditer/activer mais
> **pas archiver** ; l'archivage exige `delete` (superadmin) OU on ajuste la
> matrice si le besoin métier diffère — figé ici : **`delete` = superadmin**.
> `viewer` est en lecture seule stricte.

### Ordre d'enforcement (NON négociable)
Dans **chaque** route, l'ordre est :
1. `getAdminSession()` → si absent : `401 unauthorized` (page → redirect
   `/admin/login`).
2. `requireCouponPermission(action, session)` → si refus : `403 forbidden`
   **AVANT** toute lecture de body, validation, écriture, audit de mutation ou
   `revalidateTag`.
3. Puis seulement : validation Zod, mutation, audit, revalidate.

### UI
1. La page liste/édition lit le rôle courant et **masque ou désactive** les
   actions non autorisées :
   - `viewer` : pas de bouton « Nouveau coupon », « Enregistrer », « Activer »,
     « Archiver » (ou désactivés avec tooltip « Droits insuffisants »).
   - `admin`/`editor` : actions de mutation visibles ; « Archiver » masqué si
     pas `delete`.
2. Le masquage UI est un **confort**, pas une sécurité : le serveur reste l'autorité
   (un appel API direct sans droit → `403`).

---

## (b) Contrats I/O

### Refus
- Non authentifié (API) → `401 { error: { code: 'unauthorized' } }`.
- Non authentifié (page) → `redirect('/admin/login?next=...')` via `requireAdmin`.
- Authentifié sans la permission → `403 { error: { code: 'forbidden',
  message: 'Permission refusée : rôle "<role>" sans droit "<action>" sur coupons.' } }`.

### Audit des refus
- Tout `403` sur une route de **mutation** (POST/PATCH/DELETE/status) journalise
  `logAuditEvent({ action: 'admin.coupon.permission_denied', actorId,
  resourceType: 'coupon', resourceId, meta: { action: <requise>, role } })`.
- Les refus en **lecture** (`GET`) peuvent être journalisés en `meta` allégé
  (optionnel Phase 1 ; au minimum loggés via `logger`).

### `requireCouponPermission`
```ts
async function requireCouponPermission(
  action: RbacAction,
  session: AdminSession,
): Promise<void>; // throw HttpError('forbidden') si refus
```
Identique en structure à `requireLegalPermission` mais sur la ressource
`'coupons'`.

---

## (c) Points de vérification par axe

**Backend / Sécurité (cœur)**
- `coupons` présent dans `RBAC_RESOURCES`, dans `rbacResourceMatrix` (`.strict()`),
  et dans `rbacDefault.matrix` pour les 4 rôles.
- `hasPermission(role, 'coupons', action)` correct pour les 4 rôles × 4 actions.
- Chaque route vérifie la permission **avant** toute mutation (test : la mutation
  n'a PAS eu lieu quand `403`).
- Le `superadmin` conserve toutes les actions (contrainte `superRefine` de
  `rbacSchema` : superadmin doit avoir read/write/publish/delete sur **chaque**
  ressource, donc `coupons` inclus → test du schéma).

**Backend / robustesse**
- `getAdminRole` fallback `superadmin` si colonne `role` absente (back-compat) —
  documenté ; les tests RBAC fixent un rôle explicite pour être déterministes.

**Frontend**
- Actions masquées/désactivées selon le rôle (viewer ne voit pas les CTA de
  mutation).
- Tooltip « Droits insuffisants » sur action désactivée (le cas échéant).

**UI/UX opérateur**
- Message `403` clair côté UI : « Action non autorisée ».
- Pas d'écran blanc : un viewer voit la liste en lecture, sans actions.

**Design / charte admin**
- Boutons désactivés en style sobre (pas de rouge), tooltip discret.

**Data**
- Aucune fuite : un `403` ne révèle pas l'existence/le contenu d'un coupon au-delà
  du nécessaire (mais `404` reste prioritaire si l'id n'existe pas — l'ordre :
  auth → permission → existence).

**Performance**
- `getAdminRole` : 1 requête courte (ou fallback). Pas de N+1.

**Accessibilité**
- Action désactivée a `aria-disabled` + libellé explicite ; le message `403`
  est annoncé (`role="alert"`).

**i18n**
- Messages de refus clés i18n (FR Phase 1).

**Observabilité / audit**
- Refus de mutation → `admin.coupon.permission_denied` journalisé (traçabilité
  des tentatives non autorisées).

---

## (d) Edge cases & matrice d'états (rôle × route × verbe)

| Rôle | GET liste/détail/stats | POST création | PATCH édition | POST status | DELETE archive |
|---|---|---|---|---|---|
| non authentifié | 401 / redirect login | 401 | 401 | 401 | 401 |
| viewer (read) | 200 | 403 | 403 | 403 | 403 |
| editor (read,write) | 200 | 200/201 | 200 | 200 | 403 |
| admin (read,write,publish) | 200 | 200/201 | 200 | 200 | 403 |
| superadmin (all) | 200 | 201 | 200 | 200 | 200 |

Autres cas :
| Cas | Attendu |
|---|---|
| viewer appelle POST directement (API, sans UI) | `403` ; aucun coupon créé ; audit `permission_denied` |
| editor appelle DELETE | `403` ; coupon non archivé ; audit `permission_denied` |
| 403 sur mutation | la mutation n'a PAS eu lieu (état inchangé), pas de `revalidateTag` |
| permission vérifiée avant Zod | body invalide + droit manquant → `403` (pas `422`) — la sécurité prime |
| schéma RBAC sans `coupons` pour superadmin | `rbacSchema` rejette (superRefine) |
| rôle inconnu / matrice absente | `hasPermission` → false → `403` |
| UI viewer | aucun bouton de mutation rendu/activé |

---

## (e) Risques

| ID | Risque | Impact | Mitigation testée |
|---|---|---|---|
| R-13-1 | Mutation exécutée puis `403` (ordre inversé) | Effet de bord avant refus | Permission AVANT mutation ; test « état inchangé » |
| R-13-2 | viewer peut muter via API directe | Élévation de privilège | C : viewer POST/PATCH/DELETE/status → 403 |
| R-13-3 | `coupons` oublié dans la matrice | Tous refusés ou tous permis | Tests matrice 4 rôles × actions + schéma superRefine |
| R-13-4 | UI masque mais serveur autorise | Faux sentiment de sécurité | Le serveur est l'autorité ; tests C indépendants de l'UI |
| R-13-5 | `403` révèle des infos sensibles | Fuite | Message générique ; ordre auth→perm→existence |
| R-13-6 | Refus non audité | Pas de traçabilité d'attaque | Audit `permission_denied` sur mutation |
| R-13-7 | Non authentifié atteint l'admin | Accès non autorisé | `requireAdmin` redirect ; API `401` |
| R-13-8 | admin obtient `delete` par erreur | Archivage non voulu | Matrice : delete = superadmin ; test admin DELETE → 403 |

---

## (f) Critères d'acceptation

- **AC-13-1** : `RBAC_RESOURCES` contient `'coupons'` ; `rbacResourceMatrix` a la
  clé `coupons` ; `rbacDefault.matrix` la définit pour superadmin/admin/editor/
  viewer.
- **AC-13-2** : `hasPermission('viewer','coupons','read') === true` et
  `hasPermission('viewer','coupons','write') === false`.
- **AC-13-3** : `hasPermission('editor','coupons','write') === true` et
  `hasPermission('editor','coupons','delete') === false`.
- **AC-13-4** : `hasPermission('superadmin','coupons', a) === true` pour `a` ∈
  {read,write,publish,delete} ; `rbacSchema` rejette une config superadmin sans
  une de ces actions sur `coupons`.
- **AC-13-5** : viewer → POST/PATCH/DELETE/status → `403` ; **aucune** mutation
  appliquée ; **aucun** `revalidateTag`.
- **AC-13-6** : editor → DELETE → `403` (pas de droit delete) ; coupon non archivé.
- **AC-13-7** : refus de mutation → audit `admin.coupon.permission_denied` avec
  `role` et `action` requise.
- **AC-13-8** : non authentifié → API `401` ; page → redirect
  `/admin/login?next=/admin/coupons`.
- **AC-13-9** : body invalide + droit manquant → `403` (la permission est vérifiée
  avant la validation Zod).
- **AC-13-10** : UI viewer → aucun bouton de mutation actif (Nouveau/Enregistrer/
  Activer/Archiver masqués ou `aria-disabled`).
- **AC-13-11** : E2E — un viewer ouvre `/admin/coupons`, voit la liste en lecture,
  sans aucune action de mutation cliquable.
