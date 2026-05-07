# 09 — Base de connaissance & RAG

> *Sources, ingestion, chunking, embeddings, retrieval, re-ranking, fraîcheur*

---

## 1. Pourquoi un RAG

L'agent doit répondre **fidèlement** sur des informations précises
(prix, COD, composition, livraison, ouverture) et **richement** sur
des informations narratives (rituel, maison, journal). Sans RAG,
les modèles hallucinent ou répondent à côté.

Le RAG joue trois rôles :

1. **ground truth** sur les champs critiques (prix, conditions),
2. **richesse** sur les contenus narratifs (Journal, fiches),
3. **traçabilité** : chaque réponse cite ses sources, auditables
   par l'admin.

## 2. Sources prises en charge

| Type        | Loader                                        | Notes                                                  |
| ----------- | --------------------------------------------- | ------------------------------------------------------ |
| `url`       | `fetch` + cleanup HTML (turndown vers markdown) | Pages publiques du site                                |
| `markdown`  | direct                                        | Snippets éditoriaux                                    |
| `pdf`       | `pdfjs-dist` (extract texte)                  | Fiches composition, conditions générales               |
| `docx`      | `mammoth.js`                                  | Documents internes maison                              |
| `faq`       | structurée Q/A                                | Questions fréquentes éditoriales                       |
| `snippet`   | texte libre                                   | « ground truth » courts (prix, COD)                    |

## 3. Pipeline d'ingestion

```
Source (admin click) ─► Loader ─► Cleaner ─► Splitter ─► Embedder ─► Upsert pgvector
                                                            │
                                                            ▼
                                                      Comptage tokens
                                                      Coût ingestion
```

### 3.1 Loader

`lib/chat/rag/loaders/` — un fichier par type. Tous retournent un
`{ raw: string; meta: SourceMeta }`.

```ts
export async function loadUrl(url: string): Promise<LoaderResult> {
  const res = await fetch(url, { headers: { 'User-Agent': 'FemiGlow-RAG/1.0' } });
  const html = await res.text();
  const md = htmlToMarkdown(html, { keepHeadings: true, dropNav: true, dropFooter: true });
  return { raw: md, meta: { url, fetchedAt: new Date().toISOString() } };
}
```

### 3.2 Cleaner

Supprime menus / footers / scripts / boilerplate. Conserve les
ancres (`<h1>` → `# title {#anchor}`) pour pointer plus tard.

### 3.3 Splitter

```ts
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 700,        // tokens approximatifs
  chunkOverlap: 80,
  separators: ['\n\n## ', '\n\n### ', '\n\n', '\n', '. ', ' '],
});
```

Réglages :
- chunks de **500-900 tokens** (compromis précision / contexte).
- chevauchement **80 tokens** pour préserver la continuité.
- séparation prioritaire par titres de section.
- chaque chunk porte **titre parent**, **URL**, **anchor**, **lastUpdatedAt**.

### 3.4 Embedder

Le provider d'embedding est sélectionné via `providerRouter.choose({ role: 'embedding' })`.
Par défaut : OpenAI `text-embedding-3-small` (1536 dimensions).
Alternatives configurables : Gemini `text-embedding-004` (768),
local Ollama `nomic-embed-text` (768).

> Si l'admin change d'embedder, **un reindex global est nécessaire**.
> Le système le détecte (mismatch `embedderModel`) et propose
> automatiquement le reindex.

### 3.5 Upsert pgvector

```sql
INSERT INTO chat_knowledge_chunk (id, source_id, ordinal, content, content_hash, tokens, metadata)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (source_id, ordinal) DO UPDATE
   SET content = EXCLUDED.content,
       content_hash = EXCLUDED.content_hash,
       tokens = EXCLUDED.tokens,
       metadata = EXCLUDED.metadata,
       created_at = NOW()
WHERE chat_knowledge_chunk.content_hash IS DISTINCT FROM EXCLUDED.content_hash;

INSERT INTO chat_knowledge_embedding (id, chunk_id, embedder_provider, embedder_model, dim, vector)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (chunk_id, embedder_model) DO UPDATE SET vector = EXCLUDED.vector;
```

Idempotent : un chunk inchangé n'est pas réembedé. Économie réelle.

## 4. Retrieval

Au moment d'une requête :

```ts
export async function retrieve(opts: { text: string; language: Language; k?: number }): Promise<RagHit[]> {
  const k = opts.k ?? 6;
  const queryEmbed = await embedder.embed(opts.text);

  // 1. recherche vectorielle
  const candidates = await db.execute(sql`
    SELECT c.id, c.content, c.metadata, e.vector <=> ${queryEmbed} AS distance,
           s.label AS source_label, s.kind AS source_kind, s.freshness, s.language
    FROM chat_knowledge_embedding e
    JOIN chat_knowledge_chunk c ON c.id = e.chunk_id
    JOIN chat_knowledge_source s ON s.id = c.source_id
    WHERE s.enabled = TRUE
      AND s.language IN (${opts.language}, 'fr')   -- fallback FR
    ORDER BY e.vector <=> ${queryEmbed}
    LIMIT ${k * 3}
  `);

  // 2. re-ranking heuristique
  const reranked = rerank(candidates, opts);

  // 3. coupe pour budget tokens
  return capByTokens(reranked, 1500).slice(0, k);
}
```

### 4.1 Re-ranking heuristique

Score composite :

```
score = 0.7 × similarité_cosine
      + 0.15 × bonus_langue (1 si même langue, 0.5 si fallback)
      + 0.10 × bonus_fraîcheur (volatile=1, seasonal=0.6, evergreen=0.3)
      + 0.05 × bonus_keyword (présence des mots-clés rares de la question)
```

