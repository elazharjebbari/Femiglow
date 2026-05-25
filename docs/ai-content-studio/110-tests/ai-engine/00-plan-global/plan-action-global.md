# Plan d'action global — Batterie de tests AI Engine

**Version** : 1.0.0  
**Date** : 2026-05-25  
**Objectif** : Couverture de test ≥95% sur toutes les fonctionnalités AI Engine  
**Standard** : Enterprise-grade (Accenture, Cognizant, Capgemini)

---

## Vue d'ensemble

| Couche | Framework | Fichiers | Tests estimés | Priorité |
|---|---|---|---|---|
| **Vitest Unit** | Vitest 2.1 + jsdom | ~20 fichiers | ~250 tests | P0 |
| **Vitest RTL** | @testing-library/react | ~12 fichiers | ~150 tests | P0 |
| **MSW Contract** | MSW 2.x + Vitest | ~8 fichiers | ~80 tests | P1 |
| **Playwright E2E** | Playwright 1.48 | ~10 fichiers | ~120 tests | P0 |
| **Scénarios métier E2E** | Playwright serial | ~5 fichiers | ~50 tests | P1 |
| **Total** | | **~55 fichiers** | **~650 tests** | |

---

## Phases d'exécution

### Phase 1 — Tests unitaires nœuds LangGraph (P0)
| Étape | Fichier test | Module testé | Tests |
|---|---|---|---|
| 1.1 | `nodes/parse-brief.test.ts` | parseBriefNode | 12 |
| 1.2 | `nodes/enrich-knowledge.test.ts` | enrichKnowledgeNode | 10 |
| 1.3 | `nodes/enrich-trends.test.ts` | enrichTrendsNode | 8 |
| 1.4 | `nodes/generate-script.test.ts` | generateScriptNode | 15 |
| 1.5 | `nodes/generate-caption.test.ts` | generateCaptionNode | 12 |
| 1.6 | `nodes/generate-images.test.ts` | generateImagesNode | 10 |
| 1.7 | `nodes/generate-video.test.ts` | generateVideoNode | 8 |
| 1.8 | `nodes/generate-voiceover.test.ts` | generateVoiceoverNode | 8 |
| 1.9 | `nodes/compose.test.ts` | composeNode | 10 |
| 1.10 | `nodes/quality-check.test.ts` | qualityCheckNode | 12 |
| 1.11 | `nodes/moderate.test.ts` | moderateNode | 10 |
| 1.12 | `nodes/human-review.test.ts` | humanReviewNode | 8 |
| 1.13 | `nodes/generate-variants.test.ts` | generateVariantsNode | 8 |

### Phase 2 — Tests unitaires infrastructure (P0)
| Étape | Fichier test | Module testé | Tests |
|---|---|---|---|
| 2.1 | `graph/routing.test.ts` | 4 fonctions de routage | 24 |
| 2.2 | `providers/circuit-breaker.test.ts` | CircuitBreaker | 12 |
| 2.3 | `providers/retry.test.ts` | RetryPolicy | 10 |
| 2.4 | `providers/cost-tracker.test.ts` | CostTracker | 8 |
| 2.5 | `providers/selector.test.ts` | ProviderSelector | 10 |
| 2.6 | `config/engine-config.test.ts` | getEngineConfig | 8 |
| 2.7 | `trends/scorer.test.ts` | scoreTrends | 12 |
| 2.8 | `trends/collectors.test.ts` | collecteurs | 8 |
| 2.9 | `bridge/content-studio-bridge.test.ts` | bridgeToContentStudio | 10 |
| 2.10 | `jobs/repository.test.ts` | CRUD jobs | 10 |

