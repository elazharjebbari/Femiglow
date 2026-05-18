# 08 — Documentation interne & plan de conception/dev

> **Vue d'ensemble** : `/docs/` contient ≈ 280 fichiers `.md` sur 38 sous-dossiers + 7 documents racine, ≈ 80 000 lignes. Niveau de documentation **exceptionnel** pour un projet privé. Gabarit reproductible *cahier → architecture → data → backend → frontend → tests → runbook* appliqué partout. Deux faiblesses : pas de README racine, et quelques dossiers vides à archiver.

---

## 1. Inventaire complet

### 1.1 Récapitulatif par dossier

| Dossier | Fichiers | Thème | Maturité |
|---|---|---|---|
| `admin/` | 7 | Auth, audit, recommandations admin | ✅ Phase 1 |
| `admin-config/` | 5 | Config runtime, navigation, RBAC | ✅ Phase 1 |
| `ai-content-service/` | 1 | Service IA (WIP) | 📋 Concept |
| `analytics/` | 8 | Dashboard analytique (vision → runbook) | ✅ Phase 1 |
| `analytics-insights/` | 19 | Insights avancées + RGPD + runbook | ✅ Phase 2 |
| `audit/` | 16 | Audits techniques (codebase, feeds, archi, chat, legal) | ✅ État mai 2026 |
| `audit-lead-webhook-2026-05-16.md` | 1 (racine) | Diagnostic webhooks leads | 🔄 En cours |
| `audit-stalwart-email.md` | 1 (racine) | État infra mail | 🔄 En cours |
| `AUDIT-2026-05.md` | 1 (racine) | Audit technique global (1116 lignes) | ✅ Référence |
| `carrousels-meta/` | 1 | Stratégie campagnes Meta | 📋 Brief |
| `chat-assistant/` | 25 | Assistant IA complet (cahier → runbook) | ✅ Phase 1+ |
| `checkout-funnel/` | 13 | Tunnel d'achat 3 étapes | ✅ Phase 1 |
| `component-media-system/` | 9 | Système média unifié | ✅ Phase 1 |
| `components-cms/` | 1 | Composants CMS éditoriaux | 📋 Concept |
| `deliv-cities-priority/` | 7 | Autocomplete villes Maroc | ✅ Phase 1 |
| `dossier-chat-v2/` | 1 | Meta-dossier chat v2 | 🔄 Index |
| `emailing/` | 17 | Email transactionnel + Listmonk | ✅ Phase 2 |
| `event-mappings/` | 3 | Mapping events → vendors | ✅ Phase 1 |
| `feed-produit/` | 1 | Rapport Google Merchant Feed | ✅ Spécifique |
| `geo-promo-slide-header/` | 11 | Bandeau promo géolocalisé | 🔄 Phase 1 en cours (2026-05-18) |
| `geo-promo-slide-header-plan-2026-05-18.md` | 1 (racine) | Plan promo géolocalisé | 🔄 Plan |
| `gtm/` | 21 | Google Tag Manager complet | ✅ Phase 1+ |
| `gtm-poka-yoke/` | 2 | Anti-erreur GTM | ✅ Phase 1 |
| `images/` | 4 | Direction artistique + prompting ChatGPT | ✅ Référence |
| `kolenda/` | 0 | *(vide)* | ❌ |
| `leads-webhook-multi-step/` | 9 | Multi-step leads + webhooks | 🔄 En cours |
| `legal-pages/` | 2 | Pages légales | ✅ Phase 1 |
| `media/` | 13 | Gestion médias | ✅ Phase 1+ |
| `menu/` | 5 | 3 propositions navigation + analyse | ✅ Décidée |
| `pages/` | 2 | Architecture site + charte | ✅ Fondations |
| `plan-action-webhook-leads-2026-05-16.md` | 1 (racine) | Plan correction webhooks (6 phases) | 🔄 Plan |
| `plans/` | 19 | 9 plans pages (home → checkout) | ✅ Roadmap |
| `preparation/` | 17 | Dossier de préparation projet | ✅ Phase 0 référence |
| `products-cms/` | 1 | Pilotage catalogue | ✅ Phase 1 |
| `reset-feature/` | 9 | Réinitialisation DB/médias | ✅ Phase 1 |
| `reviews-wall/` | 15 | Mur de témoignages | ✅ Phase 1 |
| `runbook-deploy.md` | 1 (racine) | Procédure déploiement prod | ✅ Opérationnel |
| `seo-cms/` | 1 | Module SEO | ✅ Phase 1 |
| `snap-pixel-test-plan.md` | 1 (racine) | Tests Snap pixel live | ✅ Test plan |
| `tracking/` | 14 | Tracking événements | ✅ Phase 1+ |
| `tracking-attribution/` | 9 | Attribution visiteur | 🔄 Phase 2 |
| `tracking-audit/` | 1 | Audit GTM/Google Ads | ✅ État |
| `tracking-improvement/` | 3 | Amélioration tracking | 🔄 Concept |
| `tracking-snapchat-plans-audit/` | 1 | Audit plans Snapchat | 📋 Audit |
| `videos/` | 0 | *(vide)* | ❌ |

