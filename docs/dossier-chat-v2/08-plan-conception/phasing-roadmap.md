# Phasing roadmap — Vagues V5 / V6 / V7

> Détail de chaque vague : objectifs, livrables, dépendances internes, critères acceptation.

## V5 — Wave Fondation (2026-05-13 → 2026-06-10, 4 semaines)

### Objectif central

**Le chat fonctionne en production, multilingue, capture des leads, fait de la conversion mesurable.**

### Lots V5

#### Lot V5.1 — Data & migrations (semaine 1)

**Livrables** :
- 11 migrations Drizzle (0017 à 0027) déployées.
- Seed CSV de `intent-dataset`, `canned-pairs`, `faq-entries`.
- Cron `kb-sync` opérationnel quotidien.

**Critères acceptation** :
- [ ] Toutes migrations rollback testées.
- [ ] Index `chat_message(session_id, created_at)` < 50 ms p95.
- [ ] Embeddings pgvector HNSW configurés.
- [ ] Seeds importés en staging.

#### Lot V5.2 — Intent detection cascade (semaine 1-2)

**Livrables** :
- `lib/chat/services/intent-detection.ts` avec cascade regex → embedding → LLM mini.
- Tests unitaires (matrice 50 examples par lang).
- Recompute centroïdes cron.

**Critères acceptation** :
- [ ] Accuracy ≥ 85% sur dataset audit.
- [ ] Latence p50 < 200 ms (regex hit).
- [ ] LLM mini classifier coûte < 0.0001 USD/call.

#### Lot V5.3 — Retrieval routing + tools (semaine 2)

**Livrables** :
- `lib/chat/services/retrieval-router.ts`.
- 3 tools V5 (`get_product`, `get_delivery_info`, `search_faq`).
- FAQ gateway opérationnel.

**Critères acceptation** :
- [ ] Tool success rate > 99% sur 1000 calls test.
- [ ] FAQ gateway sim threshold 0.85 mesuré OK.

#### Lot V5.4 — Canned engine + ephemeral continuity (semaine 2)

**Livrables** :
- `lib/chat/services/canned-engine.ts` complet.
- 12 paires canned seed FR/AR/AR-MA publiées.
- Workflow draft → review → published.

**Critères acceptation** :
- [ ] Suggestion clicked → canned servi en < 100 ms p95.
- [ ] Ephemeral note injectée si tours précédents canned.
- [ ] LLM continue le ton sans rupture.

#### Lot V5.5 — Orchestrator + SSE (semaine 2-3)

**Livrables** :
- `lib/chat/services/orchestrator.ts` complet.
- Streaming SSE avec 7 events canoniques.
- Error handling avec fallback graceful.

**Critères acceptation** :
- [ ] First token < 800 ms p50.
- [ ] Pas de 500 user-facing dans 1000 sessions test.
- [ ] Cancel mid-stream propre.

#### Lot V5.6 — Frontend chat panel (semaine 3-4)

**Livrables** :
- Toutes les composants `components/chat/*` (12+ composants).
- Store Zustand v2 + persist.
- `useLocalStream` pour canned.
- A11y WCAG AA pass.

**Critères acceptation** :
- [ ] Bundle initial < 8 kB.
- [ ] Panel ouvert < 400 ms.
- [ ] Storybook stories complètes (états × langues × LTR/RTL).
- [ ] Lighthouse a11y score 100.

#### Lot V5.7 — Admin chat-v2 (semaine 3-4)

**Livrables** :
- 12 pages admin `/dashboard/chat-v2/*`.
- CRUD intents, suggestions, FAQ, tools (sandbox), KB, leads.
- Filtres URL persistés.
- Health dashboard.

**Critères acceptation** :
- [ ] Yasmine peut publier une nouvelle suggestion sans dev.
- [ ] Karim peut triager 20 leads en < 5 min.
- [ ] Sandbox tool test fonctionne.

#### Lot V5.8 — Tests & observabilité (semaine 4)

**Livrables** :
- Test suite Jest unit + integration + Playwright E2E + ULTIMATE test.
- MSW handlers pour tous tools/endpoints.
- Sentry alerts configurées.
- Dashboards Grafana / Vercel Analytics.

**Critères acceptation** :
- [ ] Coverage ≥ 80% sur `lib/chat/*`.
- [ ] Test ULTIMATE valide la pipeline complète E2E.
- [ ] Tous KPI N1 capturés dans events.

