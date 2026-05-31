# Form-Config Admin Integration — Plan d'action

> **Statut** : Plan v1 · `2026-05-12`  
> **Ticket** : CHA-230 (suite) — surfacer la config wizard dans l'admin  
> **Auteur** : équipe FemiGlow  
> **Cf. runbook** : [41-form-config-admin-runbook.md](./41-form-config-admin-runbook.md)

---

## 1. Constat

Le feature **form-config** (CHA-230) est complet côté backend mais **invisible côté admin** :

| Couche | État |
|---|---|
| DB (`form_config` + `form_config_history`) | ✅ Migration `0018_form_config.sql` |
| Schema Zod strict (`form-config/schema.ts`) | ✅ |
| Repo (`form-config-repo.ts` : `getByKey`, `update`, `rollback`, `listHistory`) | ✅ |
| API publique `GET /api/checkout/form-config/[key]` | ✅ |
| API admin (PATCH / history / rollback) | ❌ |
| UI admin (page, éditeur, historique) | ❌ |
| Lien de navigation (`AdminShell`, `/admin/settings`) | ❌ |
| Seed initial (`wizard_kit`, `wizard_commander`) | ⚠️ à vérifier |

Conséquence : un opérateur ne peut **ni voir ni modifier** les wizards (copy, validation, paymentMethods…) sans intervention SQL directe.

---

## 2. Objectifs

1. **Rendre form-config accessible depuis `/admin/settings`** avec une carte dédiée.
2. **Éditeur structuré** (pas du raw JSON) qui respecte le schema Zod strict :
   - **Steps** (drag-reorder ou checklist ordonnée, REQUIRED_STEPS verrouillés)
   - **Modes** (multi-select `wizard_embed`, `wizard_cart`, `wizard_form_only`)
   - **Defaults** (formMode, currency, country, paymentMethods, defaultShippingMode)
   - **Copy** (title + CTAs + thank-you, max-length visualisée)
   - **Validation** (phone min/max, require_email, require_postal)
3. **Historique + rollback** depuis l'UI (mirror du pattern `SectionEditorShell` admin-config).
4. **Auth + audit** : toute mutation tracée via `logAuditEvent` (`form-config.update`, `form-config.rollback`).
5. **Optimistic locking** : `If-Match: <version>` header — 409 en cas de version stale.
6. **A11y** : axe-core 0 violation serious, navigation clavier, ARIA labels.
7. **Tests** : Vitest unit + Playwright E2E avec pre-seeded admin session.

---

## 3. Décisions UX

### 3.1 Emplacement dans la navigation

| Option | Pour | Contre | Décision |
|---|---|---|---|
| **A. `/admin/settings/form-config`** | Cohérent avec rbac/flags/branding/delivery-cities | Settings devient dense (6 cartes) | ✅ **Retenu** |
| B. Top-level `/admin/forms` dans AdminShell | Plus discoverable | Crée un nouveau silo | rejeté |
| C. Sous `/admin/checkout/*` (nouveau silo) | Groupe livraison + form + paiement | Réorganisation lourde | différé v2 |

**Rationale** : on garde la mental-model "Réglages = configuration centralisée". Une réorga `/admin/checkout/*` est envisageable v2 si on ajoute plus de modules (payment-config, shipping-config).

### 3.2 Liste vs détail

- `/admin/settings/form-config` → **liste** des wizards (cartes `wizard_kit` + `wizard_commander`), avec badge actif/inactif, version, dernière modif.
- `/admin/settings/form-config/[key]` → **détail** avec onglets `Édition | Historique` (mirror `SectionEditorShell`).

### 3.3 Structure de l'éditeur (form, pas JSON brut)

Sections collapsées par défaut (sauf "Copy"), chacune une `<fieldset>` :

1. **Steps & modes** — checkboxes ordonnées, badge "requis" sur les 4 obligatoires.
2. **Defaults** — selects pour formMode/currency/country/defaultShippingMode + multi-checkboxes pour paymentMethods (min 1, max 3).
3. **Copy** — textarea avec compteur de chars (color rouge si > maxLength).
4. **Validation** — number inputs (phone), checkboxes (require_email, require_postal).

**Pas de JSON editor en v1.** Un toggle `[Vue avancée]` peut afficher un read-only diff pour debug — pas d'édition libre (risque de casser le schema strict).

### 3.4 Microcopy

- Titre page : « Configuration des formulaires »
- Description : « Édite la config des wizards de commande (steps, copy, validation). Chaque sauvegarde est versionnée. »
- Card badge : `Actif vN` (emerald) | `Inactif` (stone)
- Save CTA : « Enregistrer la version vN+1 »
- 409 toast : « Une autre modif est arrivée. Recharge pour voir la version courante. »

### 3.5 Design tokens (réutilise admin existant)

| Token | Valeur |
|---|---|
| Bg page | `bg-stone-50` |
| Bg card | `bg-white` + `border-stone-200` |
| Accent active | `bg-stone-900 text-white` |
| Success | `border-emerald-300 bg-emerald-50 text-emerald-800` |
| Warn | `border-amber-300 bg-amber-50 text-amber-800` |
| Error | `border-red-300 bg-red-50 text-red-800` |
| Mono key | `font-mono text-sm` |

---

## 4. Architecture

### 4.1 Endpoints API admin (nouveaux)

| Route | Méthode | Auth | Action |
|---|---|---|---|
| `/api/admin/form-config` | GET | requireAdmin | Liste les configs (kit, commander) |
| `/api/admin/form-config/[key]` | GET | requireAdmin | Détail config courante |
| `/api/admin/form-config/[key]` | PATCH | requireAdmin + `If-Match` | Update + audit + revalidate |
| `/api/admin/form-config/[key]/history` | GET | requireAdmin | Liste des versions (limit 50) |
| `/api/admin/form-config/[key]/rollback` | POST | requireAdmin + `If-Match` | Rollback à `targetVersion` |

