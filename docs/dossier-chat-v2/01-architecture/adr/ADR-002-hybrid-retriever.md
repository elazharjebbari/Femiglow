# ADR‑002 — Hybrid retriever (RAG + tool calls)

| Champ | Valeur |
|---|---|
| **Statut** | proposed |
| **Date** | 2026‑05‑13 |
| **Décideurs** | PO, tech‑lead, ops |
| **Ticket** | CHA‑311, CHA‑312, CHA‑315 |
| **Remplace** | rien — extension du RAG actuel |

## Contexte

Aujourd'hui, le retrieval du chat repose uniquement sur RAG pgvector ([`rag/service.ts:198‑216`](../../../apps/web/src/lib/chat/rag/service.ts)). Limites majeures :

1. **Pas de données live** : prix, stocks, délais de livraison, statuts de commande sont figés en chunks Markdown (s'ils sont ingestés tout court).
2. **Pas de sync** : le catalogue `products` (DB) et les 430 villes `delivery_cities` ne sont jamais ingérés. Résultat : taux de réponses « la maison ne diffuse pas » estimé à 25‑40 % sur les questions catalog.
3. **Tools function‑calling absents** : aucun outil typé n'est exposé au LLM, donc impossible de demander dynamiquement « prix du pack ? » avec garantie factuelle.
4. **Pas de gestion promo ni suivi commande** : le futur tracking livraison Sendit n'a pas de point d'entrée.

## Décision

Adopter une **stratégie hybride** : RAG conservé pour le contenu narratif (routine, ingrédients, témoignages) **+** tool calls typés pour les données structurées et live (prix, livraison, promo, tracking). Un **router pré‑LLM intent‑based** décide quels mécanismes activer.

```
   intent ──► routing decision ──┬─► RAG seul          (ingredient, routine, social-proof)
                                  ├─► Tool seul         (order-status, check_promo)
                                  ├─► Tool + RAG        (pricing, comparison, purchase-intent)
                                  └─► RAG fallback      (misc, frustration)
```

**Outils initiaux (Vague V5)** :
- `get_product(slug)` → données catalog public
- `get_delivery_info(city)` → ETA + tarif
- `search_faq(query)` → wrapper RAG (permet au LLM de relancer un RAG ciblé)

**Outils différés (Vague V7, dépendent du backend)** :
- `check_promo(code)`
- `get_order_status(orderNumber, email)` — auth par email

**Auto‑sync KB** (Vague V3) :
- Cron quotidien `02:00 UTC` : génère fiches Markdown FR/AR/AR‑MA depuis `products` et `delivery_cities`.
- Idempotence par `rawHash` (re‑embedding seulement si contenu changé).
- Table `chat_knowledge_origin` trace `entityType + entityId → sourceId` pour purge.

## Alternatives considérées

### Alt A — « RAG auto‑sync seul »
- ✅ Pas de complexité tool calls
- ❌ Latence info (cron 24 h) inacceptable pour stocks/promos flash
- ❌ Bruit RAG (430 villes × 3 langues = 1 290 chunks dédiés livraison)
- ❌ Impossible de répondre « ma commande où en est ? »

### Alt B — « Function calling seul »
- ✅ Tout en temps réel
- ❌ Latence 2× (tour 1 + tool + tour 2)
- ❌ Support hétérogène par provider (Mistral OK, Ollama variable, DeepSeek custom)
- ❌ Faible sur contenu narratif (témoignages, conseils routine)

### Alt C — « Hybrid adopté »
- ✅ Le meilleur de chaque mode selon l'intent
- ✅ Fallback gracieux (si tool down → RAG)
- ✅ Multi‑provider tolérant (si tools non supportés → RAG fallback)
- ⚠️ Complexité orchestrateur, plus de surface à tester

## Conséquences

### Positives
- Taux « ne diffuse pas » : 30 % → < 3 %.
- Précision factuelle prix / livraison : ≥ 98 % (vs ~65 % estimé).
- Latence moyenne stable car 60 % des cas servis par RAG (rapide) ou tool simple.
- Foundation pour V7 (`get_order_status`).

### Négatives
- Tools demandent rigueur : Zod schema strict, timeout 2 s, audit log obligatoire.
- Hallucination de paramètres : LLM peut inventer un slug. Mitigation : tool retourne `{found: false, did_you_mean: [...]}`.
- Surface de sécurité élargie : chaque tool = un point d'attaque potentiel → allowlist obligatoire.

### Neutres
- Le RAG existant n'est pas touché, juste enrichi automatiquement.
- `providerRouter` + breaker existants restent inchangés.

## Garde‑fous & sécurité

| Risque | Mesure |
|---|---|
| Tool exfiltrate marge ou coût | Schéma Zod sortie **whitelist** les champs (jamais `costMad`, `marginPct`) |
| Tool boucle / timeout | `Promise.race(tool, timeout 2s)` ; LLM informé de l'échec |
| Provider sans support tools | Détection auto au boot → fallback RAG transparent |
| Drift KB ↔ DB | Cron sync + alerte Sentry si dernière sync > 26 h |
| Énumération `get_order_status` | Auth email obligatoire ; rate‑limit 5 req/min/IP |
| Allowlist | `CHAT_TOOL_ALLOWLIST=get_product,get_delivery_info,search_faq` |

## Métriques de succès

- Réponses contenant un prix correct (audit 100 msg / mois) : ≥ 98 %
- Tool call success rate : ≥ 99 %
- Tool call p95 latency : ≤ 300 ms
- Coverage : ≥ 95 % des questions catalog répondues factuellement

## Notes

- L'ordre `RAG + Tool` ou `Tool + RAG` n'a pas d'impact fonctionnel : les deux sont rejoués au LLM dans le system prompt.
- Le tool `search_faq` est en réalité un wrapper du RAG, exposé au LLM pour qu'il puisse relancer une recherche ciblée si la première passe RAG ne donne pas satisfaction. C'est une forme de **RAG agentique léger**.
