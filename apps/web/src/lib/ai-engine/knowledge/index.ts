export {
  createCollection,
  listCollections,
  getCollection,
  deleteCollection,
  updateCollectionCounts,
  seedDefaultCollections,
  type CollectionRow,
} from './collections';

export {
  ingestText,
  ingestUrl,
  type IngestResult,
} from './ingestion';

export {
  searchKnowledge,
  searchByCollections,
  type SearchOptions,
  type SearchResult,
} from './retrieval';

export { seedKnowledgeBase } from './seed-data';