### Phase 3 — Tests MSW contract API (P1)
| Étape | Fichier test | Endpoint | Tests |
|---|---|---|---|
| 3.1 | `api/generate.contract.test.ts` | POST /generate | 12 |
| 3.2 | `api/health.contract.test.ts` | GET /health | 6 |
| 3.3 | `api/jobs.contract.test.ts` | GET /jobs, POST /review | 10 |
| 3.4 | `api/trends.contract.test.ts` | GET /trends | 8 |
| 3.5 | `api/knowledge.contract.test.ts` | CRUD knowledge | 10 |
| 3.6 | `api/config.contract.test.ts` | GET config/* | 8 |
| 3.7 | `api/publish.contract.test.ts` | POST /publish | 8 |
| 3.8 | `api/analytics.contract.test.ts` | GET /analytics | 6 |

### Phase 4 — Tests RTL composants UI (P0)
| Étape | Fichier test | Composant | Tests |
|---|---|---|---|
| 4.1 | `GenerationProgress.test.tsx` | Pipeline progress | 12 |
| 4.2 | `GenerationResult.test.tsx` | Résultat génération | 15 |
| 4.3 | `dashboard.test.tsx` | Page dashboard | 12 |
| 4.4 | `create-page.test.tsx` | Page création | 18 |
| 4.5 | `trends-page.test.tsx` | Page tendances | 10 |
| 4.6 | `config-page.test.tsx` | Page configuration | 12 |
| 4.7 | `knowledge-page.test.tsx` | Page knowledge base | 12 |
| 4.8 | `analytics-page.test.tsx` | Page analytics | 10 |
| 4.9 | `graph-page.test.tsx` | Page graph viewer | 8 |
| 4.10 | `review-panel.test.tsx` | Panel HITL review | 10 |
| 4.11 | `publish-section.test.tsx` | Section publication | 8 |
| 4.12 | `sidebar-nav.test.tsx` | Navigation sidebar AI Engine | 6 |

### Phase 5 — Tests E2E Playwright opérateur (P0)
| Étape | Fichier spec | Scénario | Tests |
|---|---|---|---|
| 5.1 | `ai-engine-navigation.spec.ts` | Navigation entre pages | 8 |
| 5.2 | `ai-engine-dashboard.spec.ts` | Dashboard health + providers | 6 |
| 5.3 | `ai-engine-create-post.spec.ts` | Génération post Instagram | 12 |
| 5.4 | `ai-engine-create-reel.spec.ts` | Génération reel vidéo | 10 |
| 5.5 | `ai-engine-create-carousel.spec.ts` | Génération carrousel | 10 |
| 5.6 | `ai-engine-trends.spec.ts` | Veille et filtres | 8 |
| 5.7 | `ai-engine-config.spec.ts` | Configuration onglets | 8 |
| 5.8 | `ai-engine-knowledge.spec.ts` | Knowledge CRUD | 8 |
| 5.9 | `ai-engine-analytics.spec.ts` | Analytics KPIs | 6 |
| 5.10 | `ai-engine-graph.spec.ts` | Graph viewer nodes | 6 |

### Phase 6 — Scénarios métier complexes E2E (P1)
| Étape | Fichier spec | Scénario métier | Tests |
|---|---|---|---|
| 6.1 | `scenario-golden-path.spec.ts` | Brief → Generate → Review → Approve → Publish | 15 |
| 6.2 | `scenario-error-recovery.spec.ts` | Échec provider → fallback → retry → succès | 10 |
| 6.3 | `scenario-hitl-reject.spec.ts` | Generate → Review → Reject → Regenerate → Approve | 8 |
| 6.4 | `scenario-trend-to-publish.spec.ts` | Veille → Créer depuis tendance → Publier | 8 |
| 6.5 | `scenario-knowledge-enrichment.spec.ts` | Ajouter doc → Embed → Générer → Vérifier RAG | 8 |

---

## Critères de qualité

| Métrique | Seuil minimum | Cible |
|---|---|---|
| Tests passants | 100% | 100% |
| Couverture lignes | 80% | 90% |
| Couverture branches | 70% | 85% |
| Couverture fonctions | 85% | 95% |
| Temps exécution Vitest | < 30s | < 15s |
| Temps exécution Playwright | < 5min | < 3min |
| Flakiness rate | < 2% | 0% |

---

## Dépendances et prérequis

| Prérequis | Responsable | Statut |
|---|---|---|
| Service staging actif (port 8012) | Ops | ✅ |
| DB migrée (9 tables AI Engine) | DBA | ✅ |
| Knowledge base seedée (98 chunks) | Data | ✅ |
| API key OpenAI configurée | Config | ✅ |
| Auth storageState Playwright valide | Test | ✅ |
| MSW handlers pour OpenAI/Postiz | Test | À créer |
