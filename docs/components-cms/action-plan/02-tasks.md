# P2 — Décomposition en tâches

> ~60 tâches groupées par phase (P1–P12).
>
> Codes effort : **XS** = 1 h, **S** = 4 h, **M** = 1 j, **L** = 3 j, **XL** = 1 sem.
> Codes rôle : **BE** = backend, **FE** = frontend, **FS** = full-stack, **DSG** = design.

## P1 — Schéma + types + migrations

| ID | Tâche | Effort | Rôle | Dépend | Critère d'acceptance |
|----|-------|--------|------|--------|----------------------|
| T1.1 | Étendre `schema.ts` : enums `field_binding_status`, `field_history_action` | XS | BE | — | Drizzle `pnpm tsc` ✅, enums utilisables dans tables |
| T1.2 | Table `component_field_bindings` + 4 index | S | BE | T1.1 | `\d` montre les colonnes A2 + index `cfb_publish_uniq` etc. |
| T1.3 | Table `component_field_history` | S | BE | T1.1 | Colonnes A2 présentes, FK CASCADE vers bindings |
| T1.4 | Colonne `fields jsonb DEFAULT '[]'` sur `site_components` | XS | BE | — | Migration shippe sans data loss |
| T1.5 | Types TS `ComponentFieldDefinition`, `FieldType`, `FieldTypeConfig` | S | BE | — | Types exportés depuis `@/lib/db/types` |
| T1.6 | Étendre `TrackingResource` enum d'audit avec `'component_field_binding'` | XS | BE | — | Audit log accepte la resource |
| T1.7 | Migration Drizzle `0006_components_cms.sql` revue manuellement | XS | BE | T1.2-T1.4 | SQL inspecté + appliqué en local |
| T1.8 | Tests Vitest : forme du registre, validité des `defaultValue` | S | BE | T1.5 | 1 test par type de field |

## P2 — Seed-pipeline

| ID | Tâche | Effort | Rôle | Dépend | Critère |
|----|-------|--------|------|--------|---------|
| T2.1 | Étendre `seed-pipeline.ts` : phase `fields` après `images` | M | BE | P1 | Pipeline parcourt registry.fields |
| T2.2 | Logique upsert : `published` v1 si pas de binding, sinon skip | S | BE | T2.1 | Idempotence vérifiée par test |
| T2.3 | Logique reconcile : archive bindings orphelins | S | BE | T2.1 | Test : ajout puis retrait d'un field → binding archived |
| T2.4 | Script CLI `seed:components-fields` (pnpm script) | XS | BE | T2.1 | `pnpm seed:components-fields --dry-run` affiche le plan |
| T2.5 | Script CLI `seed:components-fields:reconcile` | XS | BE | T2.3 | Mode `--dry-run` + run |
| T2.6 | Script `scripts/check-field-bindings-count.ts` | XS | BE | T2.1 | Affiche OK/diff |
| T2.7 | Script `scripts/diagnose-field-drift.ts` | S | BE | T2.3 | Liste orphelins + manquants |
| T2.8 | Tests fs-mocked du pipeline | M | BE | T2.1 | Coverage ≥ 90 % |

## P3 — Cascade resolver + cache + RSC helper

| ID | Tâche | Effort | Rôle | Dépend | Critère |
|----|-------|--------|------|--------|---------|
| T3.1 | Module `field-resolver.ts` : `resolveComponentField` | S | BE | P1 | Cascade A3 implémentée |
| T3.2 | `resolveComponentFields` (pluriel) cached | S | BE | T3.1 | 1 SELECT par composant |
| T3.3 | Wrapper `unstable_cache` avec tag composé | S | BE | T3.2 | Tag = `components:fields:<key>:<locale>` |
| T3.4 | `decodeValue` / `encodeValue` par type | S | BE | P1 | Encodage A2 respecté |
| T3.5 | `<ComponentField>` RSC (children render-prop) | M | FS | T3.2 | Pilote `Header.tsx` migré |
| T3.6 | `diagnoseComponentFields` (utilitaire dev) | XS | BE | T3.2 | Endpoint dev tools |
| T3.7 | Tests EC1–EC8 (8 edge cases A3) | M | BE | T3.1 | Tous les EC verts |
| T3.8 | Bench micro : cache hit / miss | XS | BE | T3.3 | Mesure < 1 ms / < 30 ms |

