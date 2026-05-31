# Backend

> Pipeline orchestrator, services métier, contrats API. Cette section est l'oracle d'implémentation : un dev qui n'a jamais vu le projet doit pouvoir coder à partir d'ici.

## Fichiers

| Fichier | Audience | Quoi |
|---|---|---|
| [`intent-detection.md`](intent-detection.md) | Backend, NLP | Spec cascade régex++ / embeddings / LLM |
| [`retrieval-routing.md`](retrieval-routing.md) | Backend | Hybrid retriever, RAG enrichi, FAQ gateway |
| [`tools-catalog.yaml`](tools-catalog.yaml) | Backend, Sécurité | Catalogue des tools avec schémas Zod |
| [`canned-engine.md`](canned-engine.md) | Backend | Logique canned + continuité LLM |
| [`api-contracts.yaml`](api-contracts.yaml) | Backend, Frontend | OpenAPI 3.1 des routes publiques et admin |
| [`error-handling.md`](error-handling.md) | Backend, Ops | Stratégie d'erreurs, retries, fallback |

## Principes backend

1. **Pipeline linéaire avec sorties précoces** — chaque étape peut court‑circuiter (canned > faq > tool > rag > llm).
2. **Pas de magie cachée** — chaque décision est journalisée dans `chat_message.meta`.
3. **Validation aux frontières uniquement** — Zod à l'entrée HTTP, sortie tool, retour LLM JSON. Pas de re‑validation interne.
4. **Server‑only par défaut** — les modules `lib/chat/services/*` sont `import 'server-only'` pour éviter fuites client.
5. **Idempotence** — toute opération critique (ingest, persist, tool call) tolère la ré‑exécution.

## Architecture en couches

```
   ┌───────────────────────────────────────────────────┐
   │  HTTP layer  (Next.js route handlers)             │
   │  /api/chat/*, /api/admin/chat/*, /api/cron/*      │
   └──────────────────────┬────────────────────────────┘
                          │
   ┌──────────────────────▼────────────────────────────┐
   │  Application services (orchestration)             │
   │  orchestrator.ts, canned-engine.ts, session.ts    │
   └──────┬──────────┬──────────┬───────────┬──────────┘
          │          │          │           │
   ┌──────▼─────┐ ┌─▼─────┐ ┌──▼──────┐ ┌──▼─────────┐
   │ Intent     │ │ Retrieval │ Tools  │ Providers   │
   │ cascade    │ │ (RAG/FAQ) │ catalog│ router      │
   └────────────┘ └───────────┘ ────────┘ └────────────┘
          │           │             │          │
   ┌──────▼───────────▼─────────────▼──────────▼──────┐
   │  Persistence (Drizzle repos + memoryStore)       │
   └──────────────────────────────────────────────────┘
```

## Files de modules à créer ou étendre

| Module | Path proposé | Type | Wave |
|---|---|---|---|
| Intent cascade | `lib/chat/services/intent-cascade.ts` | nouveau | V2 |
| Intent embedding | `lib/chat/services/intent-embedding.ts` | nouveau | V5 |
| Retrieval router | `lib/chat/services/retrieval-router.ts` | nouveau | V5 |
| FAQ gateway | `lib/chat/services/faq-gateway.ts` | nouveau | V6 |
| Canned engine | `lib/chat/services/canned-engine.ts` | nouveau | V4 |
| Theme service | `lib/chat/services/theme-service.ts` | nouveau (suggestions) | V4 |
| Tools registry | `lib/chat/tools/registry.ts` | nouveau | V5 |
| Tools handlers | `lib/chat/tools/{get-product,get-delivery-info,search-faq}.ts` | nouveau | V5 |
| Health monitor | `lib/chat/services/health.ts` | nouveau | V5 |
| KB sync | `lib/chat/rag/sync-products.ts`, `sync-cities.ts` | nouveau | V3 |
