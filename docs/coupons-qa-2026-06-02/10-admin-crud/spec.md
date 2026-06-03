# CPN-10 — Admin CRUD coupons (opérateur)

> Périmètre : interface d'administration des coupons, **vue de l'opérateur**.
> Routes REST à créer sous `apps/web/src/app/api/admin/coupons/` :
> `GET|POST /api/admin/coupons` (liste + création),
> `GET|PATCH|DELETE /api/admin/coupons/[id]` (détail, édition, archivage/suppression).
> Pages à créer sous `apps/web/src/app/admin/coupons/` :
> `page.tsx` (liste), `new/page.tsx` (création), `[id]/page.tsx` (édition + stats).
> Le cycle de vie statut (`POST /[id]/status`) est traité en CPN-11 ; les stats
> (`GET /[id]/stats`) en CPN-12 ; le RBAC en CPN-13. Ce dossier couvre **les
> opérations CRUD et leur UI**.
> Criticité **P0** (porte d'entrée opérateur ; toute mutation déclenche
> `revalidateTag('coupons')` et `logAuditEvent`).

---

## (a) Fonctionnement optimal — parcours opérateur détaillé

### Liste (`/admin/coupons`)
1. L'opérateur ouvre `/admin/coupons`. La page est protégée par `requireAdmin()`
   (sinon redirection `/admin/login?next=/admin/coupons`).
2. Un tableau sobre (charte crème/encre/sauge) liste les coupons : colonnes
   **Libellé**, **Code** (ou « — » si auto), **Type**, **Statut** (badge),
   **Valeur** (ex. « -90 MAD » ou « -15 % »), **Usage** (`usageCount / usageCap`
   ou « illimité »), **Période** (`startsAt → endsAt`).
3. Barre d'outils : champ de recherche, **filtres** `status` (draft/active/paused/
   archived) et `type` (welcome_auto/rescue/email_unlock/manual_code/post_purchase),
   bouton **« Nouveau coupon »** (lien vers `/admin/coupons/new`).
4. **Pagination** serveur : `?page=&pageSize=` (défaut `pageSize=20`), compteur
   « N coupons » et navigation Précédent/Suivant.
5. État **vide** : message « Aucun coupon » + CTA « Créer le premier coupon ».
   État **vide après filtre** : « Aucun coupon ne correspond à ces filtres » +
   bouton « Réinitialiser les filtres ».

### Création (`/admin/coupons/new`)
1. Formulaire structuré : Libellé (requis), Type (select), Mode (`auto`/`code`),
   Code (affiché/requis **seulement** si `mode=code`), Nature de valeur
   (`fixed_amount`/`percent`), Montant, Cible (`product_price`/`shipping`/
   `future_credit`), Devise (MAD, en lecture seule Phase 1), Période
   (`startsAt`/`endsAt`), `stackable`, Portée d'usage (`unlimited`/
   `once_per_visitor`/`global_cap`), Plafond d'usage (`usageCap`, requis si
   `global_cap`), `holdoutPct`, `priorité`.
2. **Validation inline (client, miroir du Zod serveur)** au blur/submit :
   - `valueKind=percent` → `0 < valueAmount <= 100`.
   - `valueKind=fixed_amount` → `valueAmount > 0` ; **avertissement non bloquant**
     si `valueAmount >= prix produit` (« Le montant dépasse le prix : le panier
     sera plafonné à 0 »).
   - `mode=code` → code requis ; `mode=auto` → champ code masqué/interdit.
   - `endsAt > startsAt`.
3. À la soumission : `POST /api/admin/coupons`. Bouton **désactivé pendant
   l'envoi** (anti double-soumission), libellé « Enregistrement… ».
4. Succès `201` → **toast** « Coupon créé » → **redirection** vers
   `/admin/coupons/[id]` (mode édition).
5. Le coupon est créé en `status=draft` par défaut (pas d'effet `/kit` tant
   qu'il n'est pas activé — cf. CPN-11).

### Édition (`/admin/coupons/[id]`)
1. `GET /api/admin/coupons/[id]` préremplit le formulaire ; un champ caché
   `version` (entier) porte la version optimiste.
2. L'opérateur modifie puis enregistre → `PATCH /api/admin/coupons/[id]` avec
   `version`. Succès `200` → toast « Modifications enregistrées », `version`
   incrémentée dans la réponse et réinjectée dans le formulaire.
3. **Conflit de version** : si un autre opérateur a sauvegardé entre-temps, le
   serveur renvoie `409 version_conflict` → bannière « Ce coupon a été modifié
   par un autre utilisateur. Rechargez pour voir la dernière version. » + bouton
   « Recharger ». Aucune écriture silencieuse par-dessus.

### Archivage / suppression
1. Bouton **« Archiver »** (soft) : `DELETE /api/admin/coupons/[id]` avec
   confirmation modale (« Archiver ce coupon ? Il ne sera plus appliqué. »).
   Effet : `status=archived` (le coupon reste en base pour l'historique stats).
2. La **suppression dure** n'est pas exposée Phase 1 (intégrité des
   `coupon_events`). Le verbe `DELETE` réalise un **archivage** (soft delete).

