# 03 — ADRs cibles vs réalité du code

Confrontation systématique des 4 ADRs (vision cible, `dossier-chat-v2/01-architecture/adr/`)
au code livré au `779f134`.

## Synthèse en une ligne

| ADR | Promesse | Statut | Confiance |
|-----|----------|--------|-----------|
| ADR-001 | Cascade intent 3 niveaux | **Partiel** (2/3 niveaux) | ⚠️ Précision 73 % vs 92 % cible |
| ADR-002 | Hybrid retriever (RAG + tools) | **Non implémenté** | ❌ Promesse non tenue |
| ADR-003 | Canned pairs + FAQ gateway | **OK avec dette** (threshold) | ✅ Fonctionne |
| ADR-004 | Fallback 5 niveaux | **Partiel** (2/5 niveaux) | ❌ Levels 2-4 absents |

## Détail ADR par ADR

### ADR-001 — Cascade intent 3 niveaux

**Promesse** : Détection intent en cascade du moins coûteux au plus précis.
- N1 : Regex++ (fuzzy + synonymes + biais contextuel), < 1 ms, zéro coût
- N2 : Embeddings (cosine vs 16 centroïdes), si score N1 < 2
- N3 : LLM mini (Haiku / 4o-mini), si top-2 vs top-1 < 0,05 (~5 % trafic)

**Cibles** : intent_accuracy 73 % → 92 %, recall purchase-intent ≥95 %, coût LLM
additionnel <1 %.

**Réalité du code** :

| Niveau | Code | Statut |
|--------|------|--------|
| N1 regex | `intent.ts:detectIntent` + tests 34 cases | ✅ |
| N2 embeddings | `intent-vector.ts:classifyByEmbedding`, seuil 0,55 | ✅ |
| N3 LLM mini | **Absent** | ❌ |
| Flag `CHAT_INTENT_USE_LLM_FALLBACK` | **Absent** | ❌ |
| Cron `intent-recompute` hebdo | `intent-recompute.ts:49` (existe, idempotent) | ✅ |
| Dataset annoté 500 msg / 16 intents | **Absent** | ❌ |
| Mesure precision/recall par intent | **Absente** (audit manuel uniquement) | ❌ |

**Gap fonctionnel** :
- Niveau 3 absent — cas ambigus tombent en `misc` ou intent dominant régex
- Précision actuelle ~73 % (audit manuel, N inconnu) reste loin des 92 % cible
- Pas de scorecard reproductible → impossible de valider gains après N3

**Effort pour atteindre cible** : 1 semaine code N3 + 2 jours dataset + 1 jour scorecard.

---

### ADR-002 — Hybrid retriever (RAG + tools)

**Promesse** : Routage intent-based vers RAG seul / tools seuls / tool+RAG / RAG fallback.

**Tools initiaux** (V5) :
- `get_product(slug)` — fiche produit en BDD
- `get_delivery_info(city)` — tarif + ETA livraison
- `search_faq(query)` — récupère FAQ entry pertinente

**Tools différés** (V7) :
- `check_promo(code)` — validité promo
- `get_order_status(orderNumber, email)` — statut commande

**Sync auto KB** (V3, cron 02:00) : génération MD FR/AR/AR-MA depuis `products` +
`delivery_cities` (idempotence par hash). Tracé via table `chat_knowledge_origin`.

**Cibles** : dontknow_rate 30 % → <3 %, factual_accuracy ≥98 %, tool_call_success ≥99 %.

**Réalité du code** :

| Élément | Code | Statut |
|---------|------|--------|
| `tools[]` dans `ChatStreamRequest` | **Absent** (`types.ts:32-50`) | ❌ |
| Surface tools dans `ChatProvider.streamChat` | **Absent** | ❌ |
| Fichier `tools/registry.ts` | **Absent** | ❌ |
| Handlers `get_product` / `get_delivery_info` / `search_faq` | **Absents** | ❌ |
| Table `chat_tool_call_log` | **Absent** dans `schema.ts` | ❌ |
| Allowlist `CHAT_TOOL_ALLOWLIST` | **Absente** | ❌ |
| Sync auto KB `sync-products.ts` | **Absent** | ❌ |
| Sync auto KB `sync-cities.ts` | **Absent** | ❌ |
| Table `chat_knowledge_origin` | **Absent** | ❌ |
| RAG simple (pgvector HNSW) | `rag/service.ts` | ✅ |
| Refresh URLs `freshness=volatile` | `kb-sync.ts` | ✅ |

