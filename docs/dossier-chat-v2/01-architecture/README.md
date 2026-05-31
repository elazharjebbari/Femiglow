# Architecture

> Vue à 3 niveaux de zoom : contexte (qui parle à quoi), composants (briques internes), pipeline (chronologie d'un message).

---

## Fichiers de cette section

| Fichier | Niveau | Rendu | Usage |
|---|---|---|---|
| [`system-context.puml`](system-context.puml) | Contexte (C4 niveau 1) | PlantUML | Comprendre les acteurs externes |
| [`component-diagram.puml`](component-diagram.puml) | Composant (C4 niveau 2/3) | PlantUML | Comprendre les blocs internes & dépendances |
| [`pipeline-sequence.puml`](pipeline-sequence.puml) | Séquence | PlantUML | Suivre un message du clic à la réponse |
| [`tech-stack.yaml`](tech-stack.yaml) | Inventaire | YAML | Liste exhaustive des techno + versions + raisons |
| [`adr/`](adr/) | Décisions | Markdown | Architecture Decision Records |

---

## Principes architecturaux

1. **Pipeline linéaire avec sorties précoces** — chaque étape peut court‑circuiter en cas d'erreur. Pas de magie cachée.
2. **Stateless côté LLM** — l'historique est rejoué à chaque tour, pas de session côté provider.
3. **Idempotence partout** — toutes les opérations critiques (ingest KB, persist message, tool call) peuvent être ré‑exécutées sans corruption.
4. **Boundary types par Zod** — entrée et sortie de toute frontière (HTTP, tool, LLM) validées.
5. **Multi‑driver DB** — mémoire (tests) + Postgres (prod), même code applicatif.
6. **Observability‑first** — chaque message émet ≥ 1 event KPI, chaque tool call est loggé, chaque erreur stack est capturée.
7. **Kill‑switches granulaires** — chaque feature majeure a un flag env pour rollback instantané.

---

## Dépendances externes

| Service | Rôle | Criticité | Fallback |
|---|---|---|---|
| OpenAI API | LLM principal + embeddings | Haute | Anthropic / Mistral via `providerRouter` |
| Anthropic API | LLM secondaire | Moyenne | Mistral |
| Postgres / Neon | Persistance | Critique | memoryStore (dev/test uniquement) |
| Sentry | Monitoring erreurs | Moyenne | Logs serveurs |
| Plausible | Analytics web | Faible | Custom event store |
| Sendit (futur) | Tracking colis | Moyenne | Page tracking manuelle |

---

## Schéma de zonage (boundaries)

```
                      ┌─── PUBLIC ──────────────────┐
                      │                              │
   Visiteur ──HTTPS──►│  /api/chat/*  (no auth)     │
                      │  middleware CSP + rate limit│
                      └──────────┬───────────────────┘
                                 │
                      ┌──────────▼───────────────────┐
                      │  Orchestrator (server only)  │
                      │  ┌──────────────────────┐    │
                      │  │ Intent · Retrieval · │    │
                      │  │ Charter · Tools ·    │    │
                      │  │ LLM · Lead-decision  │    │
                      │  └──────────────────────┘    │
                      └──────────┬───────────────────┘
                                 │
              ┌──────────────────┼──────────────────────────────┐
              ▼                  ▼                              ▼
       ┌─────────────┐    ┌──────────────┐              ┌──────────────┐
       │  Postgres   │    │  Providers   │              │  Webhooks    │
       │  (Drizzle)  │    │  (OpenAI…)   │              │  (n8n/CRM)   │
       └─────────────┘    └──────────────┘              └──────────────┘

                      ┌─── ADMIN ─────────────────────┐
                      │                                │
   Staff ──Cookie────►│  /admin/* (iron-session)      │
                      │  /api/admin/chat/* (RBAC)     │
                      └────────────────────────────────┘
```

---

## Points d'extension prévus

| Extension | Mécanisme | Impact downstream |
|---|---|---|
| Nouvel intent | Ajouter ligne `intent-taxonomy.csv` + dataset + recompute centroïdes | Lead‑decision rules peut nécessiter mise à jour |
| Nouvel outil (tool call) | Créer handler + Zod schema + ajouter à `chat_tool` table | Adapter providers (OpenAI/Anthropic) reçoivent schéma auto |
| Nouvelle source KB | Admin POST /api/admin/chat/sources | Cron sync prend en compte au prochain run |
| Nouvelle langue | Étendre `lang/detect.ts` + ajouter colonne `body_<lang>` aux tables `canned_pair`, `instructions` | Tests A11y direction RTL/LTR à valider |
| Nouveau provider LLM | Implémenter adapter `providers/<name>.ts` + ajouter à `providerRouter` | Charter filter et humanize fonctionnent agnostiquement |

---

## Ce que ce dossier ne couvre PAS

- La gestion fine de la **migration DB** (cf. [`02-data/migrations-plan.md`](../02-data/migrations-plan.md))
- Le **détail des contrats API** (cf. [`03-backend/api-contracts.yaml`](../03-backend/api-contracts.yaml))
- Les **schémas Zod** précis (cf. code existant `lib/chat/contracts.ts`)