## P4 — Validators + sanitizers

| ID | Tâche | Effort | Rôle | Dépend | Critère |
|----|-------|--------|------|--------|---------|
| T4.1 | Schémas Zod : `text`, `multiline`, `rich-text` | S | BE | P1 | Tests minLength/maxLength |
| T4.2 | Schémas Zod : `cta`, `link`, `icon`, `color-token` | S | BE | P1 | href validé via allowlist |
| T4.3 | Schémas Zod : `number`, `boolean`, `enum` | XS | BE | P1 | Bornes min/max respectées |
| T4.4 | Schémas Zod : `list`, `record` (récursifs) | S | BE | T4.1-T4.3 | minItems/maxItems testés |
| T4.5 | Schémas Zod : `kicker`, `quote`, `breadcrumb-segment` | S | BE | T4.1 | Cohérence avec types primitifs |
| T4.6 | Sanitizer rich-text DOMPurify côté serveur | M | BE | T4.1 | Allowlist A6 appliquée |
| T4.7 | Corpus XSS (15+ vecteurs) en test | S | BE | T4.6 | Tous les vecteurs neutralisés |
| T4.8 | Validation `href` : relatif, mailto, tel, https + allowlist | S | BE | T4.2 | Open-redirect bloqué |
| T4.9 | Traduction française des messages d'erreur Zod | XS | BE | T4.1-T4.5 | `zod-i18n-map` ou map custom |

## P5 — API REST + MSW

| ID | Tâche | Effort | Rôle | Dépend | Critère |
|----|-------|--------|------|--------|---------|
| T5.1 | `GET /fields` : liste fields + status par fieldKey | S | BE | P3, P4 | Renvoie published + draft cohabitants |
| T5.2 | `PATCH /fields/[fieldKey]` : auto-save draft | M | BE | T5.1 | Crée ou met à jour la ligne `draft` |
| T5.3 | `POST /fields/[fieldKey]/publish` : transaction atomique | M | BE | T5.2 | Archive ancien published, promote draft, history × 2 |
| T5.4 | `POST /fields/[fieldKey]/schedule` | S | BE | T5.2 | Refus si scheduledAt < now+60s |
| T5.5 | `POST /fields/[fieldKey]/cancel-schedule` | XS | BE | T5.4 | Repasse en draft, NULL scheduledAt |
| T5.6 | `POST /fields/[fieldKey]/restore` | S | BE | T5.2 | Crée un draft depuis un history snapshot |
| T5.7 | `GET /fields/[fieldKey]/history` paginé | S | BE | P1 | Renvoie versions ordonnées asc |
| T5.8 | `POST /admin/cache/revalidate` (revalidateTag) | XS | BE | — | Auth + tag whitelist |
| T5.9 | If-Match handling 409 sur PATCH | S | BE | T5.2 | Test conflit |
| T5.10 | Rate-limit 60 req/min par user | S | BE | — | Test `429 Too Many Requests` |
| T5.11 | MSW handlers pour toutes les routes | M | FE | T5.1-T5.7 | Storybook / RTL utilisable offline |
| T5.12 | Tests cross-validation MSW ↔ vraie API (smoke) | S | BE+FE | T5.11 | Suite shared schema |
| T5.13 | Audit log écriture sur chaque mutation | S | BE | A6 | Event correct dans `adminAuditLog` |

## P6 — Editor registry