**Gap fonctionnel** : **TOUT** sauf le RAG simple.

**Impact métier** :
- Questions prix / livraison / promo / statut commande → réponse via RAG (KB textuelle
  artisanale, non synchronisée DB)
- `dontknow_rate` réel ~30-40 % (vs cible <3 %)
- `useful_reply_rate` plafond ~70 % (vs cible 95 %)
- Levier P2 du funnel non activé → conversion globale plafond

**Effort pour atteindre cible** : 3-4 semaines (schemas Zod tools + dispatch + audit log +
2 tools P0 + 2 crons sync + tests).

---

### ADR-003 — Canned pairs + FAQ gateway

**Promesse** : Deux mécanismes complémentaires pour court-circuiter le LLM.

1. **Canned pairs visuelles** :
   - Table `chat_canned_pair` (key, page_pattern, labels FR/AR/AR-MA, scripted_reply, CTA)
   - Flux : clic pill → `POST /api/chat/canned-pair/:key` → message user + scripted reply
     + streaming local typewriter
   - CMS admin (`/admin/chat/suggestions`)
   - Versioning immuable (`chat_canned_pair_version`)
   - Continuité conversationnelle : note système éphémère au LLM
     ("tours N-2/N-1 = script maison, assumer véracité")

2. **FAQ gateway invisible** :
   - Table `chat_faq_entry` (question_canonical, question_embedding, scripted_reply,
     intent_hint, threshold)
   - Flux : user tape → embed → cosine vs FAQ (seuil 0,85) → bypass LLM si match

**Cibles** : suggestion_click_rate 35 %, canned_share 40 %, coût LLM −30 %.

**Réalité du code** :

| Élément | Code | Statut |
|---------|------|--------|
| Table `chat_canned_pair` | `schema.ts:674` | ✅ |
| Table `chat_canned_pair_version` | `schema.ts:731` | ✅ |
| Service `canned-pair-service.ts` | `services/canned-pair-service.ts` | ✅ |
| Repo `canned-pair.ts` | `repos/canned-pair.ts` | ✅ |
| Route `GET /api/chat/canned-pair` | `app/api/chat/canned-pair/route.ts` | ✅ |
| Admin UI suggestions | `app/admin/chat/suggestions/{page,new,[id]}` | ✅ |
| Hook front `use-canned-pair` | `components/chat/hooks/use-canned-pair.ts` | ✅ |
| Streaming local typewriter | À vérifier côté `humanize.client.ts` | ? |
| Table `chat_faq_entry` | `schema.ts` | ✅ |
| Service FAQ gateway | branche FAQ dans `orchestrator.ts:189-260` | ✅ |
| Repo `faq.ts` | `repos/faq.ts:matchByEmbedding` | ✅ |
| Default threshold cohérent | **Non** (0,85 default vs 0,60 commentaire — I3) | ⚠️ |
| Note système éphémère "tour canned" | **Absent** dans `pickInstructionByLang` | ❌ |

**Gap fonctionnel** : **fonctionne** mais avec 2 risques :
- Threshold default 0,85 silencieusement bloquant (I3) → FAQ jamais déclenchée si seeders
  oublient le champ
- Continuité conversationnelle promise via note système éphémère **non implémentée** →
  après un canned, le LLM ignore que le tour précédent était scripté

**Risques cachés** :
- R2 (audit critique) — FAQ gateway court-circuite la modération inbound (toxique scripted-
  reply servi)

**Effort pour atteindre cible parfaite** : 1 jour (forcer threshold + injecter note
système).

---

### ADR-004 — Multi-provider fallback 5 niveaux

**Promesse** : Politique de dégradation explicite avec transitions automatiques + audit.

