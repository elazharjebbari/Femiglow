# P4 — Critères d'acceptance v1 GA

> Ces critères sont **bloquants** pour le go-live (GA). Tous doivent
> être verts avant fermeture du chantier.
>
> Chaque critère a :
>
> - un **identifiant** (F1–F12 fonctionnel, NF1–NF6 non-fonctionnel),
> - une **formulation testable** (qui passe / échoue, sans
>   ambiguïté),
> - une **méthode de vérification** (test automatisé, dashboard,
>   check manuel scripté).

## Critères fonctionnels

### F1 — Édition d'un titre simple visible en ≤ 60 s

| | |
|---|---|
| **Énoncé** | Un admin authentifié édite le `home-hero / title` et clique « Publier ». Le rendu de `/` reflète la nouvelle valeur dans les 60 secondes (incl. cache RSC + edge). |
| **Vérification** | Test Playwright `e2e/components-cms/edit-home-hero.spec.ts` : login → edit → publish → reload public → expect text. |
| **Mesure** | `expect(page).toContainText(...)` dans la fenêtre de 60 s. |

### F2 — Brouillon persistant entre sessions

| | |
|---|---|
| **Énoncé** | Un admin commence à éditer un champ, ferme l'onglet sans publier. À la réouverture, l'éditeur affiche le brouillon. |
| **Vérification** | Test Playwright `e2e/components-cms/draft-persists.spec.ts`. |
| **Mesure** | Auto-save effectif (vérifie `PATCH` dans network), redécouverte du brouillon au reload. |

### F3 — Publication crée une nouvelle version

| | |
|---|---|
| **Énoncé** | Après publication, l'historique du champ contient `version=N+1`, `action=publish`, et l'ancien published est `archived`. |
| **Vérification** | Test Vitest `versioning.spec.ts` (transition publish) + assertion DB. |
| **Mesure** | `SELECT version, status FROM component_field_history WHERE …` montre la timeline correcte. |

### F4 — Programmation d'une publication future

| | |
|---|---|
| **Énoncé** | Un admin programme un champ pour `now+1h`. Le binding est `scheduled`. Le cron promote-scheduled-fields le promeut à l'échéance. |
| **Vérification** | Test Vitest `schedule-flow.spec.ts` avec timer fakes + cron mock. |
| **Mesure** | Timeline DB : draft → scheduled → published. Logs `field.schedule.promoted`. |

### F5 — Restauration depuis l'historique

| | |
|---|---|
| **Énoncé** | Un admin sélectionne une version v3 dans l'historique d'un champ (publié actuellement v5) et clique « Restaurer ». Un draft est créé avec la valeur de v3. Une publication crée v6 = valeur de v3. |
| **Vérification** | Test Playwright `e2e/components-cms/restore.spec.ts`. |
| **Mesure** | Comparaison de `value` entre v3 history et v6 binding. |

### F6 — Conflit version 409 + UI de résolution

| | |
|---|---|
| **Énoncé** | Deux admins éditent le même champ. Le second à publier reçoit 409 + dialog modal proposant **merger** ou **recharger**. |
| **Vérification** | Test RTL `conflict.spec.tsx` (mock 409 via MSW). |
| **Mesure** | Modal présente, choix possibles, pas de perte silencieuse. |

### F7 — Validation Zod côté serveur

| | |
|---|---|
| **Énoncé** | Toute valeur ne respectant pas le schéma du type renvoie 400 avec message en français. |
| **Vérification** | Tests Vitest `validators.spec.ts` (15+ cas par type). |
| **Mesure** | Tous les schémas couverts (text, multiline, rich-text, cta, link, icon, color-token, number, boolean, enum, list, record, kicker, quote, breadcrumb-segment). |

### F8 — Sanitization rich-text