Toutes en `runtime = 'nodejs'` + `dynamic = 'force-dynamic'` (pas de cache admin).

### 4.2 Pages admin (nouvelles)

| Route | Type | Détails |
|---|---|---|
| `/admin/settings/form-config` | server component | List forms (kit, commander). Boutons "Éditer". |
| `/admin/settings/form-config/[key]` | server component | Render `<FormConfigEditor initialConfig={…} meta={…} />` |

Active state AdminShell : `settings` (sub-page de settings).

### 4.3 Composants client (nouveaux)

| Fichier | Rôle |
|---|---|
| `components/admin/settings/FormConfigCard.tsx` | Card sur `/admin/settings` (clé, version, actif, last modif) |
| `components/admin/settings/FormConfigEditor.tsx` | Form structuré, fieldsets, dirty state, PATCH save |
| `components/admin/settings/FormConfigEditorShell.tsx` | Mirror `SectionEditorShell` (sticky header, save bar, error/success banners, tabs édition/historique) |
| `components/admin/settings/FormConfigHistory.tsx` | Table des versions, ConfigDiff inline, bouton rollback |

### 4.4 Cache invalidation

- Public route `GET /api/checkout/form-config/[key]` a `revalidate = 60`. Après PATCH admin, on `revalidateTag('form-config:' + key)` (nouveau tag à ajouter au repo).

### 4.5 Seed initial

Vérifier que `wizard_kit` + `wizard_commander` existent en DB (sinon la liste admin sera vide). Si absents, ajouter au seed-on-boot ou créer une migration `0024_seed_form_config_defaults.sql` avec deux INSERTs idempotents (`ON CONFLICT (key) DO NOTHING`).

---

## 5. Stratégie de tests

### 5.1 Vitest (unit/integration)

| Test | Cible |
|---|---|
| `FormConfigEditor.test.tsx` | render, dirty toggle, validation client-side, PATCH mock |
| `FormConfigCard.test.tsx` | rendu actif/inactif, last-modif format |
| `form-config-repo.test.ts` (extend) | update increment version + history insert |
| API routes `*.route.test.ts` | 401 sans session, 422 schema fail, 409 If-Match stale, 200 happy path, audit log appelé |

### 5.2 Playwright E2E

`apps/web/e2e/admin-form-config.spec.ts` :

1. Login admin (pre-seeded via `e2e/auth.setup.ts`).
2. Navigate `/admin/settings` → vérifier la card "Form Config" présente.
3. Click card → arrive sur `/admin/settings/form-config`.
4. Click `Éditer wizard_kit` → arrive sur le détail.
5. Modifier `copy.title` → save → vérifier toast success.
6. Recharger → modification persistée.
7. Onglet "Historique" → voir la version précédente → rollback → vérifier valeur restaurée.
8. axe-core scan : 0 violation serious sur les 2 pages.

### 5.3 MSW (composants client)

`FormConfigEditor.test.tsx` utilise `vi.fn()` pour mocker fetch (pas besoin de MSW puisque les tests sont locaux). Pour cohérence avec le projet, on n'introduit pas MSW ici (les autres editors n'en utilisent pas).

---

## 6. Découpage en phases (cf. runbook)

1. **P1 — Backend API** : 4 routes admin + revalidation tag.
2. **P2 — Composants UI** : Card, Editor, EditorShell, History.
3. **P3 — Pages admin** : list + detail.
4. **P4 — Intégration `/admin/settings`** : SectionCard.
5. **P5 — Seed** : vérifier puis créer `0024_seed_form_config_defaults.sql` si vide.
6. **P6 — Tests** : Vitest + Playwright + axe.
7. **P7 — Régression** : full chat + checkout tests, prod build.
8. **P8 — Prod feed preview** : `pnpm build && pnpm start`, lister URLs.

---

## 7. Definition of Done

- [ ] Card "Form Config" visible sur `/admin/settings`
- [ ] Liste `wizard_kit` + `wizard_commander` sur `/admin/settings/form-config`
- [ ] Éditeur structuré fonctionnel (save → DB → audit log)
- [ ] Onglet Historique avec rollback
- [ ] `If-Match` actif (409 en cas de stale)
- [ ] Audit log `form-config.update` et `form-config.rollback`
- [ ] Cache public invalidé après save
- [ ] 4 routes API testées (Vitest)
- [ ] 1 spec Playwright passe en local + cross-browser opt-in
- [ ] axe-core 0 violation serious
- [ ] Typecheck + lint OK
- [ ] Régression : 0 test cassé

---

## 8. Risques & atténuation

| Risque | Atténuation |
|---|---|
| Modifier la config casse le wizard prod | Schema Zod strict en frontend + backend ; rollback 1-clic ; audit immuable. |
| Conflit avec `revalidate = 60` cache | Tag explicite `form-config:<key>` + `revalidateTag` après PATCH. |
| Pas de seed initial → page vide | P5 ajoute migration idempotente seed. |
| `SectionEditorShell` couplé à admin-config | On crée `FormConfigEditorShell` parallèle (DRY visuel, schema dédié). |
| Régression chat (CHA-230 v6) | Smoke chat-relevant Vitest en P7. |

---

## 9. Hors scope (v2)

- Réorganisation `/admin/checkout/*` (form-config + delivery-cities + payment-config sous une racine).
- A/B testing form-variant (table `form_variant_assignment` existe en `0020_form_variant_assignment.sql` mais l'UI variant assignment est différée).
- Import/export config JSON.
- Multi-tenant / multi-locale config.
