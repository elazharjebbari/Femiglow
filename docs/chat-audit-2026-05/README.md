# Audit chat FemiGlow — 2026-05-25

Audit complet du système de chat FemiGlow (UI widget, orchestration backend, providers LLM,
RAG, lead capture, admin console, observabilité). Réalisé en 4 étapes :

1. **Synthèse des docs existantes** — `dossier-chat-v2/` (vision cible 2026-05-13),
   `chat-assistant/` (archive v1, status implémentation), 4 audits épars dans `docs/audit/`.
2. **Cartographie du code** — `apps/web/src/lib/chat/`, `apps/web/src/components/chat/`,
   `apps/web/src/app/api/chat/`, `apps/web/src/app/admin/chat/`, schema DB.
3. **Audit critique indépendant** — relecture du code clé sans regarder les docs, puis
   confrontation avec les promesses ADR.
4. **Recommandations** — priorisées par sévérité × ROI.

## Verdict express

- **Happy path solide** : streaming SSE, intent regex, RAG simple, lead capture, admin console
  → matures et testés (~40 % coverage, 65 fichiers `.test.ts`).
- **Promesses ADR partiellement tenues** : sur 4 ADRs cibles, **1 ok** (ADR-003 canned/FAQ),
  **2 partiels** (ADR-001 cascade intent, ADR-004 fallback 5 niveaux),
  **1 non implémenté** (ADR-002 tools framework).