**Total** : 38 dossiers + 7 documents racine + ~280 fichiers `.md` + ≈ 80 000 lignes.

---

## 2. Documents-piliers

### 2.1 `AUDIT-2026-05.md` (1116 lignes)
Audit technique global mai 2026.
- Stack, infra, 90+ tables SQL, 240+ routes API, 124 pages admin.
- Dettes identifiées (React Query absent, rate-limit en mémoire, RBAC non câblé, paiement COD only).
- Forces (architecture modulaire, tests Playwright, CI, migration safety-net, audit logging).

### 2.2 `audit-lead-webhook-2026-05-16.md` (267 lignes)
Diagnostic 4 problèmes critiques (P1 `OUTBOUND_WEBHOOK_URL` absent, P2 leads `inline-contact` sans webhook, P3 scanner filter, P4 double dispatch). Statut corrigé via commit `4855c91`.

### 2.3 `audit-stalwart-email.md` (321 lignes)
État infrastructure mail : Stalwart v0.16 OK, SPF cassé, Redis NOAUTH, `contact@femiglow.ma` mort. Prérequis avant emailing.

### 2.4 `plan-action-webhook-leads-2026-05-16.md` (659 lignes)
6 phases de correction : dispatchToAllChannels, orchestrator inline-contact, scanner COALESCE, admin UI, settings flag, prod config.

### 2.5 `runbook-deploy.md` (145 lignes)
Workflow `./bin/deploy.sh` : preflight → pull → deps → validate → backup → migrate → build → restart → smoke. Point critique : redémarrer systemd post-build.

### 2.6 `snap-pixel-test-plan.md` (162 lignes)
Pixel Snap live, 10 events mappés, lacunes identifiées (`lead_capture`, `contact_submit`, `newsletter_submit` non mappés), tests MSW + script live + Ads Manager.

### 2.7 `geo-promo-slide-header-plan-2026-05-18.md` (489 lignes)
Bandeau promo géolocalisé : Option A Vercel geo non applicable, Option B Cloudflare visitor location headers recommandée.

### 2.8 `audit/chat-systeme-messagerie-audit-detaille-2026-05-17.md`
Chat complet : widget client (Zustand), API backend SSE, multi-provider LLM, RAG pgvector, lead capture.

### 2.9 `preparation/README.md` (93 lignes)
5 principes-maîtres : composants découplés, absence signature, B2C/B2B, mobile-first accessible, performance. 15 docs de préparation.

### 2.10 `plans/README.md` (63 lignes)
9 plans pages, 172-222h estimé. Home → Rituel → Kit → Journal → Article → Maison → Contact → Panier → Checkout.

---

## 3. Évaluation qualitative

### 3.1 Gabarit reproductible — qualité ⭐⭐⭐⭐⭐

