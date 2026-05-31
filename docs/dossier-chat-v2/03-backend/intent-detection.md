# Intent detection — cascade hybride

> Spec d'implémentation de l'ADR‑001. Niveau 1 actif dès la V2, niveau 2 dès la V5, niveau 3 optionnel V7.

## Signature publique préservée

```
async function detectIntent(text: string, opts?: DetectIntentOpts): Promise<IntentResult>

interface DetectIntentOpts {
  language?: 'fr' | 'ar' | 'ar-MA' | 'auto'
  previousIntent?: ChatIntent
  forceLLM?: boolean
}

interface IntentResult {
  intent: ChatIntent
  confidence: number
  alternatives: Array<{ intent: ChatIntent; score: number }>
  source: 'regex' | 'embedding' | 'llm'
  detectionMs: number
}
```

Conserve la signature de [`intent.ts`](../../../apps/web/src/lib/chat/services/intent.ts) actuel — la cascade est interne.

## Pseudo‑code de la cascade

```
function detectIntent(text, opts):
    start = now()
    
    # Niveau 1 — Régex++
    normalized = fuzzyNormalize(text, dictionary)    # Levenshtein <=2 sur mots > 5 char
    expanded   = expandSynonyms(normalized, synonymsTable)
    scores     = computeRegexScores(expanded, RULES)
    
    if opts.previousIntent in scores:
        scores[opts.previousIntent] += 0.5         # biais contextuel
    
    top, second = top2(scores)
    
    if top.score >= MIN_CONFIDENCE_SCORE:           # 2.0 par défaut
        return {
            intent: top.intent,
            confidence: top.score / max_possible,
            alternatives: [second],
            source: 'regex',
            detectionMs: now() - start
        }
    
    # Niveau 2 — Embeddings centroïdes
    if env.CHAT_INTENT_USE_EMBEDDINGS:
        embedding = await embedQuery(text)
        cosines   = computeCosines(embedding, centroids)  # 16 cosinus
        
        top, second = top2(cosines)
        
        if top.score >= env.CHAT_INTENT_EMBEDDING_THRESHOLD:  # 0.78
            
            # Niveau 3 — LLM mini (cas ambigus critiques)
            isCritical = top.intent in CRITICAL_INTENTS
            isAmbiguous = (top.score - second.score) < 0.05
            
            if env.CHAT_INTENT_USE_LLM_FALLBACK and isCritical and isAmbiguous:
                llmResult = await llmClassify(text, top.intent, second.intent)
                return {
                    intent: llmResult.intent,
                    confidence: llmResult.confidence,
                    alternatives: [...],
                    source: 'llm',
                    detectionMs: now() - start
                }
            
            return {
                intent: top.intent,
                confidence: top.score,
                alternatives: [second],
                source: 'embedding',
                detectionMs: now() - start
            }
    
    # Fallback ultime
    return {
        intent: 'misc',
        confidence: 0,
        alternatives: [],
        source: 'regex',
        detectionMs: now() - start
    }
```

## Constantes

| Constante | Valeur | Source |
|---|---|---|
| `MIN_CONFIDENCE_SCORE` | 2.0 | Hérité de [`intent.ts:78`](../../../apps/web/src/lib/chat/services/intent.ts) |
| `EMBEDDING_THRESHOLD` | 0.78 | env `CHAT_INTENT_EMBEDDING_THRESHOLD` |
| `LLM_AMBIGUITY_DELTA` | 0.05 | Constante (non env) |
| `CRITICAL_INTENTS` | `purchase-intent`, `frustration`, `b2b`, `callback-request` | Hardcodé |
| `FUZZY_MAX_DISTANCE` | 2 | Constante |
| `FUZZY_MIN_WORD_LENGTH` | 5 | Pour éviter sur‑correction |
| `MEMORY_CONTEXT_BIAS` | +0.5 | Continuation intent précédent |

## Fuzzy normalize (niveau 1)

Pipeline :
1. Lowercase + trim.
2. Remove diacritics (NFD normalize + remove combining marks) sauf darija script latin.
3. Pour chaque mot ≥ 5 caractères : chercher distance Levenshtein ≤ 2 dans le dictionnaire connu. Si match unique → remplacer.
4. Dictionnaire de référence : table `chat_intent_example` agrégée (mots distincts) + liste hardcodée des termes pivots (`commander`, `livraison`, `prix`, etc.).

Dépendance : `fastest-levenshtein@^1.0.16`.

Cas tests :
- `comamnder` → `commander` ✅
- `kifach` → inchangé (≤ 5 chars selon convention) ✅
- `lvraison` → `livraison` ✅
- `Bioderma` → inchangé (nom propre, pas dans le dict, distance trop grande) ✅

## Synonyms expansion

Table en mémoire `synonymsTable: Map<canonical, Set<variant>>` chargée au boot depuis fichier JSON :

