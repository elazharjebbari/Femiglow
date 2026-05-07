/**
 * Conversion d'un GraphDescriptor en flowchart Mermaid.
 *
 * Le résultat est un texte que l'utilisateur peut copier dans
 * mermaid.live ou un éditeur Markdown qui supporte mermaid.
 */

import type { GraphDescriptor, GraphTagItem } from './descriptor';

function sanitize(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 80);
}

function quote(s: string): string {
  return `"${s.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
}

export function descriptorToMermaid(desc: GraphDescriptor): string {
  const lines: string[] = ['flowchart LR'];

  // Triggers — déclarés une fois, déduplicqués par nom.
  const triggerSeen = new Set<string>();
  function emitTrigger(name: string, type: string) {
    if (triggerSeen.has(name)) return;
    triggerSeen.add(name);
    const id = `T_${sanitize(name)}`;
    const isCustom = type === 'customEvent' || name.startsWith('CE');
    lines.push(`  ${id}([${quote(name)}])`);
    if (isCustom) lines.push(`  class ${id} trigCE`);
  }

  function emitTag(item: GraphTagItem) {
    const tagId = `Tg_${sanitize(item.name)}`;
    lines.push(`  ${tagId}[${quote(item.name)}]`);
    for (const trig of item.triggers) {
      emitTrigger(trig.name, trig.type);
      const trigId = `T_${sanitize(trig.name)}`;
      lines.push(`  ${trigId} --> ${tagId}`);
    }
    for (const setup of item.setupTags) {
      const setupId = `Tg_${sanitize(setup)}`;
      lines.push(`  ${setupId} -. setup .-> ${tagId}`);
    }
  }

  for (const folder of desc.folders) {
    lines.push(`  subgraph ${sanitize(folder.id)}[${quote(folder.name)}]`);
    for (const item of folder.items) emitTag(item);
    lines.push('  end');
  }

  for (const item of desc.orphans) emitTag(item);

  lines.push('  classDef trigCE fill:#A8C4A6,stroke:#3F5B41,color:#0c1a0d;');
  return lines.join('\n');
}