Les meilleurs dossiers suivent un patron clair :

```
00-executive-summary    → contexte, objectifs, KPIs
01-vision-architecture  → vision, archi, data model
02-data                 → schémas, contrats API
03-backend              → implémentation serveur
04-frontend             → implémentation client
05-ui-ux-design         → designs, composants
06–09                   → spécialités (RAG, multilingue, etc.)
10+                     → tests, plan d'action, runbook
```

**Exemple parfait** : `gtm/` (21 docs) — audit → architecture → variables → triggers → tags → consent → tests → runbook.

### 3.2 Datation & versioning — qualité ⭐⭐⭐⭐

- ✅ Audits datés `YYYY-MM-DD`.
- ✅ Plans actionnels datés.
- ✅ Quelques dossiers avec versions (`preparation/` v1.0, `emailing/` M0-M1-PROGRESS).
- 🟡 Pas de table de versions systématique dans chaque doc.

### 3.3 Contenu obsolète / contradictoire — qualité ⭐⭐⭐⭐

| Obsolète / Contradiction | Détail |
|---|---|
| `plan-action-webhook-leads` (2026-05-16) | corrigé par `4855c91`, à valider en prod |
| `ai-content-service/concept.md` | 1 page WIP jamais implémentée |
| `kolenda/`, `videos/` | dossiers vides |
| `geo-promo-slide-header-plan` (2026-05-18) vs audit infra | "Cloudflare devant le domaine" vs "LiteSpeed reverse proxy, pas Cloudflare visible" — à clarifier |
| `audit-stalwart-email` vs `emailing/` | `RESEND_API_KEY` inutilisé vs Listmonk + Stalwart SMTP — choix archi à acter |

### 3.4 Index global — qualité 🟡

- ✅ READMEs dans `chat-assistant/`, `checkout-funnel/`, `emailing/`, `gtm/`, `tracking/`, `preparation/`, `plans/`.
- ❌ **Pas de `/docs/README.md`** racine.
- ❌ Pas de carte d'orientation par profil (PO, designer, dev).

---

## 4. Plan de conception & de développement

### 4.1 Vision centrale

`preparation/` + `plans/` :
- **5 principes** : composants découplés, absence signature, B2C/B2B, mobile-first, performance.
- **9 plans pages** (172–222 h) avec charges et ordre d'exécution justifié.

### 4.2 Roadmap par phases

| Phase | Docs-clés | État |
|---|---|---|
| **Phase 0** | `preparation/` (15 docs) | ✅ Complète |
| **Phase 1** | `audit/`, `plans/` (9 pages), `chat-assistant/`, `checkout-funnel/`, `tracking/`, `gtm/`, `media/`, `analytics/` | ✅ Majorité live |
| **Phase 2** | `emailing/`, `tracking-attribution/`, `analytics-insights/`, `reset-feature/` | 🔄 Spec ok, impl partiel |
| **Phase 3+** | `carrousels-meta/`, `ai-content-service/` | 📋 Concept |

### 4.3 Workflow

- **Déploiement** : `./bin/deploy.sh` (10 étapes, safety-net migration, rollback auto).
- **CI** : `ci.yml`, `security.yml`, `lighthouse.yml`.
- **Husky** : pre-commit (gitleaks, migration validator, lint-staged).
- **Branching** : non documenté explicitement. Master + features. Branch protection non visible.

### 4.4 TODOs ouvertes