```
{
  "prix": ["tarif", "coût", "montant", "ghali", "غالي", "thaman"],
  "livraison": ["expédition", "shipping", "tawsil", "توصيل", "lev'ya"],
  "commander": ["acheter", "prendre", "shri", "نشري", "tald-bo"]
}
```

Au runtime, chaque variant dans `text` est remplacé par sa canonical pour booster le matching régex.

## Niveau 2 — Embeddings centroïdes

### Calcul initial des centroïdes

Cron `cron-intent-recompute` (hebdomadaire) :

```
for intent in intents:
    examples = SELECT text FROM chat_intent_example
               WHERE intent = $1 AND deleted_at IS NULL
    if count(examples) < 5: continue  # pas assez de données
    
    vectors = await embedTexts(examples)  # batch
    centroid = mean(vectors)
    
    UPSERT INTO chat_intent_centroid
        (intent, language, vector, sample_count, updated_at)
    VALUES ($1, 'all', $centroid, count(examples), now())
    ON CONFLICT (intent) DO UPDATE SET ...
```

### Recherche au runtime

```
embedding = await embedQuery(text)  # 1 call ~50ms
cosines = SELECT intent, 1 - (vector <=> $embedding) AS sim
          FROM chat_intent_centroid
          ORDER BY vector <=> $embedding
          LIMIT 3
```

L'opérateur `<=>` est la **distance cosine** pgvector. `1 - distance` donne la similarité.

### Calibration

Dataset : `intent-dataset-sample.csv` étendu à 500 entrées en V1.

Procédure :
1. Pour chaque seuil `s` ∈ [0.70, 0.85] par pas de 0.01 :
   - Calculer précision et rappel par intent.
2. Choisir `s` maximisant le F1‑score moyen.
3. Permettre override par intent (table `chat_runtime_setting` avec key `intent.<name>.threshold`).

## Niveau 3 — LLM mini classifier

### Modèle recommandé

- Production : `claude-haiku-4-5` (latence ~250 ms, coût $0.80/M in).
- Fallback : `gpt-4o-mini` (latence similaire).
- Self‑hosted éventuel : `qwen2.5:7b` via Ollama (latence variable selon GPU).

### Prompt

```
SYSTEM:
Tu es un classifieur d'intention pour un chat e-commerce de cosmétiques marocains.
Tu reçois un message utilisateur et tu réponds en JSON strict.

INTENTS_AUTORISES:
- pricing : question sur le prix
- objection-price : prix jugé trop élevé
- objection-doubt : doute sur l'efficacité
- purchase-intent : volonté d'acheter
- order-status : suivi de commande
- shipping : livraison
- b2b : revente / partenariat pro
- callback-request : demande d'être rappelé
- frustration : mécontentement explicite

OUTPUT_FORMAT (JSON strict, pas de texte autour):
{
  "intent": "<nom>",
  "confidence": <0..1>,
  "reason": "<une phrase courte>"
}

USER:
Message: "{text}"
Historique récent (3 derniers tours):
{recent_history}

Top 2 candidats déjà identifiés par embeddings:
1. {top1.intent} (score {top1.score})
2. {top2.intent} (score {top2.score})

Tranche entre ces 2 candidats. Si aucun ne convient, retourne le plus proche.
```

### Garde‑fous

- Timeout 800 ms (sinon retour au top‑1 embedding).
- Retry max 1 fois.
- Parse JSON strict avec Zod ; si parse fail → top‑1 embedding.
- Rate limit : max 5 appels / minute / session (anti‑boucle).

## Persistance & observabilité

Pour chaque détection, on persiste :
- `chat_message.intent` = résultat
- `chat_message.meta.intentSource` = `'regex' | 'embedding' | 'llm'`
- `chat_message.meta.intentConfidence` = score normalisé 0..1
- `chat_message.meta.intentAlternatives` = top 2 alternatives
- `chat_message.meta.intentDetectionMs` = latence
- Event KPI `intent_detected` avec payload complet

Dashboard :
- Distribution des sources (régex %, embedding %, llm %).
- Précision par intent (audit hebdomadaire automatique sur 100 messages).
- Latence p50 / p95 par niveau.

## Tests

Voir [`12-tests/`](../12-tests/) — section "intent cascade".

Couvre :
- Régression sur 34 cas régex existants (intent.test.ts).
- 500 cas dataset annoté pour précision/rappel.
- Property‑based : fuzz random text → `detectIntent` ne crashe jamais.
- Latence : p95 < 150 ms (mesuré sur dataset).

## Notes d'implémentation

- Le module doit rester **stateless** (pas de cache interne) : la mise en cache éventuelle se fait au niveau de l'orchestrator si nécessaire.
- Les centroïdes sont chargés en RAM au boot du serveur (16 × 1536 floats = 24 KB, négligeable).
- En mode test (`memoryStore`), les centroïdes sont mockés via fixtures.
