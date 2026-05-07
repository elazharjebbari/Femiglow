/**
 * Conversion d'un container.json GTM en descripteur de visualisation.
 *
 * Le descripteur est un objet déclaratif que le frontend peut rendre
 * en SVG sans connaître les détails du container. Il regroupe les tags
 * par dossier, en attachant les triggers et setup-tags.
 */

import type { GtmContainer, GtmFolder, GtmTag } from '../types';

export type GraphFolderColor =
  | 'ciel'
  | 'creme'
  | 'sauge-clair'
  | 'petale'
  | 'champagne'
  | 'sable'
  | 'sauge'
  | 'stone'
  | 'sauge-profond';

export interface GraphTriggerRef {
  name: string;
  type: string;
}

export interface GraphTagItem {
  kind: 'tag';
  name: string;
  type: string;
  triggers: GraphTriggerRef[];
  setupTags: string[];
}

export interface GraphFolderNode {
  id: string;
  name: string;
  color: GraphFolderColor;
  items: GraphTagItem[];
}

export interface GraphDescriptor {
  folders: GraphFolderNode[];
  orphans: GraphTagItem[];
  totalTags: number;
  totalTriggers: number;
  totalVariables: number;
}

const FOLDER_COLOR: Record<string, GraphFolderColor> = {
  'F-00': 'ciel',
  'F-01': 'creme',
  'F-02': 'sauge-clair',
  'F-03': 'petale',
  'F-04': 'champagne',
  'F-05': 'sable',
  'F-06': 'sauge',
  'F-07': 'stone',
  'F-08': 'sauge-profond',
};

function colorFor(folderId: string | undefined): GraphFolderColor {
  if (!folderId) return 'stone';
  return FOLDER_COLOR[folderId] ?? 'stone';
}

function findTriggerById(
  triggers: GtmContainer['containerVersion']['trigger'],
  id: string,
): GraphTriggerRef | null {
  const t = triggers.find((trig) => trig.triggerId === id);
  if (!t || !t.name) return null;
  return { name: t.name, type: t.type };
}

function buildItem(tag: GtmTag, triggers: GtmContainer['containerVersion']['trigger']): GraphTagItem {
  const refs: GraphTriggerRef[] = [];
  for (const id of tag.firingTriggerId ?? []) {
    const ref = findTriggerById(triggers, id);
    if (ref) refs.push(ref);
  }
  const setupTags = (tag.setupTag ?? []).map((s) => s.tagName);
  return {
    kind: 'tag',
    name: tag.name,
    type: tag.type,
    triggers: refs,
    setupTags,
  };
}

export function buildGraphDescriptor(container: GtmContainer): GraphDescriptor {
  const v = container.containerVersion;
  const folders = v.folder ?? [];
  const tags = v.tag ?? [];
  const triggers = v.trigger ?? [];

  const byFolder = new Map<string, GraphTagItem[]>();
  for (const f of folders) byFolder.set(f.folderId, []);

  const orphans: GraphTagItem[] = [];

  for (const tag of tags) {
    const item = buildItem(tag, triggers);
    if (tag.parentFolderId && byFolder.has(tag.parentFolderId)) {
      byFolder.get(tag.parentFolderId)!.push(item);
    } else {
      orphans.push(item);
    }
  }

  const folderNodes: GraphFolderNode[] = folders
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f: GtmFolder) => ({
      id: f.folderId,
      name: f.name,
      color: colorFor(f.folderId),
      items: byFolder.get(f.folderId) ?? [],
    }))
    // Ne garder que les dossiers qui contiennent au moins un tag.
    .filter((node) => node.items.length > 0);

  return {
    folders: folderNodes,
    orphans,
    totalTags: tags.length,
    totalTriggers: triggers.length,
    totalVariables: (v.variable ?? []).length,
  };
}
