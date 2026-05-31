# Retrieval routing — Hybrid retriever

> Spec de l'ADR‑002. Routing intent‑based, FAQ gateway invisible, RAG enrichi, tool calls structurés.

## Vue d'ensemble du retrieval

```
   user msg + intent
        │
        ▼
   ┌────────────────────────┐
   │  Retrieval router      │  retrieval-router.ts
   │  decide(intent, ctx)   │
   └────────┬───────────────┘
            │
   ┌────────┴────────────────────────┐
   ▼                                 ▼
   FAQ gateway                       Tools + RAG routing
   (intent → faq match cosine > 0.85)
   │                                 │
   ├─ match → serve scripted         │
   │                                 │
   └─ no match ──────────────────────┘
                  ▼
              tools[] + rag chunks
                  ▼
              LLM stream
```

## 1. FAQ gateway

Court‑circuit serveur **avant** l'appel LLM.

```
async function tryFaqGateway(text, intent, language): Promise<FaqMatch | null>
  if !env.CHAT_FAQ_GATEWAY_ENABLED: return null
  
  embedding = await embedQuery(text)
  
  candidates = SELECT *, 1 - (question_embedding <=> $1) AS sim
               FROM chat_faq_entry
               WHERE enabled = true
                 AND language = $2
                 AND (intent_hint IS NULL OR intent_hint = $3)
               ORDER BY question_embedding <=> $1
               LIMIT 3
  
  top = candidates[0]
  if !top: return null
  if top.sim < top.threshold: return null
  
  return {
    entry: top,
    score: top.sim,
    scriptedReply: top.scripted_reply
  }
```

Si `tryFaqGateway()` retourne un match → orchestrator stream la `scripted_reply`, persiste comme tour normal avec `meta.source = 'faq'`, **n'appelle pas le LLM**.

## 2. Routing intent → mécanismes

Décision : quels mécanismes activer pour ce message ?

| Intent | RAG | Tools utilisés | Notes |
|---|---|---|---|
| `pricing` | ✅ | `get_product`, `search_faq` | Tool obligatoire (factuel) |
| `objection-price` | ✅ | `get_product` | + argumentaire RAG témoignages |
| `objection-doubt` | ✅ | `search_faq` | Activer social proof |
| `purchase-intent` | ✅ | `get_product`, `get_delivery_info` | Préparer lead form |
| `order-status` | ❌ | `get_order_status` | Tool only (privacy) |
| `shipping` | ⚠️ fallback | `get_delivery_info` | Tool prioritaire |
| `b2b` | ✅ | none | Push lead form B2B |
| `callback-request` | ❌ | none | Push lead form |
| `social-proof` | ✅ | `search_faq` | RAG témoignages |
| `comparison` | ✅ | `get_product`, `search_faq` | |
| `routine` | ✅ | `search_faq` | RAG narratif |
| `ingredient` | ✅ | `get_product`, `search_faq` | |
| `support` | ✅ | none | Escalade Care |
| `frustration` | ❌ | none | Désescalade + lead |
| `after-hours` | ❌ | none | Lead form rappel J+1 |
| `greeting` | ❌ | none | Réponse warm + suggest |
| `misc` | ✅ | none | RAG general fallback |

## 3. Tool calls — exécution

```
async function execTools(tools: ToolName[], context): Promise<ToolResult[]>
  results = []
  for tool in tools:
    if tool not in env.CHAT_TOOL_ALLOWLIST: continue
    
    schema = toolRegistry[tool].inputSchema
    params = extractParams(context, schema)  # LLM-suggested ou rule-based
    
    if not params: continue  # missing required params
    
    try:
      result = await Promise.race([
        toolRegistry[tool].handler(params),
        timeoutMs(2000)
      ])
      results.push({ tool, status: 'ok', result })
      log(toolCallLog, status: 'ok', ...)
    except Timeout:
      results.push({ tool, status: 'timeout' })
      log(toolCallLog, status: 'timeout', ...)
    except Error as e:
      results.push({ tool, status: 'error', error: e.message })
      log(toolCallLog, status: 'error', ...)
  
  return results
```

Note importante : sur les providers qui supportent les `tools[]` natifs (OpenAI, Anthropic, Mistral), on **expose aussi** les tools au LLM pour qu'il puisse en appeler d'autres au tour suivant. Le routing pré‑LLM ne fait que **pré‑charger** les tools évidents pour l'intent.

## 4. RAG enrichi

### Récupération (existant + extension audience filter)

```
async function retrieveRag(query, language, topK=4, audience='all')
  embedding = await embedQuery(query)
  
  rows = SELECT chunk.*, 1 - (emb.vector <=> $1) AS sim
         FROM chat_knowledge_chunk chunk
         JOIN chat_knowledge_embedding emb ON emb.chunk_id = chunk.id
         JOIN chat_knowledge_source src ON src.id = chunk.source_id
         WHERE src.enabled = true
           AND src.language = $2
           AND (src.audience = 'all' OR src.audience = $3)
         ORDER BY emb.vector <=> $1
         LIMIT $4 * 3   # over-fetch pour re-rank
  
  reranked = rerank(rows, query)  # heuristique existante
  return reranked.slice(0, topK)
```

