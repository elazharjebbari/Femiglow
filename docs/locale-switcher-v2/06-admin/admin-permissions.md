# Admin Permissions, Audit & Guard-rails — Locale Switcher V2

> **Source de vérité** : [`../CONTRACT.md`](../CONTRACT.md) §3 (« écriture admin-only + audit »), §6 (INV-12).
> **Précédents projet à mirrorer** :
> - RBAC : `apps/web/src/lib/admin-config/types.ts` (`RbacAction = 'read'|'write'|'publish'|'delete'`, `RbacResource` inclut `'app-config'`), `RbacMatrix` par rôle.
> - Auth : `apps/web/src/lib/auth/require-admin.ts` (`getAdminSession`/`requireAdmin`).
> - Audit : `apps/web/src/lib/audit/log-event.ts` (`logAuditEvent` → table `audit_events`), `app_config_snapshots` (before/after).
> - Write path : `apps/web/src/app/api/admin/settings/[section]/route.ts`.

---

## 1. Rôles & permissions requises

La config i18n est traitée comme une ressource d'**admin-config** : on réutilise la `RbacResource` existante `'app-config'` (pas de nouvelle resource sauf si l'équipe veut isoler — alors `'i18n'`, à ajouter à `RbacResource` + matrice).

| Action | Permission requise (resource `app-config`) | Endpoint / surface |
|---|---|---|
| Voir `/admin/i18n` + `GET /api/admin/i18n/config` | `read` | page + GET admin |
| Publier une modif (`PUT`) | `write` | PUT admin |
| Lire la config publique | *aucune* (no-auth, cachée) | `GET /api/i18n/config` |

- **Lecture publique** : `GET /api/i18n/config` **n'exige aucune authentification** (CONTRACT §3) — la config est publique par conception (elle pilote le chrome public). Elle n'expose **pas** `updated_by` (PII acteur) — uniquement `version`/`updatedAt`/`isDefault`.
- **Écriture** : strictement `write` sur `app-config`. `getAdminSession()` ⇒ 401 si absent ; RBAC ⇒ 403 si refusé.
- Le rôle exact (editor/admin/superadmin) dépend de la `RbacMatrix` en DB ; par défaut on aligne sur les autres sections de `app_config` (typiquement `admin`/`superadmin` ont `write` sur `app-config`, `editor` a `read`).

---

## 2. Audit logging (who / when / before-after)

Deux écritures complémentaires à **chaque** PUT accepté (mirror settings route + `app_config_snapshots`) :

### 2.1 `audit_events` (qui / quand / quoi)
```ts
logAuditEvent({
  action: 'i18n-config.update',
  actorId: session.adminId,            // QUI
  resourceType: 'i18n_locale_config',
  resourceId: 'singleton',
  meta: {
    version: result.row.version,        // version résultante
    snapshotId: result.snapshot.id,     // pointeur vers le before/after
    note,                               // commentaire admin
    changed: ['locales[1].enabled', 'defaultLocale'], // diff de champs (optionnel mais recommandé)
  },
});
// createdAt = QUAND (auto)
```

### 2.2 `i18n_locale_config_snapshots` (before / after)
- À chaque écriture acceptée : insertion d'un snapshot `{ payload (après), version, actor_id, note, captured_at }`.
- Le **before** est le snapshot précédent (chaîne) ; l'API peut aussi inclure `before/after` dans `audit_events.meta` pour un diff direct.
- Permet **rollback** (réappliquer un ancien `payload` via un nouveau PUT) et la **timeline** dans l'admin.

> **Invariant audit** : aucune mutation de config n'est silencieuse. Tout PUT accepté ⇒ 1 audit + 1 snapshot. Tout PUT rejeté (401/403/409/422) ⇒ **0** audit, **0** snapshot, **0** mutation.

---

## 3. Garde-fous (guard-rails)

| Garde-fou | Mécanisme | Statut sur violation |
|---|---|---|
| **Ne pas désactiver la locale par défaut** | V-DEFAULT-ENABLED (schéma) + toggle grisé en UI | 422 `validation_failed` (rule V-DEFAULT-ENABLED) |
| **Ne pas tout désactiver** | V-AT-LEAST-ONE-ENABLED | 422 |
| **Exactement une locale par défaut** | V-DEFAULT-ONE + `.strict()` | 422 |
| **`ar` toujours `rtl`** | V-AR-RTL | 422 |
| **Endonyme non-vide** | V-ENDONYM | 422 |
| **Anti-injection de clés** | `.strict()` (additionalProperties:false) | 422 |
| **Édition concurrente** | `If-Match` + `version` (optimistic lock) | 409 `version_conflict` + `currentVersion` |
| **Changement destructif (désactiver une locale active, changer le défaut, reset to defaults)** | **Confirmation explicite** en UI (modale « Confirmer : la locale AR ne sera plus servie au public ») avant le PUT | bloqué côté UI tant que non confirmé |
| **Bypass API direct** | Le serveur revalide TOUTES les règles Zod indépendamment de l'UI | la validation serveur fait foi |

> Les garde-fous « métier » (désactiver default, tout désactiver) sont **doublés** : UX (toggle grisé / confirmation) **et** schéma serveur (422). Le serveur est l'autorité — un client malveillant ne peut pas contourner.

---

## 4. Stance INV-12 vis-à-vis de l'écriture

Si une écriture **passe** la validation, elle est forcément valide → la DB ne contient jamais (par cette voie) un payload invalide. INV-12 (fallback defaults) protège contre les **corruptions hors-app** (migration ratée, édition SQL manuelle, schemaVersion incompatible) : le read path retombe alors sur les defaults. L'admin reste utilisable car `getAdminLocaleConfig()` peut aussi servir les defaults avec `isDefault:true` (l'admin voit alors un bandeau « config par défaut — DB invalide, republier pour corriger »).

---

## 5. Éléments à VÉRIFIER / TESTER

### Authz
- [ ] `read` requis pour GET admin + page ; `write` requis pour PUT.
- [ ] Public GET ne demande **aucune** permission (200 anonyme).
- [ ] Public GET n'expose pas `updated_by` (PII acteur).
- [ ] 401 (pas de session) et 403 (RBAC) ⇒ aucune mutation/audit/snapshot.

### Audit
- [ ] PUT accepté ⇒ exactement 1 `audit_events` (action `i18n-config.update`, actorId, version, snapshotId) + 1 snapshot.
- [ ] `before/after` reconstituables (chaîne de snapshots ou meta diff).
- [ ] Aucune entrée audit/snapshot sur PUT rejeté.
- [ ] FK acteur `ON DELETE SET NULL` : supprimer l'admin ne casse pas l'historique d'audit.

### Garde-fous
- [ ] Désactiver le default via API ⇒ 422 (V-DEFAULT-ENABLED), même en bypassant l'UI.
- [ ] Tout désactiver ⇒ 422 (V-AT-LEAST-ONE-ENABLED).
- [ ] `ar` ltr ⇒ 422 (V-AR-RTL) ; endonyme vide ⇒ 422 (V-ENDONYM) ; clé inconnue ⇒ 422 (`.strict()`).
- [ ] Édition concurrente ⇒ 409 + `currentVersion`, pas de lost update.
- [ ] Changement destructif sans confirmation UI ⇒ PUT non envoyé.

### Modes de défaillance
- [ ] DB corrompue hors-app ⇒ read path sert defaults (INV-12) ; admin affiche le bandeau « config par défaut » ; republier corrige.
- [ ] Aucune fuite : la config publique ne révèle ni acteur ni note d'audit.
