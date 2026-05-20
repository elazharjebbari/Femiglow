/**
 * Store des fichiers SVG uploadés pour les covers vidéo `/kit`.
 *
 *  - Singleton-like : indexé par mediaId (préfixe `kvc_` pour distinguer
 *    des médias normaux).
 *  - Dual-driver : memoryStore par défaut, migration Drizzle future via
 *    table `kit_video_cover_files`.
 *  - Stockage du SVG sanitized directement (pas de filesystem) — taille
 *    plafonnée à 200 kB par fichier.
 */
import { memoryStore } from '@/lib/db/client';
import { createId } from '@/lib/ids';

export interface KitVideoCoverFile {
  id: string;
  content: string;
  contentType: 'image/svg+xml';
  size: number;
  uploadedAt: Date;
  uploadedBy: string | null;
}

interface ExtendedStore {
  kitVideoCoverFiles: Map<string, KitVideoCoverFile>;
}

function ext(): ExtendedStore {
  const store = memoryStore() as unknown as ExtendedStore & Record<string, unknown>;
  if (!store.kitVideoCoverFiles) store.kitVideoCoverFiles = new Map();
  return store;
}

export function getKitVideoCoverFile(id: string): KitVideoCoverFile | null {
  return ext().kitVideoCoverFiles.get(id) ?? null;
}

export function saveKitVideoCoverFile(
  content: string,
  uploadedBy: string | null,
): KitVideoCoverFile {
  const id = createId('kvc');
  const record: KitVideoCoverFile = {
    id,
    content,
    contentType: 'image/svg+xml',
    size: new TextEncoder().encode(content).length,
    uploadedAt: new Date(),
    uploadedBy,
  };
  ext().kitVideoCoverFiles.set(id, record);
  return record;
}

export function deleteKitVideoCoverFile(id: string): boolean {
  return ext().kitVideoCoverFiles.delete(id);
}

export function listKitVideoCoverFiles(): KitVideoCoverFile[] {
  return Array.from(ext().kitVideoCoverFiles.values());
}
