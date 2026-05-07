# Admin-Config — Plan d'action (Phases A → D)

> 4 phases livrables incrémentalement. Réf. [`README.md`](../README.md).

## Vue d'ensemble

| Phase | Thème               | Durée | Livrables |
|-------|---------------------|-------|-----------|
| A     | Foundation          | 2 j   | Migration, helper `getAppConfig()`, API GET/PATCH, page racine |
| B     | NAV + flags         | 2 j   | Editeur NAV (drag/drop), grille flags, hot-reload |
| C     | RBAC + branding     | 3 j   | Matrice RBAC, color picker, font picker |
| D     | Snapshots + audit   | 2 j   | Historique, restore, diff visuel |

Total ~9 j.

---

## Phase A — Foundation

### A.1 — Migration

- Fichier : `apps/web/drizzle/migrations/0009_admin_config.sql`
- Table : `app_config (section text PK, payload jsonb, updated_at, updated_by)`
- Table : `app_config_snapshots (id, section, captured_at, payload, actor_id, note)`

### A.2 — Helper `getAppConfig()`

- Fichier : `apps/web/src/lib/admin-config/resolve.ts`
- Cascade : `defaultConfig (TS) → DB row → validated → resolved`
- Wrappé `unstable_cache` avec tag `app-config`
- **Failsafe** : si Zod fail → log warn + return default

### A.3 — Defaults codés

- Fichier : `apps/web/src/lib/admin-config/defaults.ts`
- Sections : `nav`, `flags`, `rbac`, `branding`
- Chaque section a son schéma Zod + sa valeur défaut

### A.4 — API admin

- `GET   /api/admin/settings`              → toutes les sections résolues
- `GET   /api/admin/settings/[section]`    → une section
- `PATCH /api/admin/settings/[section]`    → update + snapshot + revalidate

### A.5 — Page racine

- `/admin/settings` (RSC) : 4 cartes (NAV, flags, RBAC, branding)
- Click → page section
- Sticky banner si une section diffère du défaut

### Critères Phase A

- [ ] Migration appliquée
- [ ] Sans ligne DB, `getAppConfig()` renvoie le défaut
- [ ] Avec ligne DB invalide, fallback sur défaut + warn loggué
- [ ] PATCH écrit + revalide

---

## Phase B — NAV + flags

### B.1 — Editeur NAV

- `/admin/settings/navigation` (RSC + form client)
- Liste réorganisable (drag & drop, `@dnd-kit/core`)
- Champs par item : `key`, `label`, `href`, `icon`, `requiresRole`
- Validation : pas de doublon `key`, `href` valide

### B.2 — Editeur flags

- `/admin/settings/flags`
- Grille de toggles, un par flag
- Filtre par environnement (`dev` / `prod`)
- Description + valeur défaut affichées

### B.3 — Hot-reload

- Après PATCH : `revalidateTag('app-config')`
- AdminShell relit la config au prochain render
- Test e2e : toggle un flag → la NAV change après refresh

### Critères Phase B

- [ ] Drag & drop fonctionnel + persiste l'ordre
- [ ] Toggle flag → effet immédiat après refresh
- [ ] Validation : `href` invalide → erreur inline
- [ ] Tests RTL pour les 2 éditeurs

---

## Phase C — RBAC + branding

### C.1 — Matrice RBAC

- `/admin/settings/rbac`
- Grille rôles × ressources × actions (read/write/publish/delete)
- Cases à cocher
- Validation : `superadmin` a tout par défaut, non éditable
- Garde-fou : impossible de retirer son propre `superadmin`

### C.2 — Editeur branding

- `/admin/settings/branding`
- Picker couleurs (avec preview)
- Sélecteur polices (whitelist : Inter, Cormorant, Manrope)
- Upload logo (réutilise MediaPicker)
- Preview live d'un bouton + d'un titre

### Critères Phase C

- [ ] Matrice RBAC sauvegarde + applique
- [ ] Branding : changer la couleur primaire → visible sur la page suivante
- [ ] Tests Playwright : modifier RBAC d'un rôle test → effet vérifié

---

## Phase D — Snapshots + audit

### D.1 — Snapshots

- À chaque PATCH → ligne dans `app_config_snapshots`
- Contient : section, payload, actor, note optionnelle

### D.2 — Historique

- Onglet **Historique** par section
- Liste paginée (50 derniers)
- Action **Voir le diff** + **Restaurer**

### D.3 — Diff visuel

- Composant `<ConfigDiff before={...} after={...} />`
- Highlights JSON ligne par ligne

### D.4 — Audit

- `logAuditEvent({ resource: 'app-config', action: 'update', section, diff })`

### Critères Phase D

- [ ] Snapshot créé à chaque PATCH
- [ ] Restore copie le payload sans le publier (re-PATCH explicite)
- [ ] Audit log cohérent (actor + diff)
- [ ] Test e2e : edit NAV → restore → vérif

---

## Sequencing & dépendances

```
A ──► B ──► D
└────► C ──┘
```

B et C indépendants après A. D nécessite tout (snapshot toutes sections).

## Hors scope (post-v1)

- Multi-tenant (un seul site FemiGlow)
- Configuration par environnement (dev / staging / prod) en DB
  (les flags `process.env` restent prioritaires)
- A/B testing de NAV
- Schedule (publier une config à T+24h)
