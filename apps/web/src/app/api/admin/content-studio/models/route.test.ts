import { describe, it, expect } from 'vitest';
import {
  materialiseDiscoveredModel,
  mapDiscoverySource,
  discoveryRoleToStudio,
} from './discovery-mapping';
import { inferRole } from '@/lib/ai-engine/services/model-discovery';

/**
 * ACT-ARC-008 — le picker ne doit annoncer « Live » que ce qui l'est vraiment,
 * et ne pas exposer de modèles non génératifs (STT/modération) en role=chat.
 */
describe('ARC-008 — picker honnête', () => {
  describe('inferRole (BUG-016/019)', () => {
    it('classe whisper hors chat (STT → tts, filtré du picker)', () => {
      expect(inferRole('whisper-1')).toBe('tts');
      expect(inferRole('gpt-4o-transcribe')).toBe('tts');
    });
    it('classe la modération hors chat', () => {
      expect(inferRole('omni-moderation-latest')).toBe('embedding');
    });
    it('garde les vrais modèles chat/image/video', () => {
      expect(inferRole('gpt-4o-mini')).toBe('chat');
      expect(inferRole('gpt-image-1')).toBe('image');
      expect(inferRole('text-embedding-3-small')).toBe('embedding');
    });
  });

  describe('mapDiscoverySource (BUG-024)', () => {
    it('un provider en fallback n\'est PAS marqué live → static', () => {
      expect(mapDiscoverySource('fallback')).toBe('static');
    });
    it('préserve live et cache', () => {
      expect(mapDiscoverySource('live')).toBe('live');
      expect(mapDiscoverySource('cache')).toBe('cache');
    });
  });

  describe('materialiseDiscoveredModel', () => {
    it('un modèle découvert via un provider en fallback porte source=static (pas live)', () => {
      const mat = materialiseDiscoveredModel(
        { id: 'flux_2', role: 'image' },
        'higgsfield',
        'reel',
        'fallback',
      );
      expect(mat?.source).toBe('static');
    });
    it('un modèle réellement live porte source=live', () => {
      const mat = materialiseDiscoveredModel(
        { id: 'some-new-image-model', role: 'image' },
        'openai',
        'post',
        'live',
      );
      expect(mat?.source).toBe('live');
    });
    it('filtre les rôles non studio (tts/embedding → null)', () => {
      expect(discoveryRoleToStudio('tts')).toBeNull();
      expect(
        materialiseDiscoveredModel({ id: 'whisper-1', role: 'tts' }, 'openai', null, 'live'),
      ).toBeNull();
    });
  });
});