---

## (b) Contrats I/O

### `GET /api/admin/coupons`
- Query : `page` (≥1, défaut 1), `pageSize` (1..100, défaut 20), `status`
  (enum), `type` (enum), `q` (recherche libellé/code).
- `200` :
  ```json
  { "items": [ { "id": "...", "label": "...", "code": null, "type": "welcome_auto",
                 "mode": "auto", "status": "active", "valueKind": "fixed_amount",
                 "valueAmount": 9000, "target": "product_price", "currency": "MAD",
                 "usageScope": "unlimited", "usageCap": null, "usageCount": 12,
                 "startsAt": "2026-06-01T00:00:00.000Z", "endsAt": null,
                 "holdoutPct": 10, "priority": 100, "version": 3 } ],
    "total": 1, "page": 1, "pageSize": 20 }
  ```
- `401` si non authentifié, `403` si rôle sans `read` (CPN-13).

### `POST /api/admin/coupons`
- Body : entité coupon sans `id`/`usageCount`/`version`/`status` (forcé `draft`).
- Validation Zod (échec → `422 invalid_input` + `{ error: { code, fieldErrors } }`).
- `201` : `{ id, ...coupon, status: "draft", version: 1 }`.
- `409 conflict` si `code` dupliqué (contrainte unique).
- Effet : `logAuditEvent({ action: 'admin.coupon.created', resourceType:
  'coupon', resourceId })` + `revalidateTag('coupons')`.

### `GET /api/admin/coupons/[id]`
- `200` : entité complète + `version`. `404 not_found` si inconnu/inexistant.

### `PATCH /api/admin/coupons/[id]`
- Body : champs modifiables + `version` (obligatoire).
- `200` : entité mise à jour, `version` incrémentée.
- `422` validation, `409 version_conflict` si `version` ≠ version courante,
  `409 conflict` si nouveau `code` dupliqué, `404` si inconnu.
- Effet : audit `admin.coupon.updated` + `revalidateTag('coupons')`.

### `DELETE /api/admin/coupons/[id]` (soft archive)
- `200` : `{ id, status: "archived" }`. `404` si inconnu. Idempotent si déjà
  archivé (renvoie `200`).
- Effet : audit `admin.coupon.archived` + `revalidateTag('coupons')`.

> **Note convention codebase** : `HttpError('invalid_input')` mappe HTTP **400**
> par défaut (`STATUS_BY_CODE`). Les routes coupons **doivent renvoyer 422** pour
> les échecs de validation Zod (exigence overview §test-strategy « Zod 422 »).
> L'implémentation ajoute donc un mapping 422 dédié à la validation (ne pas
> réutiliser tel quel le 400 legacy). Les tests asservissent **422** comme oracle.

---

## (c) Points de vérification par axe

**Backend**
- Routes montées sous `/api/admin/coupons` (`runtime=nodejs`, `dynamic=force-dynamic`).
- Validation Zod centralisée (un schéma `couponInputSchema` + `couponPatchSchema`).
- Unicité `code` (si présent) → `409`. `code` nullable autorisé.
- Pagination/filtres appliqués côté requête DB (pas de filtrage post-fetch coûteux).
- `version` géré côté repo (incrément atomique, compare-and-set).

**Frontend**
- Formulaire contrôlé, validation inline miroir du Zod, messages d'erreur sous
  chaque champ (`aria-describedby`).
- Champ `code` apparaît/disparaît selon `mode` (auto ↔ code).
- Bouton submit désactivé pendant la requête (anti double-clic).
- Liste : skeleton de chargement, états vide/peuplé/erreur distincts.

**UI/UX opérateur**
- Toasts de succès/erreur explicites (texte exact testé).
- Redirection post-création vers l'édition (continuité du parcours).
- Filtres persistés dans l'URL (rechargement conserve l'état).
- Modale de confirmation avant archivage.

**Design / charte admin**
- Crème/encre/sauge, pas de rouge retail, pas d'emoji, pas de countdown.
- Badges statut sobres (draft=neutre, active=sauge, paused=ambre doux,
  archived=gris).

**Data**
- `usageCount` jamais modifiable depuis l'UI CRUD (incrémenté par le moteur).
- `currency` figée MAD Phase 1.
- Montants en **centimes** (entiers) ; l'UI affiche en MAD (division /100).

**Sécurité / RBAC**
- Toute route vérifie session + permission AVANT mutation (détail CPN-13).
- Pas de fuite d'info entre coupons (404 pour id inconnu, pas 403 trompeur).

**Performance**
- Liste paginée (pas de chargement global). `pageSize` plafonné à 100.
- Pas de N+1 sur les compteurs d'usage.

**Accessibilité**
- Formulaire navigable au clavier ; chaque champ a un `<label>` associé.
- Erreurs annoncées (`role="alert"` / `aria-live="assertive"`).
- Modale piège le focus, fermable au clavier (Échap).

**i18n**
- Libellés FR Phase 1 ; montants formatés MAD (« 90 MAD », « 90,00 MAD »).
- Prévoir clés i18n (ar/RTL en backlog), pas de chaîne en dur non clé.