Pondérations configurables côté admin (`/admin/chat/sources` → onglet
« scoring »).

### 4.2 Re-ranking par cross-encoder (Phase 2)

Possibilité d'activer un re-ranker tiers (`bge-reranker-base` via
provider Ollama, ou Cohere Rerank). Le pipeline le supporte par
contrat `RerankProvider`.

## 5. Composition du prompt

```ts
function formatChunks(hits: RagHit[]): string {
  if (hits.length === 0) return 'Aucune source pertinente trouvée.';
  return hits.map((h, i) => `
[source ${i + 1} — ${h.sourceLabel} · ${h.metadata.heading ?? ''}]
${h.content.trim()}
`).join('\n---\n');
}
```

Injecté dans le prompt comme :

```
[Contexte]
Voici les sources de la maison qui peuvent t'aider à répondre.
Tu peux citer ces faits ; tu ne dois pas inventer ce qui n'y figure pas.

{contexte_rag}
```

## 6. Garde-fous d'hallucination

1. **Refus calibré** : si aucune source ne couvre un champ
   critique (`prix`, `livraison`, `composition`), l'agent est
   instruit de répondre : « la maison ne diffuse pas cette
   information ici. veux-tu que je transmette ta question ? »
2. **Citation interne** : chaque réponse retourne ses
   `sources: chunkIds` au client (event SSE `meta`). L'admin
   peut auditer.
3. **Audit qualité** : 1 % des conversations sont échantillonnées
   et soumises à audit manuel (script `pnpm tsx scripts/chat-quality-sample.ts`).

## 7. Fraîcheur et reindex

| Catégorie  | Reindex auto                  | Notes                                |
| ---------- | ----------------------------- | ------------------------------------ |
| `evergreen`| Mensuel                       | Pages de fond, fiches composition    |
| `seasonal` | Hebdomadaire                  | Articles de Journal saisonniers      |
| `volatile` | Quotidien                     | Prix, COD, livraison, FAQ            |

Cron Vercel `30 2 1 * *` (mensuel) + `30 2 * * 1` (hebdo) +
`30 2 * * *` (daily). Pour les `url`, on compare le `rawHash`
fetché vs en DB ; pas de reindex si inchangé.

## 8. Multilingue

Chaque source est **mono-langue** (`fr`, `ar`, `ar-MA`).
La même information dans 3 langues = 3 sources distinctes pointant
vers le même `audience`.

Si une question arrive en `ar-MA` et qu'aucune source n'existe en
`ar-MA` mais qu'il y a une source `fr`, le retrieval pioche la
source `fr` et le prompt indique à l'agent : « la source est en
français — réponds en darija en t'inspirant. »

## 9. PII et anonymisation

Pas de PII visiteur dans les chunks (sources publiques uniquement
en V1). Le contenu fetché est passé par un détecteur PII qui
**bloque** l'ingestion si détection (rare, mais sécurité).

## 10. Coût d'ingestion

| Étape           | Coût type                                                         |
| --------------- | ----------------------------------------------------------------- |
| Embedding (1k tokens) | ~ 0.00002 € (OpenAI 3-small)                                |
| Embedding (1k tokens) | ~ 0.000016 € (Gemini text-embedding-004)                    |
| Embedding (1k tokens) | 0 (Ollama local)                                            |
| Re-rank (Phase 2)     | ~ 0.0001 € pour 100 candidats (Cohere)                      |
| Stockage 1k chunks    | ~ 6 Mo (1536 dim × 4 bytes × 1k) = négligeable              |

Avec ~ 2 500 chunks à 700 tokens : **~ 1.75 M tokens** à indexer
au full reindex. Coût OpenAI : **~ 0.04 €**. Réindexer 4 fois par an
sur l'ensemble = **~ 0.16 € / an**. Négligeable.

## 11. Performance

| Opération                                   | Cible p95 |
| ------------------------------------------- | --------- |
| Embedding d'une question                    | < 250 ms  |
| Recherche pgvector top-k=18                 | < 80 ms   |
| Re-rank heuristique                         | < 5 ms    |
| Pipeline retrieve total                     | < 350 ms  |
| Ingestion d'une source 30 chunks            | < 12 s    |

L'index HNSW de pgvector (`vector_cosine_ops`) est calibré
`m = 16`, `ef_construction = 64`, `ef_search = 40` (équilibre
précision / latence pour < 100k chunks).

## 12. Évolutions

- **HyDE (Hypothetical Document Embeddings)** : génération d'une
  fausse réponse avant embedding, peut booster la précision sur
  questions courtes.
- **Multi-vecteur ColBERT** (Phase 3) si volumétrie justifie.
- **Tools function-calling** : le LLM décide quand appeler le RAG
  plutôt qu'à chaque tour. Économie tokens.
- **Chunk-level summary** précomputé pour le contexte étendu.

## 13. Tests RAG

Cf. doc 12. Trois niveaux :

- **Unit** : splitter, cleaner, scoring composite.
- **Integration** : ingestion d'un fixture URL HTML, vérif chunks
  produits et embeddings non-nuls.
- **Qualitatif** : suite de questions « gold » avec sources
  attendues ; mesure du taux de bonne récupération (`hit@k`).

## 14. Lecture suivante

- [10 — Providers & modèles](10-providers-models.md) pour les
  adapters d'embedding.
- [03 — Backend](03-backend.md) pour l'API d'ingestion.
- [02 — Data](02-data.md) pour le schéma pgvector.
