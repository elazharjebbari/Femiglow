# 10.5 — Périmètre & frontières système

## In scope V1

- 9 pages légales préconfigurées (cf. 60-content/)
- Table `legal_pages`, `legal_pages_history`, `legal_zones`,
  `legal_page_placements`, `legal_template_vars`, `legal_link_health_snapshot`
- Admin UI `/admin/legal/*` (list, edit, placements, health, wizard new)
- Public route `/<slug>` ou `/legal/<slug>` (TBD)
- API `/api/legal/*` (public + admin)
- Job git auto-commit on publish
- Cron link health check (30 min)
- Build-time link check (CI gate)
- 30+ tests Jest + 8 e2e Playwright + test ultime

## Out of scope V1

- **Multi-langue** (AR) — V2
- **WYSIWYG riche** — pas nécessaire pour MD + preview
- **Workflow approbation multi-niveau** (juriste → admin sénior → publish) — V2
- **Notifications email** aux co-admins lors d'une soumission à revue — V2
- **Recherche full-text** dans le contenu — V2
- **Comparaison versions side-by-side** — V2 (V1 = restore simple)
- **Templates marketing** non-légaux (manifeste, charte) — V2
- **Internationalisation** (EU compliance, RGPD UE) — V2 si nécessaire

## Intégrations externes

| Service | Usage | Auth |
|---|---|---|
| Git remote (legal-versions branch) | Audit commits | SSH key serveur |
| Email service (Resend) | Alertes link cassé | RESEND_API_KEY |
| Sentry (optionnel) | Erreurs runtime | DSN env |

## Frontières admin

| Page admin | Existant | Nouveau / refactor |
|---|---|---|
| /admin/settings | ✅ existante | inchangée |
| /admin/legal | ❌ | NOUVELLE — liste pages |
| /admin/legal/[slug]/edit | ❌ | NOUVELLE — éditeur MD |
| /admin/legal/[slug]/history | ❌ | NOUVELLE — versions historiques |
| /admin/legal/placements | ❌ | NOUVELLE — matrice page × zone |
| /admin/legal/health | ❌ | NOUVELLE — dashboard santé |
| /admin/legal/wizard/new | ❌ | NOUVELLE — wizard création |

## Frontières publiques

| Route publique | Existant | État cible |
|---|---|---|
| `/mentions-legales` | ✅ statique TSX | dynamic DB-driven |
| `/cgv` | ❌ | NOUVELLE |
| `/cgu` | ❌ | NOUVELLE |
| `/confidentialite` | ❌ | NOUVELLE |
| `/cookies` | ❌ | NOUVELLE |
| `/retours-remboursements` | ❌ | NOUVELLE |
| `/livraison` | ❌ | NOUVELLE |
| `/securite-produits` | ❌ | NOUVELLE |
| `/faq` | ❌ | NOUVELLE (avec SEO opt-in) |

## Frontières DB

| Table | Action |
|---|---|
| legal_pages | NOUVELLE |
| legal_pages_history | NOUVELLE |
| legal_zones | NOUVELLE (seed catalog) |
| legal_page_placements | NOUVELLE |
| legal_template_vars | NOUVELLE |
| legal_link_health_snapshot | NOUVELLE |
| audit_events | EXISTANTE — enrichie pour actions `legal.*` |

## Hors champs (à NE PAS toucher)

- Le système de checkout `/api/checkout/*` (juste les pages CGV qui le
  référencent)
- Le système de tracking `/admin/tracking/*`
- Le système de reset
- Le chat widget (sauf si on ajoute un disclaimer config)
- Le système d'authentification admin (juste RBAC pour `legal.*` actions)

## Risques d'adhérence

- Footer component existant doit être refactoré pour lire depuis API
  (au lieu de hardcoded) — coordination avec design
- ConsentBanner doit lire depuis API pour le link vers politique cookies
- Page `/mentions-legales` existante sera **remplacée** par la version
  dynamique — backup avant migration