| Niveau | État système | Comportement |
|--------|--------------|--------------|
| 0 | Nominal | Provider primary + tools + RAG + FAQ + canned + budget OK |
| 1 | Failover provider | Bascule sur secondary si breaker OPEN (3 fails / 30s) |
| 2 | RAG_ONLY | Tools désactivés ; LLM continue avec RAG ; canned fallback |
| 3 | CANNED_ONLY | LLM coupé ; canned + FAQ + lead form automatique |
| 4 | STATIC | Widget message statique + lien WhatsApp/tél (DB indisponible) |

Garde-fous :
- Allowlist tools par provider (Gemini : pas de `check_promo` ; Ollama/Qwen/DeepSeek :
  tools partiels)
- Budget mensuel : >100 % → CANNED_ONLY auto
- Event `chat_service_level_changed` émis à chaque transition
- Page admin `/admin/chat/health` avec état temps réel

**Cible** : uptime perçu ≥99,5 %, mode CANNED_ONLY = opportunité lead capture (pas
erreur 500).

**Réalité du code** :

| Élément | Code | Statut |
|---------|------|--------|
| Niveau 0 nominal | `orchestrator.ts` (pipeline standard) | ✅ |
| Niveau 1 failover provider | `provider-router.ts:121-148` (multi-provider) | ✅ |
| Breaker circuit (3 fails / 30s) | `provider-router.ts:77-98` + Redis | ✅ avec race C6 |
| Niveau 2 RAG_ONLY | **Absent** | ❌ |
| Niveau 3 CANNED_ONLY | **Absent** | ❌ |
| Niveau 4 STATIC | **Absent** | ❌ |
| `getServiceLevel()` | **Absent** | ❌ |
| Event `chat_service_level_changed` | **Absent** dans enum events | ❌ |
| Page admin `/admin/chat/health` | **Absente** (`/admin/live-health` existe mais générique) | ❌ |
| Allowlist tools par provider | N/A (tools absents) | ❌ |
| Budget guard runtime | `assertBudget` déclaré, jamais appelé (C4) | ❌ |
| `budget-watch` cron horaire | `services/budget-watch.ts` | ✅ |

**Gap fonctionnel** : la **promesse principale d'ADR-004 — transformer une panne en lead
capture — n'est pas tenue**. Quand tous providers chat sont KO :
- `providerRouter.choose` throw
- Orchestrator yield `event: error`
- Widget bloqué
- **Aucun fallback canned-only** n'attrape les leads

**Effort pour atteindre cible** : 2 semaines.

---

## Tableau récapitulatif des gaps

| Composant | Promesse | Effort à combler |
|-----------|----------|------------------|
| Niveau 3 cascade intent (LLM mini) | +20 % précision intent | 1 sem |
| Dataset annoté 500 msg intent | Scorecard reproductible | 2 j |
| Tools framework complet | Factualité ≥98 % | 3-4 sem |
| Sync auto KB depuis DB (cron) | dontknow <3 % | 1 sem |
| Note système "tour canned" | Continuité conversationnelle | 0,5 j |
| Niveau 2 RAG_ONLY | Continuité partielle pendant panne | 0,5 sem |
| Niveau 3 CANNED_ONLY | Lead capture pendant panne | 1 sem |
| Niveau 4 STATIC | Front survit à DB down | 0,5 sem |
| `getServiceLevel()` + event | Observabilité dégradation | 1 j |
| Page admin `/admin/chat/health` | Pilotage opérations | 2 j |
| Budget guard runtime | Protection coût immédiate | 30 min |
| **TOTAL effort estimé** | | **~7-9 semaines** |

## Hiérarchie d'impact ROI

```
ROI maximum (engagement + conversion) :
  1. Tools framework (P2 useful_reply +20-25 %)
  2. Sync auto KB (P2 useful_reply +10-15 %)
  3. Note système canned (continuité narrative)

ROI moyen (qualité + observabilité) :
  4. Cascade intent N3 (recall purchase-intent)
  5. Dataset annoté + scorecard
  6. Niveau 3 CANNED_ONLY (uptime perçu)

ROI faible (mais low effort) :
  7. Budget guard runtime (30 min)
  8. Niveau 4 STATIC (gestion DB down)
  9. `getServiceLevel()` + admin health (observabilité)
```

Voir [04-recommandations.md](04-recommandations.md) pour la séquence d'exécution proposée.
