# P1 — Phases du chantier

> 12 phases. Total : **6 à 8 semaines** pour 1 dev full-stack +
> support design ponctuel (~20 % d'un designer).
>
> Les phases respectent la cascade architecturale : **schéma →
> résolveur → API → UI → rollout**. Aucune phase ne shippe en prod
> isolément avant la phase 12, sauf P1 (squelette neutre).

## Vue Gantt (ASCII)

```
Sem.    1         2         3         4         5         6         7         8
Phase   ─────────────────────────────────────────────────────────────────────────
P1  Schéma         ██████
P2  Seed-pipeline  ─█████
P3  Cascade/cache         ██████
P4  Validators            ──████
P5  API REST              ─────█████
P6  Editors                       ████████
P7  Form engine                   ──██████
P8  Admin Panel                       ────██████
P9  Live preview                                ███████
P10 Cron + schedule                               ──████
P11 History UI                                       ─────█████
P12 Rollout (R4)                                                  ████████████
```

> Les phases techniques (P1–P11) durent ~5 semaines. La phase 12
> (rollout) consomme à elle seule ~3 semaines.

## P1 — Schéma DB + types + migrations

| Champ | Détail |
|-------|--------|
| **Livrables** | • Tables `component_field_bindings`, `component_field_history`<br>• Enums `field_binding_status`, `field_history_action`<br>• Colonne `fields jsonb` sur `site_components`<br>• Types TS `ComponentFieldDefinition`, `FieldType`, `FieldTypeConfig`, `FieldBindingStatus`<br>• Migration Drizzle `0006_components_cms.sql`<br>• Étendre `TrackingResource` avec `'component_field_binding'` |
| **Durée** | 3 j |
| **Dépendances** | Aucune |
| **Critères de done** | • `pnpm tsc --noEmit` ✅<br>• Migration générée et appliquée en local<br>• Tests Vitest sur les types (assertions de cohérence)<br>• PR reviewed et mergée |
| **Cross-ref** | A2, A6 |

## P2 — Seed-pipeline extensions

| Champ | Détail |
|-------|--------|
| **Livrables** | • `seed-pipeline.ts` étendu : nouvelle phase `fields`<br>• Détection des fields ajoutés / retirés du registre (reconcile)<br>• Script CLI `pnpm seed:components-fields`<br>• Script CLI `pnpm seed:components-fields:reconcile`<br>• Script `scripts/check-field-bindings-count.ts`<br>• Tests fs-mocked Vitest |
| **Durée** | 4 j |
| **Dépendances** | P1 |
| **Critères de done** | • Seed idempotent (2 runs successifs = 0 changement)<br>• Reconcile archive les bindings orphelins<br>• Reconcile crée les manquants (status=published v1)<br>• Tests passent en CI |
| **Cross-ref** | A2, B4, R1 |

## P3 — Cascade resolver + cache + RSC helper

| Champ | Détail |
|-------|--------|
| **Livrables** | • `lib/components/field-resolver.ts` : `resolveComponentField`, `resolveComponentFields`<br>• Cache `unstable_cache` avec tag `components:fields:<key>:<locale>`<br>• Helper RSC `<ComponentField>` (children-as-render-prop)<br>• `diagnoseComponentFields` (utilitaire dev)<br>• `decodeValue` / `encodeValue` par type |
| **Durée** | 3 j |
| **Dépendances** | P1, P2 |
| **Critères de done** | • Cascade testée pour les 8 edge cases EC1–EC8<br>• Hit cache `< 1 ms` mesuré<br>• Miss cache `< 30 ms`<br>• 1 RSC pilote (`Header`) utilisant `<ComponentField>` |
| **Cross-ref** | A3, F2, B3 |

## P4 — Validators Zod + sanitizers

| Champ | Détail |
|-------|--------|
| **Livrables** | • Schémas Zod par type (text, multiline, rich-text, cta, link, icon, color-token, number, boolean, enum, list, record, kicker, quote, breadcrumb-segment)<br>• `validateField(componentKey, fieldKey, value)` — résout type via registre<br>• Sanitizer rich-text (DOMPurify côté serveur, allowlist)<br>• Validation `href` avec allowlist hôtes<br>• 15+ vecteurs XSS testés |
| **Durée** | 4 j |
| **Dépendances** | P1 |
| **Critères de done** | • Tests Vitest unitaires sur chaque schéma<br>• Tests sanitization avec corpus XSS<br>• Allowlist `cta.href` couverte<br>• Erreurs Zod traduites en français lisible |
| **Cross-ref** | A6, B2 |

## P5 — API REST routes + MSW handlers

| Champ | Détail |
|-------|--------|
| **Livrables** | • `GET /api/admin/components/[key]/fields` (lecture liste + draft)<br>• `PATCH /api/admin/components/[key]/fields/[fieldKey]` (auto-save draft)<br>• `POST /api/admin/components/[key]/fields/[fieldKey]/publish`<br>• `POST /api/admin/components/[key]/fields/[fieldKey]/schedule`<br>• `POST /api/admin/components/[key]/fields/[fieldKey]/cancel-schedule`<br>• `POST /api/admin/components/[key]/fields/[fieldKey]/restore`<br>• `GET /api/admin/components/[key]/fields/[fieldKey]/history`<br>• `POST /api/admin/cache/revalidate`<br>• `POST /api/admin/components/[key]/revalidate`<br>• Handlers MSW pour tout |
| **Durée** | 5 j |
| **Dépendances** | P1, P3, P4 |
| **Critères de done** | • Codes HTTP exacts (400, 401, 403, 409, 422, 429, 500) couverts par tests<br>• Rate-limit testé<br>• If-Match / 409 testé<br>• Audit log écrit pour chaque mutation<br>• MSW handlers ↔ vraie API : tests cross-validation |
| **Cross-ref** | B1, A6 |

## P6 — Editor registry (par type)

| Champ | Détail |
|-------|--------|
| **Livrables** | • `TextEditor`, `MultilineEditor`, `RichTextEditor`, `CtaEditor`, `LinkEditor`, `IconEditor`, `ColorTokenEditor`, `NumberEditor`, `BooleanEditor`, `EnumEditor`, `ListEditor`, `RecordEditor`, `KickerEditor`, `QuoteEditor`, `BreadcrumbSegmentEditor`<br>• Registry `editorByType: Record<FieldType, ComponentType>`<br>• Tests RTL par éditeur (au moins 3 cas par type) |
| **Durée** | 7 j |
| **Dépendances** | P4 |
| **Critères de done** | • 15 éditeurs implémentés<br>• Couverture ≥ 90 % sur les editors<br>• A11y axe-core 0 violation par éditeur<br>• Aperçu live dans chaque éditeur (mini-preview du rendu) |
| **Cross-ref** | F1, T4 |

## P7 — Form engine (state + auto-save + conflit)

| Champ | Détail |
|-------|--------|
| **Livrables** | • Hook `useFieldForm(componentKey)` : `useReducer` avec actions `change`, `saveStart`, `saveOk`, `saveErr`<br>• Auto-save debounced 800 ms via `PATCH`<br>• Retry exponentiel 3x sur erreur réseau<br>• Détection 409 → modal merge / reload<br>• Détection 422 → bannière warning sanitization<br>• Indicateur `dirty` / `saving` / `saved` par champ |
| **Durée** | 5 j |
| **Dépendances** | P5, P6 |
| **Critères de done** | • Tests RTL sur le hook (mock fetch)<br>• Auto-save vérifié avec timer fakes<br>• Modal 409 testé<br>• Reset propre quand le composant change |
| **Cross-ref** | F3 |

## P8 — Admin Fields panel UI

| Champ | Détail |
|-------|--------|
| **Livrables** | • `ComponentFieldsPanel` injecté dans `app/admin/components/[key]/page.tsx`<br>• Groupes (`group`) en accordéons / tabs<br>• Bouton "Publier" / "Programmer" / "Voir l'historique"<br>• Badge statut par champ (draft, published, scheduled)<br>• Diff vs publié (mini visualisation)<br>• Skeleton de chargement<br>• Empty states |
| **Durée** | 5 j |
| **Dépendances** | P6, P7 |
| **Critères de done** | • Panneau s'affiche pour 1 composant pilote<br>• Tests RTL sur le panneau<br>• A11y 0 violation<br>• Design review avec design support |
| **Cross-ref** | D2, D3 |

## P9 — Live preview iframe

| Champ | Détail |
|-------|--------|
| **Livrables** | • Route `/admin/components/[key]/preview?draft=1`<br>• `resolveComponentFieldsDraft()` (utilise drafts au lieu de published)<br>• Iframe dans le panneau admin avec auto-refresh sur changement<br>• `postMessage` du parent vers l'iframe pour scroller au champ édité<br>• Switch « Aperçu publié / brouillon » |
| **Durée** | 4 j |
| **Dépendances** | P3, P8 |
| **Critères de done** | • Édition d'un champ → preview à jour ≤ 1 s<br>• Pas de fuite : la route preview exige une session admin<br>• 0 violation a11y<br>• Tests Playwright nominal |
| **Cross-ref** | F4, D3 |

## P10 — Cron promotion + scheduling UI

| Champ | Détail |
|-------|--------|
| **Livrables** | • Route `/api/cron/promote-scheduled-fields`<br>• Route `/api/cron/purge-field-history`<br>• Configuration `vercel.json`<br>• UI scheduling : datepicker + timezone (Europe/Paris)<br>• Liste des champs programmés dans le dashboard admin<br>• Endpoint manuel `promote` (réservé admin)<br>• Logs structurés `field.schedule.*` |
| **Durée** | 4 j |
| **Dépendances** | P5, P8 |
| **Critères de done** | • Cron tourne en local + staging<br>• Idempotence vérifiée (2 runs simultanés ne dupliquent pas)<br>• Anti-flap testé (refus si scheduledAt < now+1min)<br>• Dashboard scheduled fields affiche les rouges (failed) |
| **Cross-ref** | A4, R5 / I3 |

## P11 — History + restore UI

| Champ | Détail |
|-------|--------|
| **Livrables** | • Page `/admin/components/[key]/fields/[fieldKey]/history`<br>• Timeline ascendante avec auteur, action, timestamp<br>• Bouton « Restaurer cette version » → crée un draft<br>• Diff visuel entre 2 versions (text-diff pour `text/multiline/rich-text`, json-diff pour structurés)<br>• Endpoint bulk restore-snapshot (cf. R5 / I6 Option B)<br>• Page `/admin/audit?resource=componentField` (vue cross-composant) |
| **Durée** | 5 j |
| **Dépendances** | P5, P8 |
| **Critères de done** | • Restauration testée bout en bout<br>• Diff lisible<br>• A11y OK<br>• Lien depuis le panneau du composant |
| **Cross-ref** | A4, A6 |

## P12 — Rollout par page-group + training

| Champ | Détail |
|-------|--------|
| **Livrables** | Cf. R4. Découpage en sous-phases :<br>• P12.1 : Header + Footer (1-2 j)<br>• P12.2 : Home (3-4 j)<br>• P12.3 : Maison + Boutique (4-5 j)<br>• P12.4 : Journal (5-6 j)<br>• P12.5 : Stabilisation (5-7 j)<br><br>+ Sessions de formation fondatrice (3 sessions, 30 / 30 / 45 min)<br>+ Catalog complet (`catalog/<key>.md` × 30)<br>+ Doc utilisateur PDF (1 page) |
| **Durée** | ~3 sem |
| **Dépendances** | P1–P11 |
| **Critères de done** | Cf. P4 (`action-plan/04-acceptance.md`) — tous les critères F1–F12 et NF1–NF6 verts |
| **Cross-ref** | R4, P4 |

## Récapitulatif

| Phase | Type | Charge | Cumul |
|-------|------|--------|-------|
| P1 | Backend | 3 j | 3 j |
| P2 | Backend | 4 j | 7 j |
| P3 | Backend / RSC | 3 j | 10 j |
| P4 | Backend | 4 j | 14 j |
| P5 | Backend | 5 j | 19 j |
| P6 | Frontend | 7 j | 26 j |
| P7 | Frontend | 5 j | 31 j |
| P8 | Frontend | 5 j | 36 j |
| P9 | Full | 4 j | 40 j |
| P10 | Backend | 4 j | 44 j |
| P11 | Frontend | 5 j | 49 j |
| P12 | Full + comm | ~15 j | 64 j |

**Total estimé** : ~64 j / dev full-stack ≈ **~13 semaines à 5 j/sem**.
Avec parallélisation possible P6/P7/P8 + design support, on tombe à
**~6-8 semaines** calendaires.

## Parallélisations possibles

```
Sem 1-2  : P1, P2 séquentielles
Sem 2-4  : P3 backend (1 dev) // P4 backend (peut être le même dev ou un autre)
Sem 3-5  : P5 backend // P6 frontend (peut être 2 personnes)
Sem 4-6  : P7 frontend (dépend P5 + P6) // P8 design+frontend
Sem 5-6  : P9 (dépend P3 + P8) // P10 backend // P11 frontend
Sem 6-8  : P12 rollout (un page-group à la fois, avec validation entre chaque)
```

## Hypothèses de planning

- 1 dev full-stack à 5 j/sem.
- Design support : ~1 j/sem ponctuel (validation de l'admin).
- Pas de blocage extérieur (auth admin existante, infra Vercel
  fonctionnelle).
- Les ~30 catalogues sont écrits **au fil de l'eau** pendant P12,
  pas en bloc.

## Hors scope (cf. A1)

- Multilangue UI éditeur
- Workflow multi-rôle
- A/B testing
- Édition collaborative temps réel
- Permissions par-champ

Si l'un de ces items remonte en cours de chantier → ticket v2,
**pas** d'ajout au scope v1.

## Cross-references

- Tasks détaillées → P2 (`02-tasks.md`)
- Risques → P3 (`03-risks.md`)
- Acceptance v1 → P4 (`04-acceptance.md`)
- Rollout en exécution → R4
