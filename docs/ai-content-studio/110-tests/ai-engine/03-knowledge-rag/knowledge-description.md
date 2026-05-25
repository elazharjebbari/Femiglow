# Knowledge RAG System — Detailed Description

**Module** : `src/lib/ai-engine/knowledge/`  
**Version** : 1.0.0-mvp  
**Date** : 2026-05-25

---

## 1. Overview

The Knowledge RAG (Retrieval-Augmented Generation) system provides domain-specific context to the AI content generation pipeline. It stores curated documents in thematic collections, chunks them into searchable segments, generates vector embeddings, and retrieves relevant context via similarity search during content generation.

### Architecture Diagram

```
                              +-------------------+
                              |  Admin UI         |
                              |  Knowledge Page   |
                              +--------+----------+
                                       |
                              +--------v----------+
                              |  API Routes       |
                              |  /knowledge       |
                              +--------+----------+
                                       |
                    +------------------+------------------+
                    |                                     |
           +--------v----------+              +-----------v--------+
           |  Collections      |              |  Ingestion         |
           |  CRUD operations  |              |  Text / URL        |
           +--------+----------+              +-----------+--------+
                    |                                     |
                    |                           +---------v---------+
                    |                           |  Text Splitter    |
                    |                           |  (LangChain)      |
                    |                           +---------+---------+
                    |                                     |
                    |                           +---------v---------+
                    |                           |  OpenAI Embeddings|
                    |                           |  text-embedding-  |
                    |                           |  3-small          |
                    |                           +---------+---------+
                    |                                     |
           +--------v---------+               +-----------v--------+
           |  PostgreSQL       |<--------------+  pgvector          |
           |  ai_engine_       |               |  <=> cosine dist   |
           |  knowledge_*      |               +--------------------+
           +--------+----------+
                    |
           +--------v----------+
           |  Retrieval         |
           |  searchKnowledge   |
           +--------+----------+
                    |
           +--------v----------+
           |  Pipeline Node     |
           |  enrichKnowledge   |
           +--------------------+
```

---

## 2. Collection Structure

Collections are thematic groupings of documents. Each collection targets a specific domain of knowledge needed for content generation.

### Database Schema (`ai_engine_knowledge_collection`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated |
| `name` | VARCHAR(200) | Human-readable name |
| `slug` | VARCHAR(100) | URL-safe identifier, regex `^[a-z0-9-]+$` |
| `description` | TEXT (nullable) | Purpose description |
| `category` | VARCHAR(50) | Grouping: science, platform, strategy, brand, operations, trends, craft |
| `document_count` | INT | Cached count of documents |
| `chunk_count` | INT | Cached count of chunks |
| `last_indexed_at` | TIMESTAMP (nullable) | Last ingestion timestamp |
| `is_active` | BOOLEAN | Soft delete flag |
| `created_at` | TIMESTAMP | Auto-set |

### CollectionRow Interface

```typescript
interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  documentCount: number;
  chunkCount: number;
  lastIndexedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}
```

### Default Collections (9 seeded)

| Slug | Name | Category |
|---|---|---|
| `neuromarketing` | Psychologie du consommateur & Neuromarketing | science |
| `viral-content` | Science du contenu viral | science |
| `platform-algorithms` | Algorithmes des plateformes sociales | platform |
| `jbeauty-strategy` | Strategie contenu beaute & J-Beauty | strategy |
| `ai-content-rules` | Production contenu AI : regles et contraintes | operations |
| `emerging-trends` | Tendances emergentes et signaux faibles | trends |
| `brand-femiglow` | Brand guidelines FemiGlow | brand |
| `products-ingredients` | Fiches produits et ingredients | brand |
| `copywriting` | Copywriting formulas et frameworks | craft |

---

## 3. Document Ingestion Pipeline

The ingestion pipeline processes raw content into searchable vector chunks.

### Entry Points

| Function | Source | Description |
|---|---|---|
| `ingestText(collectionId, title, content, metadata?)` | Direct text | Splits, embeds, stores |
| `ingestUrl(collectionId, url)` | Web URL | Fetches HTML, extracts text, then delegates to `ingestText` |

### Pipeline Steps

```
1. Input Validation
   -> collectionId must exist
   -> DB connection required
   -> OpenAI API key must be configured

2. Document Record Creation
   -> INSERT into ai_engine_knowledge_document
   -> Returns documentId

3. Text Splitting (Chunking)
   -> RecursiveCharacterTextSplitter from @langchain/textsplitters
   -> Parameters: chunkSize=1000, chunkOverlap=200
   -> Produces array of text chunks

4. Batch Embedding Generation
   -> Batches of 100 chunks
   -> OpenAIEmbeddings.embedDocuments(batch)
   -> Returns float[] vectors (1536 dimensions each)

5. Chunk Storage
   -> INSERT batch into ai_engine_knowledge_chunk
   -> Each chunk stores: content, embedding vector, metadata, collection/document references

6. Document Update
   -> UPDATE ai_engine_knowledge_document SET chunkCount = totalChunks

7. Collection Count Refresh
   -> updateCollectionCounts(collectionId)
   -> Re-counts documents and chunks via aggregate SQL queries
```

### URL Ingestion (HTML Processing)

The `ingestUrl` function includes a lightweight HTML-to-text extractor:

1. **Fetch** -- HTTP GET with 30s timeout, User-Agent: `FemiGlow-KnowledgeBot/1.0`
2. **Strip** -- Removes `<script>`, `<style>`, `<nav>`, `<footer>`, `<header>` blocks
3. **Convert** -- `<br>`, `<p>`, `<div>`, `<h1-h6>`, `<li>` become newlines; remaining tags removed
4. **Decode** -- HTML entities (`&nbsp;`, `&amp;`, etc.) decoded
5. **Clean** -- Collapse whitespace, trim

### IngestResult

```typescript
interface IngestResult {
  documentId: string;
  chunkCount: number;
  success: boolean;
  error?: string;
}
```

---

## 4. Chunking Strategy

The chunking strategy uses LangChain's `RecursiveCharacterTextSplitter` which attempts to split at natural boundaries (paragraphs, sentences, words) before falling back to character-level splitting.

### Parameters

| Parameter | Value | Rationale |
|---|---|---|
| **chunkSize** | 1000 characters | Balances context richness with embedding quality. Larger chunks capture more semantic context; smaller chunks are more precise for retrieval. 1000 is a standard choice for knowledge-base RAG. |
| **chunkOverlap** | 200 characters | 20% overlap ensures that concepts spanning chunk boundaries are captured in at least one chunk. Prevents loss of information at split points. |
| **batchSize** | 100 chunks | Embedding API batch limit to avoid rate limiting and memory pressure. |

### Splitting Priority (RecursiveCharacterTextSplitter)

The splitter attempts to split at these separators in order:
1. `\n\n` -- paragraph boundaries
2. `\n` -- line boundaries
3. ` ` -- word boundaries
4. `` -- character level (last resort)

### Example

Given a 3200-character document:
- Chunk 1: characters 0-1000
- Chunk 2: characters 800-1800 (200 overlap)
- Chunk 3: characters 1600-2600 (200 overlap)
- Chunk 4: characters 2400-3200 (200 overlap)

Result: 4 chunks, each with sufficient context for semantic search.

---

## 5. Embedding Generation

### Model

| Parameter | Value |
|---|---|
| **Provider** | OpenAI |
| **Model** | `text-embedding-3-small` |
| **Dimensions** | 1536 |
| **SDK** | `OpenAIEmbeddings` from `@langchain/openai` |

### Why text-embedding-3-small?

- Cost-effective: significantly cheaper than `text-embedding-3-large` (3072 dims)
- Sufficient quality for domain-specific RAG on curated beauty/marketing content
- 1536 dimensions provide good semantic resolution for our use case
- Consistent with pgvector index configuration

### Cost

Approximately $0.02 per million tokens. For a typical 10-page document (~5000 words, ~7000 tokens), the embedding cost is negligible (~$0.00014).

---

## 6. pgvector Similarity Search

### Storage

Chunk embeddings are stored in the `ai_engine_knowledge_chunk.embedding` column as `vector(1536)` using the pgvector PostgreSQL extension.

### Distance Metric

The system uses **cosine distance** (`<=>` operator in pgvector):

```sql
1 - (kc.embedding <=> query_vector::vector) AS similarity
```

Cosine similarity ranges from 0 (orthogonal) to 1 (identical direction). Higher values indicate more relevant results.

### Search Algorithm

```typescript
async function searchKnowledge(query: string, options: SearchOptions): Promise<SearchResult[]>
```

1. **Embed query** -- Generate a 1536-dim vector from the search query using `OpenAIEmbeddings.embedQuery()`
2. **Vector search** -- SQL query with cosine similarity, filtered by:
   - Collection slugs (optional, for targeted search)
   - `is_active = true` on the collection
   - `similarity >= scoreThreshold` (default: 0.7)
3. **Rank and limit** -- ORDER BY similarity DESC, LIMIT k (default: 5)
4. **Join metadata** -- JOIN with `ai_engine_knowledge_document` for document title

### SearchOptions

```typescript
interface SearchOptions {
  collectionSlugs?: string[];  // Filter by specific collections
  scoreThreshold?: number;      // Minimum similarity (default: 0.7)
  k?: number;                   // Number of results (default: 5)
}
```

### SearchResult

```typescript
interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  documentTitle: string;
  similarity: number;
}
```

---

## 7. RAG Context Injection into Pipeline

The `enrichKnowledgeNode` in the LangGraph pipeline is responsible for retrieving relevant knowledge and injecting it into the generation state.

### Flow

```
State.briefInput (keyMessage, objective, contentType, etc.)
  -> Build search query from brief fields
  -> searchByCollections(query, relevantSlugs, k=5)
  -> Format results as structured context string
  -> State.knowledgeContext = formatted context
```

### Collection Selection Logic

The node selects collections based on the content type and objective:
- **Always included**: `brand-femiglow`, `copywriting`
- **Product-focused content**: `products-ingredients`
- **Engagement objective**: `viral-content`, `platform-algorithms`
- **Education objective**: `neuromarketing`
- **Seasonal context**: `emerging-trends`

### Context Format

The knowledge context injected into the state is a structured string:

```
[Source: {documentTitle}] (relevance: {similarity})
{chunk content}

---

[Source: {documentTitle}] (relevance: {similarity})
{chunk content}
```

This context is then consumed by downstream nodes (generateScript, generateCaption) as part of the system prompt to ground the AI generation in domain-specific knowledge.
