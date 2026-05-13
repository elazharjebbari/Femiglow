# 00.1 — Executive summary

## Contexte

FemiGlow est un site e-commerce vendant des produits cosmétiques (kit de
manucure japonaise halal) au Maroc. Les pages légales actuelles sont
**partiellement implémentées** : `/mentions-legales` existe mais les autres
(CGV, politique de confidentialité, retours, etc.) sont manquantes ou
inexistantes.

L'audit identifie ces besoins :
1. **Conformité légale** : 9 pages requises ou recommandées
2. **Manageabilité** : admin doit pouvoir éditer sans deploy
3. **SEO** : ces pages ne doivent **pas** polluer la recherche
4. **Qualité** : liens des footers doivent toujours fonctionner

## Vision

Un **système intégré** où :
- L'admin gère les pages depuis `/admin/legal/*`
- Les pages sont rendues avec le style FemiGlow cohérent
- 9 pages sont **pré-rédigées** au seed initial (Mentions, CGV, CGU, Conf,
  Cookies, Retours, Livraison, Sécurité produits, FAQ)
- Le placement dans le footer/checkout/etc. est configurable par zone
- Le SEO est exclu par défaut (opt-in pour cas particuliers)
- Un dashboard `/admin/legal/health` surveille la santé des liens

## Enjeux business

| Enjeu | État actuel | État cible |
|---|---|---|
| Pages légales conformes | 1/9 (mentions léjales seulement) | **9/9 publiées ou en draft validé** |
| Edition autonome admin | ❌ (deploy requis) | ✅ admin UI temps réel |
| Risque SEO (pollution SERP par pages légales) | Inconnu | ✅ noindex par défaut |
| Visibilité liens cassés | Aucune | Dashboard + alerte cron |
| Maintenance lois changeantes | Manuel | Versioning + workflow review |

## Architecture cible (vue d'ensemble)

```
                   ┌──────────────────────────────────┐
                   │  PUBLIC (visiteurs)              │
                   │                                  │
                   │  ┌──────────────┐                │
                   │  │ /mentions-…  │  ← noindex     │
                   │  │ /cgv         │  ← noindex     │
                   │  │ /confid…     │  ← noindex     │
                   │  │ /faq         │  ← index ✓     │
                   │  └──────────────┘                │
                   │                                  │
                   │  Footer / Cookie / Checkout      │
                   │  consomment legal_page_placements│
                   └──────────────┬───────────────────┘
                                  │
                   ┌──────────────▼───────────────────┐
                   │  /api/legal/<slug>               │
                   │  (lecture publique, cached)      │
                   └──────────────┬───────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────┐
│  POSTGRESQL                                          │
│  ├─ legal_pages       (current state)                │
│  ├─ legal_pages_history (audit)                      │
│  ├─ legal_zones       (footer-main, cookie-banner...)│
│  └─ legal_page_placements (page × zone matrix)       │
└─────────────────────────────────▲────────────────────┘
                                  │
                   ┌──────────────┴───────────────────┐
                   │  ADMIN (/admin/legal/*)          │
                   │                                  │
                   │  ┌──────────────┐                │
                   │  │ List pages   │                │
                   │  │ Edit page    │                │
                   │  │ Health check │                │
                   │  └──────────────┘                │
                   └──────────────────────────────────┘
                                  │
                                  ▼
                   ┌──────────────────────────────────┐
                   │  Git branch `legal-versions`      │
                   │  (auto-commit on publish)        │
                   └──────────────────────────────────┘
```

## Effort total estimé

| Chantier | Effort | Critique ? |
|---|---|---|
| 1 — Stockage DB + sync git | 8 h | 🔴 |
| 2 — Éditeur MD + preview | 6 h | 🟠 |
| 3 — Placement zones | 5 h | 🟠 |
| 4 — SEO noindex | 2 h | 🔴 |
| 5 — Link verification | 4 h | 🟡 |
| 6 — 9 pages pré-rédigées | 6 h | 🔴 |
| Tests + a11y | 5 h | 🟠 |
| **TOTAL** | **36 h** | |

## Livrables attendus

**Code** :
- `lib/legal/` (renderers MD, sanitization, link checker)
- `app/api/admin/legal/*` (CRUD routes)
- `app/legal/[slug]/page.tsx` (public render)
- `app/admin/legal/*` (admin UI)
- `components/legal/` (LegalPageEditor, FooterLegalLinks, etc.)

**DB** :
- 4 nouvelles tables (`legal_pages`, `legal_pages_history`, `legal_zones`,
  `legal_page_placements`)
- 1 migration
- Seed avec 9 pages en `draft`

**Tests** :
- 30+ tests Jest
- 8 scénarios Playwright e2e
- 1 test ultime qui valide :
  - Édition d'une page
  - Publication
  - Affichage public
  - Présence dans footer
  - `noindex` correctement appliqué
  - Lien fonctionne

**Documentation** :
- Ce dossier
- Runbook de revue légale (process humain à suivre)
- ADRs pour les décisions architecturales

## Critères de succès

Voir [`success-criteria.md`](./success-criteria.md).
