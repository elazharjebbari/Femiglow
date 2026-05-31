# 04 — Recommandations & roadmap

Actions priorisées par sévérité × ROI × effort. Basées sur findings
[02-audit-critique.md](02-audit-critique.md) et gaps [03-adr-vs-realite.md](03-adr-vs-realite.md).

## Principe de priorisation

```
Priorité = (Sévérité × ROI) ÷ Effort

Sévérité : CRITIQUE=4, IMPORTANT=3, MOYEN=2, MINEUR=1
ROI       : Conversion/Sécurité=3, Qualité/Coût=2, DX/Obs=1
Effort    : <1j=1, 1-3j=2, 1sem=3, 2sem+=4
```

## Sprint Quick wins (5 jours)

Tickets qui apportent un gain immédiat avec effort minimal. À faire **avant tout autre
chantier**.

| # | Ticket | Sévérité | Effort | ROI | Description |
|---|--------|----------|--------|-----|-------------|
| 1 | **CHA-AUD-01** | C4 | 30 min | Sécurité ★★★ | Câbler `await billing.assertBudget()` dans `/api/chat/message/route.ts` avant streamReply |
| 2 | **CHA-AUD-02** | C5 | 30 min | UX ★★★ | Remplacer SSE `message_complete` par `chunk + end` dans `orchestrator.ts:332-342` + test |
| 3 | **CHA-AUD-03** | I4 | 30 min | Sécurité ★★ | Ajouter `rateLimit.consume('visitor', visitorId)` dans `/api/chat/message/route.ts` |
| 4 | **CHA-AUD-04** | I6 | 30 min | Coût ★★ | `ragService.retrieve({ topK: 4, minScore: 0.3 })` |
| 5 | **CHA-AUD-05** | I3 | 1 h | Qualité ★★★ | Forcer `threshold` dans tous les seeders FAQ + test régression |
| 6 | **CHA-AUD-06** | Mi3 | 15 min | DX ★ | Harmoniser commentaire vs default schema (FAQ threshold) |
| 7 | **CHA-AUD-07** | I1 | 1 j | Conversion ★★★ | Câbler hook checkout → `attributeConversion(sessionId, orderId)` |
| 8 | **CHA-AUD-08** | R1 | 0,5 j | UX admin ★★ | Persister user message **après** modération inbound (réordonner pipeline) |
| 9 | **CHA-AUD-09** | R4 | 30 min | KPI ★★ | Fixer `intentSource` à `'fallback'` quand vector ne match pas |