| ID | Tâche | Effort | Rôle | Dépend | Critère |
|----|-------|--------|------|--------|---------|
| T6.1 | `TextEditor` + tests RTL | S | FE | P4 | Compteur de caractères, badge limite |
| T6.2 | `MultilineEditor` | S | FE | P4 | textarea auto-grow |
| T6.3 | `RichTextEditor` (markdown-it preview) | M | FE | P4 | Preview live, toolbar minimale |
| T6.4 | `CtaEditor` (label + href + variant + icon optional) | M | FE | P4, T6.5 | href validé en temps réel |
| T6.5 | `LinkEditor` | S | FE | P4 | Affiche warn si externe |
| T6.6 | `IconEditor` (picker depuis registry icons) | M | FE | P4 | Search + preview SVG |
| T6.7 | `ColorTokenEditor` (chips colorées) | S | DSG+FE | D4 | Cohérent charte |
| T6.8 | `NumberEditor`, `BooleanEditor`, `EnumEditor` | S | FE | P4 | Standard inputs |
| T6.9 | `ListEditor` (ajout/retrait/reorder via drag-handle) | L | FE | T6.1-T6.8 | minItems/maxItems respectés |
| T6.10 | `RecordEditor` (sous-formulaire) | M | FE | T6.1-T6.8 | Récursivité OK |
| T6.11 | `KickerEditor`, `QuoteEditor`, `BreadcrumbSegmentEditor` | S | FE | T6.1, T6.5 | Variations stylées |
| T6.12 | Registry `editorByType` + lookup robuste | XS | FE | T6.1-T6.11 | Fallback sur `TextEditor` si type inconnu (warn) |
| T6.13 | Audit a11y axe-core par éditeur | S | FE | T6.12 | 0 violation A/AA |

## P7 — Form engine

| ID | Tâche | Effort | Rôle | Dépend | Critère |
|----|-------|--------|------|--------|---------|
| T7.1 | Hook `useFieldForm(componentKey)` (useReducer) | M | FE | P5 | Actions typées |
| T7.2 | Auto-save debounced 800 ms | S | FE | T7.1 | Test avec timer fakes |
| T7.3 | Retry exponentiel 3x sur réseau | S | FE | T7.2 | Test mock fetch fail |
| T7.4 | Détection 409 + modal merge / reload | M | FE | T7.1, T5.9 | Modal RTL testée |
| T7.5 | Détection 422 + bannière sanitization | S | FE | T7.1 | Affiche le diff sanitize |
| T7.6 | Indicateurs `dirty`/`saving`/`saved` | S | FE | T7.1 | Badge par champ |
| T7.7 | Reset propre au changement de composant | S | FE | T7.1 | Pas de fuite state |

## P8 — Admin Fields panel UI

| ID | Tâche | Effort | Rôle | Dépend | Critère |
|----|-------|--------|------|--------|---------|
| T8.1 | `ComponentFieldsPanel` shell | S | FE | P7 | Tabs/accordéons par `group` |
| T8.2 | Intégration dans `app/admin/components/[key]/page.tsx` | S | FE | T8.1 | Coexiste avec MediaPanel et AnimationPanel |
| T8.3 | Bouton publier/programmer/historique global | S | FE | T8.1 | Workflow complet |
| T8.4 | Badge statut par champ | XS | FE | T8.1 | draft / published / scheduled |
| T8.5 | Mini-diff vs publié (par champ) | M | FE | T8.1 | Pour text/multiline/rich-text |
| T8.6 | Skeleton + empty state | XS | FE | T8.1 | Pas de FOUC au chargement |
| T8.7 | Tests RTL panneau intégration | M | FE | T8.1-T8.5 | Coverage panneau ≥ 85 % |
| T8.8 | Design review + ajustements | S | DSG | T8.1-T8.5 | Validation maquette |

## P9 — Live preview iframe

| ID | Tâche | Effort | Rôle | Dépend | Critère |
|----|-------|--------|------|--------|---------|
| T9.1 | Route `/admin/components/[key]/preview?draft=1` | S | BE | P3 | Sécurisée par auth |
| T9.2 | `resolveComponentFieldsDraft` (drafts au lieu de published) | S | BE | T3.2 | Cascade alternative |
| T9.3 | Iframe dans le panneau admin | S | FE | T9.1 | Sandboxée |
| T9.4 | Auto-refresh sur changement (postMessage / refetch) | M | FE | T7.1, T9.3 | Délai ≤ 1 s |
| T9.5 | Switch Aperçu publié / brouillon | S | FE | T9.3 | Toggle UI |
| T9.6 | Test Playwright preview | S | FE | T9.4 | Parcours nominal |

## P10 — Cron + scheduling UI