| Doc | Action | Priorité |
|---|---|---|
| `audit-lead-webhook` | `OUTBOUND_WEBHOOK_URL` prod | P0 |
| `audit-lead-webhook` | Inline-contact webhook | P1 |
| `audit-lead-webhook` | Scanner step-1-abandon include inline | P2 |
| `audit-stalwart-email` | Corriger SPF | P0 |
| `audit-stalwart-email` | Redis password | P0 |
| `audit-stalwart-email` | `noreply@femiglow-maroc.com` | P1 |
| `audit-stalwart-email` | Remplacer `contact@femiglow.ma` mort | P1 |
| `geo-promo-slide-header-plan` | `/api/promo/location` | P1 |
| `geo-promo-slide-header-plan` | Tests staging | P1 |
| `snap-pixel-test-plan` | Mapper `lead_capture`, `contact_submit`, `newsletter_submit` | P2 |
| `AUDIT-2026-05` | `loading.tsx` + Suspense boundaries | P1 |
| `AUDIT-2026-05` | RBAC câblé | P2 |
| `AUDIT-2026-05` | Rate-limit Redis | P2 |
| `AUDIT-2026-05` | React Query admin | P3 |
| `AUDIT-2026-05` | Lazy-load chat widget | P3 |

---

## 5. Forces de la documentation

1. **Exhaustivité** ⭐⭐⭐⭐⭐ : aucun module majeur sans doc.
2. **Gabarit unifié** ⭐⭐⭐⭐⭐ : on sait toujours où aller dans un dossier mature.
3. **Audits datés & actionnels** ⭐⭐⭐⭐⭐ : chemins de fichiers, logs, fixes concrets.
4. **Intégration tests + runbooks** ⭐⭐⭐⭐ : chaque module a son `*-test-plan.md` ou `*-runbook.md`.
5. **Roadmap claire** ⭐⭐⭐⭐ : 9 plans pages, estimations, ordre justifié.
6. **Respect des principes fondateurs** ⭐⭐⭐⭐ : pas de dérive.

---

## 6. Faiblesses & opportunités

### 6.1 Pas de README racine ⚠ critique

`/docs/` contient 38 dossiers + 7 docs racine sans guide d'entrée. Nouveau dev = perdu pendant 1 heure.

→ **Action P0** : créer `/docs/README.md` avec index par domaine + par profil + roadmap synthétique.

### 6.2 Sprawl à la racine ⚠ medium

7 documents flottants à la racine (`AUDIT-2026-05.md`, `audit-lead-webhook-*`, `plan-action-webhook-*`, `runbook-deploy.md`, `snap-pixel-test-plan.md`, `audit-stalwart-email.md`, `geo-promo-slide-header-plan-*`).

→ Regrouper dans `docs/audits/` (sauf `AUDIT-2026-05.md` et `runbook-deploy.md` qui restent top-level).

### 6.3 Fichiers obsolètes / vides ⚠ medium

- `kolenda/` (vide).
- `videos/` (vide).
- `ai-content-service/concept.md` (1 page non implémentée).
- Doublon possible `plans/01-page-home-baseline.md` vs `plans/01-page-home.md`.

→ Archiver dans `docs/_archived/` ou supprimer.

### 6.4 Pas de marqueurs de statut ⚠ minor

Recommandation : ajouter un front-matter à chaque doc majeur :
```yaml
---
status: 🔴 concept | 🟡 en-cours | 🟢 complet | ⚪ archivé
last-update: 2026-05-18
owner: équipe-tracking
---
```

### 6.5 Pas de convention de nommage stricte ⚠ minor