| | |
|---|---|
| **Énoncé** | Une valeur rich-text contenant `<script>`, `<iframe>`, `onerror=`, `javascript:`, etc. est neutralisée à l'écriture **et** au rendu. |
| **Vérification** | Test Vitest `sanitize.spec.ts` avec corpus 15+ vecteurs XSS. |
| **Mesure** | Aucun élément interdit n'apparaît dans le HTML rendu, audit log enregistre une tentative si le diff entrée/sortie dépasse un seuil. |

### F9 — Live preview reflète le draft en ≤ 1 s

| | |
|---|---|
| **Énoncé** | L'iframe `/admin/components/[key]/preview?draft=1` met à jour le rendu dans la seconde après une frappe (debounce auto-save inclus : 800 ms + render). |
| **Vérification** | Test Playwright `preview.spec.ts`. |
| **Mesure** | Délai mesuré ≤ 1500 ms en p95 local. |

### F10 — Cascade tombe sur `defaultValue` si pas de binding

| | |
|---|---|
| **Énoncé** | Pour un field nouvellement déclaré et non encore seedé, le rendu utilise la `defaultValue` du registre. |
| **Vérification** | Test Vitest `cascade.spec.ts` (EC2 dans A3). |
| **Mesure** | `meta.source === 'default'`. |

### F11 — Audit log complet par action

| | |
|---|---|
| **Énoncé** | Chaque mutation (`create`, `update`, `publish`, `schedule`, `unschedule`, `restore`, `archive`) écrit une ligne dans `component_field_history` **et** une dans `adminAuditLog`. |
| **Vérification** | Test Vitest `audit.spec.ts`. Vérifier 7 transitions × 2 tables. |
| **Mesure** | 14 lignes attendues, types corrects. |

### F12 — Catalog complet

| | |
|---|---|
| **Énoncé** | Pour chaque composant migré dans P12, il existe un fichier `catalog/<key>.md` non vide listant les fields, leurs types, leurs défauts et leurs contraintes. |
| **Vérification** | Script `scripts/check-catalog.ts` qui parcourt le registre et vérifie la présence + le contenu minimal. |
| **Mesure** | 30/30 composants documentés. |

## Critères non-fonctionnels

### NF1 — Performance

| Critère | Cible | Vérification |
|---------|-------|--------------|
| TTFB admin (`/admin/components/[key]`) p95 | ≤ 300 ms | Playwright + perf trace |
| TTFB public p95 (pages migrées) | ≤ ancienne valeur + 5 ms | Web Vitals dashboard, comparaison avant/après chaque sous-phase de P12 |
| `resolveComponentFields` (cache hit) | < 1 ms | Bench Vitest |
| `resolveComponentFields` (cache miss) | < 30 ms | Bench Vitest |
| `POST /publish` p95 | < 500 ms | Trace API |
| Hit-rate cache RSC | ≥ 95 % sur 7 j | Dashboard observabilité |

### NF2 — Accessibilité (a11y)

| Critère | Cible | Vérification |
|---------|-------|--------------|
| axe-core sur tous les écrans admin | 0 violation A/AA | Tests intégration RTL avec `jest-axe` |
| Navigation clavier (admin) | 100 % des actions | Test Playwright `a11y-keyboard.spec.ts` |
| Lecteurs d'écran (NVDA / VoiceOver) | Tous les éditeurs annoncés correctement | Audit manuel scripté en P8 |
| Contraste de couleur | WCAG AA (≥ 4.5:1) | Vérification automatique via D5 + axe |

### NF3 — Couverture de tests

| Module | Cible | Vérification |
|--------|-------|--------------|
| `src/lib/components/fields/**` | ≥ 85 % | `vitest --coverage` |
| `src/components/admin/components/fields/**` | ≥ 85 % | idem |
| Routes `/api/admin/components/[key]/fields/**` | ≥ 85 % | idem |
| Validators et sanitizer | ≥ 95 % | idem (composant critique) |
| Couverture globale | ≥ 80 % (existant maintenu) | CI |

### NF4 — Sécurité

