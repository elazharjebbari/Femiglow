export {
  createCollection,
  listCollections,
  getCollection,
  deleteCollection,
  updateCollection,
  updateCollectionCounts,
  getDocumentById,
  seedDefaultCollections,
  type CollectionRow,
  type UpdateCollectionData,
  type DocumentDetail,
} from './collections';

export {
  ingestText,
  ingestUrl,
  updateDocument,
  type IngestResult,
  type UpdateDocumentData,
  type UpdateDocumentResult,
} from './ingestion';

export {
  searchKnowledge,
  searchByCollections,
  type SearchOptions,
  type SearchResult,
} from './retrieval';

export { seedKnowledgeBase } from './seed-data';

export {
  seedStrategicBrief,
  STRATEGIC_BRIEF_DOCUMENTS,
  type StrategicBriefSeedResult,
} from './seed-strategic-brief';