## V6 — Wave Conversion (2026-06-10 → 2026-07-15, 5 semaines)

### Objectif central

**Maximiser la conversion via optimisations UX, contenu enrichi, A/B testing.**

### Lots V6

#### Lot V6.1 — A/B engine + 2 expériences (sem 1-2)

**Livrables** :
- Cookie-based A/B assignation.
- Exp 1 (greeting darija) + Exp 5 (launcher pulse).
- Dashboard expérience temps-réel.

#### Lot V6.2 — Enrichissement canned + FAQ (sem 1-3)

**Livrables** :
- +25 paires canned (total 37).
- +30 FAQ entries (total 48).
- Pages spécifiques (kit, shop, b2b, page produit individuel).

#### Lot V6.3 — Lead form intelligent (sem 2-3)

**Livrables** :
- Pre-fill phone/email/ville si disponible (cookie magasin).
- Validation phone Maroc + variantes (+212, 06, 07).
- LeadForm offert au bon moment (heuristique tunée).

#### Lot V6.4 — Mode anonyme RGPD (sem 3-4)

**Livrables** :
- Toggle "Discuter anonymement" en consent banner.
- Si actif : pas de persist (sessionStorage uniquement), pas d'event KPI nominatif.
- Documentation conformité.

#### Lot V6.5 — Métriques approfondies (sem 4-5)

**Livrables** :
- Dashboards Business + Editorial + Care fully featured.
- Email digest hebdo.
- Slack alerts.
- Attribution chat → order (jointure phone hash).

#### Lot V6.6 — Performance tuning (sem 4-5)

**Livrables** :
- Cache LRU agressif tools (TTL ajustés).
- Embedding cache pour requêtes répétées.
- Streaming SSE chunk batching côté serveur.
- First token < 600 ms p50 (vs 800 ms V5).

## V7 — Wave Avancée (2026-07-15 → 2026-09-15, 8 semaines)

### Objectif central

**Compléter la palette de tools, opérationnaliser le B2B, mode pro.**

### Lots V7

#### Lot V7.1 — Order status tool (sem 1-2)

**Livrables** :
- Intégration Sendit tracking API.
- Tool `get_order_status` avec auth email.
- Anti-énumération rate-limit 5/min/session.

#### Lot V7.2 — Promo engine (sem 2-3)

**Livrables** :
- Refactor `promo_codes` table avec règles.
- Tool `check_promo` avec validation conditions.
- Application de promo dans le panier (lien).

#### Lot V7.3 — B2B avancé (sem 3-5)

**Livrables** :
- LeadForm B2B avec champ "type établissement" + "volume mensuel".
- Workflow Care B2B séparé.
- Catalogue grossiste accessible via chat (lien protégé).

#### Lot V7.4 — Dark mode (sem 5-6)

**Livrables** :
- Tokens dark dans `design-tokens.yaml`.
- Toggle dans `ChatHeader`.
- Persistance via store.

#### Lot V7.5 — GrowthBook migration (sem 6-7)

**Livrables** :
- Migration de l'A/B engine vers GrowthBook self-hosted.
- 3 expériences supplémentaires.

#### Lot V7.6 — Voice optionnel (sem 7-8) [stretch]

**Livrables** (si temps) :
- Bouton "parler" pour input vocal (Web Speech API).
- Restreint mobile, opt-in.

## Gates entre vagues

### Gate V5 → V6

- [ ] NS conversion rate mesurée 14j ≥ 0.15% (50% objectif final).
- [ ] Service level 0/1 ≥ 95% du temps.
- [ ] Coût mensuel < 200 USD (budget 300 USD).
- [ ] Yasmine + Karim formés et autonomes.
- [ ] 0 incident P1 dans les 7 derniers jours.

### Gate V6 → V7

- [ ] NS conversion rate ≥ 0.25% (83% objectif).
- [ ] Au moins 1 expérience A/B gagnante shipped.
- [ ] Performance cibles V6 atteintes (first token < 600 ms).
- [ ] Care workflow B2B prêt.

### Ship final V7

- [ ] NS conversion rate ≥ 0.3%.
- [ ] Tous tools V7 en production.
- [ ] Dark mode dispo.
- [ ] Documentation finale publiée.