**Total** : ~3 jours dev + 1 jour QA = **~5 jours réels**, **9 bugs résolus**, dont 1 critique
fonctionnel (`attributeConversion` ouvert depuis l'audit 2026-05-17).

## Sprint Sécurité éditoriale (2 semaines)

Corriger les 2 bugs de filtre advisory qui livrent du contenu non modéré.

| # | Ticket | Sévérité | Effort | Description |
|---|--------|----------|--------|-------------|
| 10 | **CHA-AUD-10** | C2 | 1 sem | Buffer stream → moderate → yield (modération outbound bloquante) ou yield partiel + replace |
| 11 | **CHA-AUD-11** | M4 | 0,5 j (inclus dans CHA-AUD-10) | Charter-filter outbound bloquant aussi |
| 12 | **CHA-AUD-12** | R2 | 0,5 j | Exécuter modération inbound AUSSI sur branche FAQ gateway (orchestrator.ts:189-260) |

**Trade-off** : la modération outbound bloquante augmente la latence perçue (~300-800 ms
selon provider). Solution alternative : streamer chunk par chunk avec **modération
incrémentale** sur fenêtre glissante (plus complexe, ~2 sem).

## Sprint Observabilité (2 semaines)

Combler les gaps d'observabilité qui empêchent de mesurer les autres améliorations.

| # | Ticket | Sévérité | Effort | Description |
|---|--------|----------|--------|-------------|
| 13 | **CHA-AUD-13** | M1 | 1 sem | Auditer les 14 events non émis : émettre les nécessaires (`message_complete`, `chat_lead_webhook_sent`), retirer les obsolètes de l'enum |
| 14 | **CHA-AUD-14** | M2 | 2 j | Agréger P95 latency en fenêtre + exposer dans admin |
| 15 | **CHA-AUD-15** | I5 | 1 j | Tests unitaires `provider-router.ts` (breaker open/close, multi-provider fail, Redis down) |
| 16 | **CHA-AUD-16** | M5 / C6 | 1 sem | Unifier état breaker memory↔Redis (single source of truth) + tests multi-lambda |

## Sprint Fallback dégradé ADR-004 (3 semaines)

Implémenter au minimum les niveaux 2-3 pour transformer panne en lead capture.

| # | Ticket | Sévérité | Effort | Description |
|---|--------|----------|--------|-------------|
| 17 | **CHA-AUD-17** | C3 | 1 sem | `getServiceLevel()` + event `chat_service_level_changed` + page admin `/admin/chat/health` |
| 18 | **CHA-AUD-18** | C3 | 0,5 sem | Niveau 2 RAG_ONLY (tools désactivés, LLM continue) |
| 19 | **CHA-AUD-19** | C3 | 1 sem | Niveau 3 CANNED_ONLY (LLM coupé, canned + FAQ + lead form auto) |
| 20 | **CHA-AUD-20** | C3 | 0,5 sem | Niveau 4 STATIC (widget HTML + WhatsApp/tél quand DB down) |

**Note** : sans tools framework (C1), le niveau 2 RAG_ONLY ne change rien vs niveau 0. Si
décision de différer C1, fusionner niveaux 2 et 3.

## Sprint Cascade intent N3 (1 semaine)

| # | Ticket | Sévérité | Effort | Description |
|---|--------|----------|--------|-------------|
| 21 | **CHA-AUD-21** | I2 | 2 j | Dataset annoté 500 messages / 16 intents (Mechanical Turk ou interne) |
| 22 | **CHA-AUD-22** | I2 | 3 j | Implémenter niveau 3 LLM mini (Haiku) avec flag `CHAT_INTENT_USE_LLM_FALLBACK` |
| 23 | **CHA-AUD-23** | I2 | 1 j | Scorecard reproductible : precision/recall par intent, comparaison N1/N2/N3 |

## Sprint Tools framework ADR-002 (4 semaines)

Le chantier le plus lourd, mais aussi celui avec **le plus gros ROI conversion**. À découper :

| # | Ticket | Sévérité | Effort | Description |
|---|--------|----------|--------|-------------|
| 24 | **CHA-AUD-24** | C1 | 0,5 sem | Schemas Zod `Tool`, `ToolCall`, `ToolResult` + table `chat_tool_call_log` |
| 25 | **CHA-AUD-25** | C1 | 1 sem | Tool registry + dispatch + audit log + allowlist `CHAT_TOOL_ALLOWLIST` |
| 26 | **CHA-AUD-26** | C1 | 1 sem | Surface tools dans `ChatProvider.streamChat` (OpenAI + Anthropic prioritaires) |
| 27 | **CHA-AUD-27** | C1 | 0,5 sem | Tool `get_product(slug)` + tests |
| 28 | **CHA-AUD-28** | C1 | 0,5 sem | Tool `get_delivery_info(city)` + tests |
| 29 | **CHA-AUD-29** | C1 | 0,5 sem | Tool `search_faq(query)` + tests |

**Note prérequis** : avant de câbler les tools, il faut s'assurer que les données qu'ils
exposent sont fiables :
- `get_product` : `products` table à jour ✅
- `get_delivery_info` : `delivery_cities` table à jour ✅
- `search_faq` : embeddings FAQ correctement seedés (voir CHA-AUD-05)

## Sprint Sync auto KB (1 semaine)

Pré-requis pour atteindre `dontknow_rate <3 %`.

| # | Ticket | Sévérité | Effort | Description |
|---|--------|----------|--------|-------------|
| 30 | **CHA-AUD-30** | ADR-002 | 0,5 sem | Cron `sync-products` : génère MD FR/AR/AR-MA depuis `products` (idempotence par hash) |
| 31 | **CHA-AUD-31** | ADR-002 | 0,3 sem | Cron `sync-cities` : idem pour `delivery_cities` |
| 32 | **CHA-AUD-32** | ADR-002 | 0,2 sem | Table `chat_knowledge_origin` (trace KB ↔ source DB) + UI admin de monitoring |

## Roadmap consolidée (12 semaines)

```
Sem 1     ▓▓ Quick wins (9 tickets, 1 critique → 1 résolu)
Sem 2-3   ▓▓▓▓ Sécurité éditoriale (3 tickets, 1 critique → résolu)
Sem 4-5   ▓▓▓▓ Observabilité (4 tickets)
Sem 6-8   ▓▓▓▓▓▓ Fallback ADR-004 levels 2-4 (4 tickets, 1 critique → résolu)
Sem 9     ▓▓ Cascade intent N3 (3 tickets)
Sem 10-12 ▓▓▓▓▓▓ Tools framework + Sync KB (9 tickets, 1 critique → résolu)

→ 12 semaines, 32 tickets, 6 critiques → 4 résolus + 2 partiellement (C6 race, C1 tools partiels selon scope)
→ ADRs : ADR-003 ✅, ADR-001 ✅ (post sem 9), ADR-002 ✅ (post sem 12), ADR-004 ✅ (post sem 8)
```

## Quick ROI metrics — gains attendus

| Sprint | Gain principal | Métrique impactée | Delta attendu |
|--------|----------------|-------------------|---------------|
| Quick wins | Bugs prod corrigés | KPI conversion correct | + correction comptage |
| Sécurité éditoriale | Modération bloquante | Réduction risque légal | Qualitatif |
| Observabilité | KPI mesurables | Visibilité réelle | Prérequis autres sprints |
| Fallback ADR-004 | Uptime perçu | uptime 95 % → 99,5 % | +4,5 pts |
| Cascade intent | intent_accuracy | 73 % → 88-92 % | +15-19 pts |
| Tools + KB sync | useful_reply | 70 % → 90 % | +20 pts |

**Impact conversion globale** (×10 cible) :
- Sans sprints 5-6 (tools + KB) : conversion ne progressera que marginalement
- Avec tous les sprints : projection 0,03 % → 0,15-0,20 % (×5-7) sur 3 mois

## Décisions à prendre

Avant d'attaquer la roadmap, **3 questions stratégiques** à trancher :

### Q1. Implémenter ou abandonner ADR-002 (tools framework) ?

C'est le sprint le plus lourd (4 sem) mais c'est aussi **le levier #1 de conversion**.

**Options** :
- **A**. Implémenter complètement (4 sem) — atteindre les cibles ADR
- **B**. Implémenter partiellement (2 sem, juste `get_product` + `search_faq`) — bénéfice
  partiel mais infra prête pour extension
- **C**. Abandonner et investir dans une KB ultra-curated (1 sem) — moins de factualité mais
  faisable plus vite

Recommandation : **A** si la promesse "factualité ≥98 %" est business-critique ; sinon **B**.

### Q2. Conserver les 9 providers LLM ou consolider sur 2-3 ?

Le code maintient 9 adapters mais seul OpenAI a des tests. Maintenir 9 providers
= surcoût test + risque régression. Pour le besoin réel actuel (1 primaire + 1 fallback) :
2-3 suffisent.

Recommandation : **garder OpenAI + Anthropic + Gemini** (couvre 95 % cas), retirer le
reste (Qwen, DeepSeek, Zhipu, Azure-OpenAI rarement utilisés). Garder Ollama comme option
locale dev/edge.

### Q3. Verrouiller la définition de done avant phase 10 ?

Beaucoup de phases marquées ✅ ne tiennent pas la barre (dead code, ADR non implémentés).
**Avant d'attaquer phase 10**, formaliser DoD :
- Tests intégration (pas juste unit avec mocks)
- ADR conforme au code
- Pas de dead code en production
- KPI mesurables et exposés

## Annexe — Convention nommage tickets

Si tu adoptes la nomenclature `CHA-AUD-NN` proposée, on conserve la séquence existante
(`CHA-001` → `CHA-247` actuellement). Les `AUD-NN` distinguent les tickets issus de l'audit
2026-05-25 vs les tickets de phase 9.

Alternative : intégrer dans la phase 10 nascente avec une numérotation `CHA-250+`.

## Liens

- [README.md](README.md) — vue d'ensemble + fiche de bord
- [00-context-existant.md](00-context-existant.md) — synthèse docs antérieures
- [01-cartographie-code.md](01-cartographie-code.md) — état du code
- [02-audit-critique.md](02-audit-critique.md) — findings détaillés
- [03-adr-vs-realite.md](03-adr-vs-realite.md) — gaps ADR par ADR