| Critère | Cible | Vérification |
|---------|-------|--------------|
| Corpus XSS rich-text | 100 % neutralisés | Tests `sanitize.spec.ts` |
| Open redirect via href | 100 % bloqués hors allowlist | Tests `validators.spec.ts` |
| Path traversal iconKey | Impossible | Tests Zod enum |
| Rate-limit | 60 req/min/user effectif | Test mock store |
| CSRF | Header `X-Requested-With` exigé | Test handler |
| Auth bypass | Aucun endpoint accessible sans session | Tests Playwright |
| Pen-test ciblé avant P12.4 (Journal) | 0 vuln critique | Audit externe ou interne dédié |

### NF5 — Documentation

| Critère | Cible | Vérification |
|---------|-------|--------------|
| Catalog `catalog/<key>.md` | 30/30 composants | Script auto |
| Doc utilisateur PDF (1 page) | Distribuée à la fondatrice | Vu par PO |
| Architecture A1–A6 | À jour vs implémentation | Revue dev |
| Runbook R1–R5 | Couvre les opérations courantes | Revue dev + test à blanc |
| README.md de la doc | Liens fonctionnels | Lint markdown |

### NF6 — Adoption / training

| Critère | Cible | Vérification |
|---------|-------|--------------|
| Sessions de formation tenues | 3 / 3 (Pré-P3, Pré-P5, Onboarding) | Compte-rendu archivé |
| Fondatrice publie ≥ 3 modifications en autonomie dans les 14 j post-GA | 3+ | Audit log filtré sur son `actorId` |
| Score satisfaction (entretien à J+30) | ≥ 4 / 5 | Entretien semi-directif |
| Backlog v1.1 priorisé | À jour | Outil de ticketing |

## Synthèse pour go/no-go

```
GA si :
  ✅ F1–F12 (12/12)
  ✅ NF1 (perf) — toutes les métriques sous cible
  ✅ NF2 (a11y) — 0 violation
  ✅ NF3 (coverage) — toutes ≥ cible
  ✅ NF4 (sécu) — incl. pen-test
  ✅ NF5 (docs) — catalog + runbook + PDF
  ✅ NF6 (training) — sessions tenues, doc remise

Bonus (non bloquants v1) :
  ◯ Dashboard observabilité (peut shipper en v1.1)
  ◯ Doc multilingue (v2)
  ◯ Approbation 4-yeux (v2)
```

## Tableau de pilotage (à maintenir vivant pendant P12)

| Critère | Owner | État | Date attendue | Notes |
|---------|-------|------|---------------|-------|
| F1 | FE | ☐ | Sem 5 | dépend P9 |
| F2 | FE | ☐ | Sem 5 | dépend P7 |
| F3 | BE | ☐ | Sem 4 | dépend P5 |
| F4 | BE | ☐ | Sem 6 | dépend P10 |
| F5 | FS | ☐ | Sem 7 | dépend P11 |
| F6 | FE | ☐ | Sem 5 | dépend P7 |
| F7 | BE | ☐ | Sem 3 | dépend P4 |
| F8 | BE | ☐ | Sem 3 | dépend P4 |
| F9 | FS | ☐ | Sem 6 | dépend P9 |
| F10 | BE | ☐ | Sem 3 | dépend P3 |
| F11 | BE | ☐ | Sem 4 | dépend P5 + A6 |
| F12 | FS | ☐ | Sem 8 | dépend P12 |
| NF1 | BE | ☐ | continu | bench à chaque sous-phase |
| NF2 | DSG+FE | ☐ | continu | axe à chaque PR |
| NF3 | BE+FE | ☐ | continu | CI gate |
| NF4 | BE | ☐ | Sem 7 | pen-test |
| NF5 | FS | ☐ | Sem 8 | au fil de l'eau |
| NF6 | PO | ☐ | Sem 8 + 14 j | KPI post-GA |

## Cross-references

- Phases → P1
- Tasks → P2
- Risques → P3
- Incidents → R5
- Architecture → A1–A6
- Tests → T1–T6