| ID | Tâche | Effort | Rôle | Dépend | Critère |
|----|-------|--------|------|--------|---------|
| T10.1 | Route `/api/cron/promote-scheduled-fields` | M | BE | P5 | Idempotent, batch 100 |
| T10.2 | Route `/api/cron/purge-field-history` | S | BE | A4 | Rétention 90/365 j |
| T10.3 | Configuration `vercel.json` | XS | BE | T10.1, T10.2 | Crons enregistrés |
| T10.4 | Datepicker scheduling avec timezone Europe/Paris | M | FE | P8 | Conversion UTC correcte |
| T10.5 | Liste des champs programmés (dashboard) | S | FE | P5, T10.1 | Tri par scheduledAt |
| T10.6 | Endpoint manuel `promote` (admin) | XS | BE | T10.1 | Réutilise la transaction |
| T10.7 | Logs structurés `field.schedule.*` | S | BE | T10.1 | Tableau de bord ops |
| T10.8 | Test idempotence cron (2 runs simultanés) | S | BE | T10.1 | Pas de duplication |

## P11 — History + restore UI

| ID | Tâche | Effort | Rôle | Dépend | Critère |
|----|-------|--------|------|--------|---------|
| T11.1 | Page `/admin/components/[key]/fields/[fieldKey]/history` | M | FE | P5 | Timeline asc |
| T11.2 | Bouton « Restaurer cette version » | S | FE | T11.1, T5.6 | Crée un draft |
| T11.3 | Diff visuel text-diff (rich-text/multiline) | M | FE | T11.1 | `diff-match-patch` |
| T11.4 | Diff json-diff pour structurés (cta, list, record) | M | FE | T11.1 | Lisible |
| T11.5 | Endpoint bulk restore-snapshot (asOf timestamp) | M | BE | T5.6 | Transaction par composant |
| T11.6 | Page `/admin/audit?resource=componentField` | S | FE | A6 | Filtres actor/action/période |
| T11.7 | Tests RTL + Playwright restore | S | FE | T11.2 | Parcours bout en bout |

## P12 — Rollout

| ID | Tâche | Effort | Rôle | Dépend | Critère |
|----|-------|--------|------|--------|---------|
| T12.1 | P12.1 : Header + Footer (RSC + registry + catalog) | S | FS | P1-P11 | 6 fields shippés |
| T12.2 | P12.2 : Home (5 composants) | L | FS | T12.1 | ~25 fields shippés |
| T12.3 | P12.3 : Maison + Boutique (11 composants) | XL | FS | T12.2 | ~50 fields shippés |
| T12.4 | P12.4 : Journal (rich-text intensif) | XL | FS | T12.3 | ~30 fields shippés, sécurité validée |
| T12.5 | Sessions formation fondatrice (3 sessions) | M | FS | T12.1, T12.2, T12.4 | Comptes-rendus archivés |
| T12.6 | Catalog `catalog/<key>.md` × 30 | L | FS | T12.1-T12.4 | Tous les composants documentés |
| T12.7 | Doc utilisateur PDF 1 page | S | DSG | T12.5 | Distribué à la fondatrice |
| T12.8 | Dashboard observabilité (P6 stabilisation) | M | BE | T10.7 | Métriques R5 affichées |
| T12.9 | Alertes Slack `field.schedule.failed` > 3/24h | S | BE | T10.7 | Webhook configuré |
| T12.10 | Suite Playwright e2e par page-group | L | FE | T12.1-T12.4 | 1 parcours nominal + 3 erreur par page |

## Récapitulatif charge

| Phase | Tâches | Charge totale |
|-------|--------|---------------|
| P1 | 8 | ~3 j |
| P2 | 8 | ~4 j |
| P3 | 8 | ~3 j |
| P4 | 9 | ~4 j |
| P5 | 13 | ~5 j |
| P6 | 13 | ~7 j |
| P7 | 7 | ~5 j |
| P8 | 8 | ~5 j |
| P9 | 6 | ~4 j |
| P10 | 8 | ~4 j |
| P11 | 7 | ~5 j |
| P12 | 10 | ~15 j |
| **Total** | **105 entrées** | **~64 j** |

## Cross-references

- Phases macro → P1 (`01-phases.md`)
- Risques associés → P3 (`03-risks.md`)
- Acceptance → P4 (`04-acceptance.md`)