**Observabilité / audit**
- Une mutation = un `logAuditEvent` (created/updated/archived) avec `actorId`,
  `resourceId`, `meta` minimal (pas de PII).
- `revalidateTag('coupons')` appelé à chaque mutation réussie.

---

## (d) Edge cases & matrice d'états

| Catégorie | Cas | Attendu UI/API |
|---|---|---|
| Nominal | Création valide | `201` → toast « Coupon créé » → redirect `/admin/coupons/[id]` |
| Nominal | Édition valide | `200` → toast « Modifications enregistrées », version+1 |
| Vide | Liste sans coupon | « Aucun coupon » + CTA création |
| Vide | Liste filtrée sans résultat | « Aucun coupon ne correspond » + reset |
| Limite | `valueAmount=100` (percent) | accepté |
| Limite | `valueAmount = prix` (fixed) | accepté + avertissement non bloquant |
| Limite | `pageSize=100` | accepté ; `101` → clampé/422 |
| Invalide | `percent` & `valueAmount=0` ou `>100` | erreur inline + `422`, pas d'envoi si bloqué client |
| Invalide | `fixed_amount` & `valueAmount<=0` | erreur inline + `422` |
| Invalide | `mode=code` sans code | erreur inline « Code requis » + `422` |
| Invalide | `mode=auto` avec code saisi | champ masqué ; serveur ignore/422 si forcé |
| Invalide | `endsAt <= startsAt` | erreur inline « La fin doit suivre le début » + `422` |
| Invalide | `code` dupliqué | `409 conflict` → erreur sous champ code « Code déjà utilisé » |
| Erreur réseau | `422` serveur (client n'a pas attrapé) | toast erreur + erreurs inline reconstruites depuis `fieldErrors` |
| Erreur réseau | `403` (lecture seule tente POST) | toast « Action non autorisée », bouton réactivé |
| Erreur réseau | `409 version_conflict` (édition) | bannière conflit + « Recharger », pas d'écrasement |
| Erreur réseau | `500` | toast « Une erreur est survenue », formulaire conservé |
| Latence | Réponse lente (spinner) | bouton « Enregistrement… » désactivé, spinner liste |
| Timeout | Pas de réponse | toast « Délai dépassé, réessayez », bouton réactivé |
| Concurrence | 2 onglets éditent | le 2e PATCH → `409 version_conflict` |
| Double-clic | Clic submit ×2 rapide | 1 seule requête (bouton désactivé immédiatement) |
| Cache | Après création | `revalidateTag('coupons')` ; liste rafraîchie au retour |

---

## (e) Risques

| ID | Risque | Impact | Mitigation testée |
|---|---|---|---|
| R-10-1 | Double soumission → doublon de coupon | Données dupliquées | Bouton désactivé pendant l'envoi (E + I) |
| R-10-2 | Écrasement concurrent silencieux | Perte de modif | `version` + `409` + bannière conflit |
| R-10-3 | Validation client ≠ serveur | Bypass via API | Schéma Zod unique ; tests C asservissent `422` |
| R-10-4 | Code dupliqué accepté | Coupon ambigu | Contrainte unique → `409` + erreur inline |
| R-10-5 | Suppression dure casse les stats | Perte d'historique | `DELETE` = soft archive uniquement |
| R-10-6 | Mutation sans audit / sans revalidate | Traçabilité / cache obsolète | Audit + `revalidateTag` testés par mutation |
| R-10-7 | Montant MAD vs centimes confondu | Prix faux | Centimes en base, conversion testée |
| R-10-8 | Champ code visible en mode auto | Saisie incohérente | Affichage conditionnel + refus serveur |

---

## (f) Critères d'acceptation

- **AC-10-1** : créer un coupon valide → `201`, toast « Coupon créé », redirection
  `/admin/coupons/[id]`, `status=draft`, audit `admin.coupon.created` présent.
- **AC-10-2** : POST avec `percent`/`valueAmount=120` → `422`, message « Le
  pourcentage doit être entre 1 et 100 » ; aucun coupon créé.
- **AC-10-3** : POST avec `mode=code` sans `code` → `422`, message « Code requis ».
- **AC-10-4** : POST avec `endsAt <= startsAt` → `422`, message « La fin doit
  suivre le début ».
- **AC-10-5** : POST avec `code` existant → `409`, erreur sous le champ code.
- **AC-10-6** : double-clic sur « Enregistrer » → une seule requête réseau.
- **AC-10-7** : édition concurrente (version stale) → `409 version_conflict`,
  bannière conflit, aucune écriture.
- **AC-10-8** : liste vide → message « Aucun coupon » + CTA création.
- **AC-10-9** : filtre `status=active` → seuls les coupons actifs listés ; URL
  porte `?status=active`.
- **AC-10-10** : `DELETE` → `status=archived`, coupon conservé, audit
  `admin.coupon.archived`, idempotent.
- **AC-10-11** : `500` à la création → toast « Une erreur est survenue »,
  données du formulaire conservées, bouton réactivé.