- Numérotation `00-` → `99-` OK dans plupart des dossiers.
- Mais : tirets vs underscores incohérents (`admin-config` vs `component_media_system` n'existe pas → en réalité tout est en tirets, OK).
- Plans `01-page-home.md` vs `01-page-home-baseline.md` : doublon ou évolution ?

### 6.6 Pas de versioning uniforme ⚠ minor

- `preparation/` v1.0 déclaré.
- `emailing/` M0-M1-PROGRESS.
- Autres : aucun.

### 6.7 Pas de liens hypertexte entre dossiers ⚠ medium

`plan-action-webhook-leads` et `audit-lead-webhook` traitent le même sujet mais ne se référencent pas mutuellement.

### 6.8 Pas de diagrammes Mermaid / PlantUML ⚠ minor

Tout en MD pur. ASCII art occasionnel (`audit-lead-webhook` lignes 183–227). Mermaid faciliterait certaines pages (orchestrateur chat, dispatcher tracking, checkout wizard).

---

## 7. Recommandations

### P0 — sous 1 semaine
1. **Créer `/docs/README.md`** (proposition complète déjà rédigée dans le rapport d'analyse — voir `09-roadmap-recommandations.md` §7).
2. **Trancher les 3 audits critiques mai 2026** :
   - Webhooks → vérifier `OUTBOUND_WEBHOOK_URL` configuré en prod.
   - Stalwart email → SPF + Redis + noreply@.
   - Geo-promo → tester staging Cloudflare ou choisir Option C (IP geolocation interne).

### P1 — sous 1 mois
3. **Regrouper les 7 docs racine** : créer `docs/audits/` + `docs/plans-action/` (laisser `AUDIT-2026-05.md` et `runbook-deploy.md` au top).
4. **Archiver / supprimer** : `kolenda/`, `videos/`, `ai-content-service/concept.md`.
5. **Ajouter statut + last-update + owner** sur tous les docs Phase 1+ (~ 30 fichiers).

### P2 — sous 3 mois
6. **Convention de nommage** documentée dans `/docs/README.md`.
7. **Versioning uniforme** : table de versions dans chaque doc "complet".
8. **Liens croisés systématiques** : chaque audit cite son plan d'action, chaque plan cite son audit.
9. **Mermaid pour 5 schémas-clés** : chat orchestrator, tracking dispatcher, checkout wizard, webhook flow, lead funnel.
10. **CI doc** : workflow GitHub Actions qui vérifie l'absence de liens morts + cohérence des dates.

---

## 8. Plan de conception & dev — verdict

> Le projet dispose d'un plan de conception et de dev **rare en qualité et profondeur** pour un projet privé.

- **Couverture** : ~95 % des modules sont documentés de spec à runbook.
- **Maturité** : Phase 0 (préparation) complète. Phase 1 (implémentation core) à ~85 % en spec, ~65 % en code. Phase 2 (emailing, attribution avancée) en cours. Phase 3 (B2B, carrousels Meta auto) en concept.
- **Capacité à industrialiser** : très haute, à condition d'investir dans l'index racine + gouvernance Phase 2.

### Maturité par domaine (résumé)

| Domaine | Spec | Impl | Tests | Runbook | Verdict |
|---|---|---|---|---|---|
| Chat | ✅ | ✅ | ✅ | ✅ | mature |
| Checkout | ✅ | ✅ | ✅ | ✅ | mature |
| Tracking | ✅ | ✅ | ✅ | ✅ | mature |
| GTM | ✅ | ✅ | ✅ | ✅ | mature |
| Media | ✅ | ✅ | ✅ | ✅ | mature |
| Analytics | ✅ | 🔄 | ⚠ | ⚠ | en cours |
| Email | ✅ | 🔄 | ⚠ | 🔄 | en cours (P0 infra) |
| Webhooks leads | ✅ | 🔴 | 📋 | 📋 | plan validé, valider en prod |
| Geo-promo | ✅ | 🔴 | 📋 | 📋 | plan validé, à coder |
| Compliance / RGPD | ✅ | 🔄 | ⚠ | 🔄 | en cours |
| Reset feature | ✅ | 🔄 | ⚠ | 🔄 | en cours |
| B2B | 📋 | ❌ | ❌ | ❌ | concept |

---

## 9. Scorecard documentation

| Critère | Score |
|---|---|
| Exhaustivité | 9 / 10 |
| Gabarit reproductible | 9 / 10 |
| Datation | 8 / 10 |
| Index / navigation | 5 / 10 (pas de README racine) |
| Maintenance (obsolescence) | 7 / 10 |
| Diagrammes | 5 / 10 (peu de Mermaid) |
| Plan de conception | 9 / 10 |
| Plan de dev | 8 / 10 |
| Runbooks opérationnels | 9 / 10 |
| Liens croisés | 6 / 10 |
| **Global** | **7,5 / 10** |