### Auto‑sync KB

Cron `cron-kb-sync` (quotidien 02:00 UTC) :

```
# Produits
products = SELECT * FROM products WHERE deleted_at IS NULL
for product in products:
  for lang in ['fr', 'ar', 'ar-MA']:
    md = generateProductMd(product, lang)
    rawHash = sha256(md)
    
    existing = SELECT id FROM chat_knowledge_source
               WHERE id IN (
                 SELECT source_id FROM chat_knowledge_origin
                 WHERE entity_type = 'product' AND entity_id = $1
               ) AND language = $2
    
    if existing AND existing.raw_hash = rawHash:
      continue  # idempotence, pas de re-embedding
    
    sourceId = upsertKnowledgeSource({
      kind: 'snippet',
      label: f'Produit {product.slug} ({lang})',
      language: lang,
      audience: 'all',
      raw_hash: rawHash,
      ...
    })
    
    chunks = splitMarkdown(md)
    insertChunks(sourceId, chunks)
    
    embeddings = await embedTexts(chunks.map(c => c.content))
    insertEmbeddings(chunks, embeddings)
    
    upsertOrigin({ source_id: sourceId, entity_type: 'product', entity_id: product.slug, raw_hash: rawHash })

# Villes (idem mais sur delivery_cities)
# Promos (idem mais sur promo_codes, vague V7)

# Purge orphelins
DELETE FROM chat_knowledge_origin
WHERE entity_id NOT IN (SELECT slug FROM products)
  AND entity_type = 'product'
```

### Template Markdown produit (extrait)

```markdown
# {product.nameFr}
- Prix : {product.priceMad} dh
- Prix de référence : {product.anchorMad} dh
- Slug : {product.slug}
- Catégorie : {product.category}
- Public : {product.audience}

## Composition
{product.compositionFr}

## Bénéfices
{product.claimsFr}

## Routine d'utilisation
{product.usageFr}

## FAQ rapide
- Halal ? {product.halalFr}
- Convient peau sensible ? {product.sensitiveSkinFr}
```

Génération AR/AR‑MA : traduction soit (a) via champs DB pré‑remplis (`nameAr`, `compositionAr`), soit (b) via tool LLM dédié `translate(text, targetLang)` la première fois puis cache.

## 5. Re‑rank heuristique (conservé)

```
function rerank(rows, query):
  keywords = extractKeywords(query, minLength=4)
  
  for row in rows:
    boost = 0
    for kw in keywords:
      if kw in row.content.lower():
        boost += 0.05
    if row.content.length > 1500:
      boost -= 0.03
    row.finalScore = row.sim + boost
  
  return sortBy(rows, 'finalScore', desc)
```

## 6. Assemblage du contexte LLM

```
function buildContext(intent, toolResults, ragChunks, language):
  context = []
  
  if toolResults:
    context.push('### Données structurées')
    for tr in toolResults:
      if tr.status == 'ok':
        context.push(f'#### {tr.tool}\n{formatJson(tr.result)}')
      elif tr.status == 'timeout':
        context.push(f'#### {tr.tool}\n_indisponible_')
  
  if ragChunks:
    context.push('### Extraits de la base de connaissance')
    for i, chunk in enumerate(ragChunks):
      context.push(f'[{i+1}] {chunk.metadata.label} ({chunk.metadata.url or "interne"})\n{chunk.content}')
  
  return context.join('\n\n')
```

Ce contexte est inséré dans le system prompt **après** l'instruction de base.

## 7. Métriques & observabilité

Chaque requête persiste :
- `chat_message.meta.retrievalStrategy` : `'rag' | 'tool' | 'hybrid' | 'faq-bypass' | 'canned-bypass'`
- `chat_message.meta.ragHits` : `[{chunkId, score, label}]`
- `chat_message.meta.toolsUsed` : `['get_product', ...]`
- `chat_tool_call_log` : 1 ligne par tool appelé
- Event `retrieval_completed` avec breakdown latences

Dashboard :
- % de messages servis par chaque stratégie.
- Latence p95 par stratégie.
- Tool error rate par tool.
- KB freshness (dernière sync par origine).

## 8. Garde‑fous

| Risque | Mesure |
|---|---|
| Tool timeout bloque LLM | Promise.race(tool, 2s) ; LLM informé que data indisponible |
| LLM invente paramètres tool | Tool retourne `{found: false, did_you_mean: [...]}` |
| Tool exfiltre marge / coût | Output schema Zod whitelist champs publics uniquement |
| RAG ressort chunks obsolètes | KB freshness monitoring + alerte si sync > 26 h |
| FAQ gateway faux positif | Logging + sondage `👍/👎` ; calibrage seuil par entrée |
| Provider non supporté tools | Détection auto au boot, fallback RAG-only transparent |

## 9. Tests

- Unit : routage intent → tools/RAG (matrice complète).
- Unit : tool handlers individuels (mocked DB).
- Integration : pipeline complet RAG-only / Tool-only / Hybrid.
- E2E : conversation produit avec tools + RAG.
- Property : fuzz tool inputs (Zod doit toujours valider ou rejeter).

Voir [`12-tests/`](../12-tests/).