- **6 findings CRITIQUES** identifiés (dont 3 bugs prod immédiats, 3 gaps fonctionnels), **8 IMPORTANTS**, **6 MOYENS**, **5 MINEURS**.
- **Dette `attributeConversion`** (audit 2026-05-17 #1) **toujours ouverte** → KPI conversion sous-comptabilisé.
- **Promesse `tools[]` (ADR-002)** : absente du code, table `chat_tool_call_log` inexistante.
  Conséquence : la factualité prix/livraison ≥98 % cible ADR n'est pas atteignable
  sans implémentation.
- **Conversion funnel actuel** : ~0,029 % (cible v2 = 0,3 %, soit ×10). Les deux leviers
  les plus rentables (suggestions pills + tools/KB sync) **ne sont pas câblés**.

## Comment lire ce dossier

| Ordre | Fichier | Pour qui | Durée |
|-------|---------|----------|-------|
| 1 | [00-context-existant.md](00-context-existant.md) | PO, tech-lead | 10 min |
| 2 | [01-cartographie-code.md](01-cartographie-code.md) | Tech-lead, devs | 8 min |
| 3 | [02-audit-critique.md](02-audit-critique.md) | Tech-lead, sécurité, devs | 15 min |
| 4 | [03-adr-vs-realite.md](03-adr-vs-realite.md) | PO, tech-lead, archi | 5 min |
| 5 | [04-recommandations.md](04-recommandations.md) | PO, PM, tech-lead | 10 min |

**Total** : ~50 min de lecture pour une vue complète. La fiche de bord ci-dessous suffit
pour décider en 2 min.

## Fiche de bord — État du système

### Architecture (✅ stable)

```
visiteur → POST /api/chat/message
              ↓
         middleware (rate-limit IP/session)
              ↓
         orchestrator.ts (pipeline SSE)
              ↓
   ┌──────────┼──────────┬──────────┐
   ▼          ▼          ▼          ▼
sanitize    intent      FAQ       RAG retrieve (pgvector HNSW)
PII         (regex      gateway        ↓
            + vector)   (0.85         provider-router
                        threshold)         ↓
                                      OpenAI/Anthropic/Gemini/Mistral
                                      Qwen/DeepSeek/Zhipu/Ollama/Azure
                                           ↓ stream chunks
                                      humanize.client (jitter 30-50ms)
                                           ↓
                                      lead-decision (10 règles → form offer)
                                           ↓
                                      persist message + KPI events
```

### Couverture fonctionnelle vs cible

| Composant | Cible ADR | État | Note |
|-----------|-----------|------|------|
| Intent cascade 3 niveaux | regex + embeddings + LLM mini | regex + embeddings | 2/3 — niveau 3 absent |
| Hybrid retriever (RAG + tools) | RAG + 5 tools | RAG seul | **Tools framework absent** |
| Auto-sync KB depuis DB | Cron 02:00 produits + villes | URL refresh only | Cron `sync-products` absent |
| Canned pairs visuelles | Table + UI admin | OK | Threshold default 0.85 vs commentaire 0.60 (dette) |
| FAQ gateway invisible | Embedding match → bypass LLM | OK | Threshold à valider |
| Fallback 5 niveaux | Level 0→4 + service-level event | Level 0→1 only | **Levels 2/3/4 absents** |
| Multi-provider (9) | 9 providers + breaker | OK | `provider-router.ts` sans tests |
| Moderation (in+out) | Bloquant | Inbound bloquant, outbound advisory | **C2 — toxique livré au client** |
| Budget guard | `assertBudget` au runtime | Cron horaire only | **C4 — `assertBudget` jamais appelé** |
| KPI conversion attribution | Hook checkout → session | Dead code | **`attributeConversion` jamais appelé** |

### Tests

| Couche | Fichiers | Tests | Coverage estimée |
|--------|----------|-------|------------------|
| Services | 55 | 28 | 51 % |
| Components UI | 34 | 14 | 41 % |
| Repositories | 15 | 4 | 27 % |
| Providers LLM | 9 | 1 | 11 % |
| API Routes | 13 | 3 | 23 % |
| Admin UI | 25 | 0 | 0 % |
| **Total** | **163** | **65** | **~40 %** |

⚠️ `provider-router.ts` (152 lignes, critique) : aucun test.

### Conversion funnel — état vs cible

| Étape | Actuel | Cible v2 | Bloqueur |
|-------|--------|----------|----------|
| P0 open_rate | 12 % | 18 % | Pas d'icône animée |
| P1 engagement | 35 % | 60 % | **Suggestions pills absentes** |
| P2 useful_reply | 70 % | 95 % | **Tools + KB enrichie absents** |
| P3 strong_intent | 8 % | 15 % | Regex faible sur edge cases |
| P4 lead_capture | 45 % | 65 % | Form live, pre-fill manquant |
| P5 lead_to_order | 22 % | 30 % | Pas de SLA tracking callback |
| **Multiplier** | **0,029 %** | **0,3 %** | **×10 attendu** |

## Top 3 actions immédiates (détail dans [04-recommandations.md](04-recommandations.md))

1. **[C2 + C4 + C5] Corriger 3 bugs pipeline immédiats** — outbound moderation post-stream,
   budget guard non appelé, SSE event non contractuel. **Effort : 1 jour.**
2. **[`attributeConversion`] Câbler le hook checkout → session** — KPI conversion incorrect
   depuis audit 2026-05-17. **Effort : 1 jour.**
3. **[ADR-004 levels 2-3] Implémenter dégradation RAG_ONLY + CANNED_ONLY** — sans ça, toute
   panne provider = perte sèche de leads. **Effort : 2 semaines.**

## Métadonnées audit

- **Date** : 2026-05-25
- **Code commit audité** : `779f134` (master, branche post fix migration 0073)
- **Audit précédent** : `docs/audit/chat-systeme-messagerie-audit-detaille-2026-05-17.md` (8 jours avant)
- **Méthode** : lecture indépendante code + confrontation docs ADR + grille sévérité C/I/M/Mi
- **Périmètre** : `apps/web/src/{lib,components,app}/chat/**` + `apps/web/src/lib/db/schema.ts` (sections `chat_*`)
- **Hors périmètre** : tests E2E Playwright (sondage uniquement), GTM tracking events,
  legal/RGPD purge cron, mobile UX detailed audit (couvert par `chat-assistant/21-mobile-ux-plan.md`).
