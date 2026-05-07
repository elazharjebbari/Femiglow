/**
 * Queries — `component_animations` (catalogue) +
 * `component_animation_bindings` (rattachement composant ↔ profil).
 */
import { and, asc, eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type {
  ComponentAnimation,
  ComponentAnimationBinding,
  ComponentAnimationBindingWithAnimation,
} from '@/lib/db/types';
import type { AnimationProfileSeed } from '@/lib/components/animations-registry';

function toAnimation(row: unknown): ComponentAnimation {
  return row as ComponentAnimation;
}

function toBinding(row: unknown): ComponentAnimationBinding {
  return row as ComponentAnimationBinding;
}

/* ───────────────────────── Animation profiles ─────────────────────── */

export async function listAnimations(): Promise<ComponentAnimation[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.componentAnimations)
      .orderBy(asc(schema.componentAnimations.name));
    return rows.map(toAnimation);
  }
  return Array.from(memoryStore().componentAnimations.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export async function getAnimationByKey(key: string): Promise<ComponentAnimation | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.componentAnimations)
      .where(eq(schema.componentAnimations.key, key))
      .limit(1);
    return rows[0] ? toAnimation(rows[0]) : null;
  }
  for (const a of memoryStore().componentAnimations.values()) {
    if (a.key === key) return a;
  }
  return null;
}

export async function getAnimationById(id: string): Promise<ComponentAnimation | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.componentAnimations)
      .where(eq(schema.componentAnimations.id, id))
      .limit(1);
    return rows[0] ? toAnimation(rows[0]) : null;
  }
  return memoryStore().componentAnimations.get(id) ?? null;
}

export async function upsertAnimationFromSeed(
  seed: AnimationProfileSeed,
): Promise<ComponentAnimation> {
  const existing = await getAnimationByKey(seed.key);
  const now = new Date();
  if (existing) {
    const updated: ComponentAnimation = {
      ...existing,
      name: seed.name,
      kind: seed.kind,
      description: seed.description,
      config: seed.config,
      respectsReducedMotion: seed.respectsReducedMotion,
      previewSnippet: seed.previewSnippet,
      updatedAt: now,
    };
    const drizzle = db();
    if (drizzle) {
      await drizzle
        .update(schema.componentAnimations)
        .set({
          name: updated.name,
          kind: updated.kind,
          description: updated.description,
          config: updated.config,
          respectsReducedMotion: updated.respectsReducedMotion,
          previewSnippet: updated.previewSnippet,
          updatedAt: now,
        })
        .where(eq(schema.componentAnimations.id, existing.id));
      return updated;
    }
    memoryStore().componentAnimations.set(existing.id, updated);
    return updated;
  }

  const created: ComponentAnimation = {
    id: createId('anm'),
    key: seed.key,
    name: seed.name,
    kind: seed.kind,
    description: seed.description,
    config: seed.config,
    respectsReducedMotion: seed.respectsReducedMotion,
    previewSnippet: seed.previewSnippet,
    createdAt: now,
    updatedAt: now,
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.componentAnimations).values(created);
    return created;
  }
  memoryStore().componentAnimations.set(created.id, created);
  return created;
}

/* ───────────────────────── Animation bindings ─────────────────────── */

export async function listAnimationBindings(
  componentId: string,
): Promise<ComponentAnimationBinding[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.componentAnimationBindings)
      .where(eq(schema.componentAnimationBindings.componentId, componentId));
    return rows.map(toBinding);
  }
  return Array.from(memoryStore().componentAnimationBindings.values()).filter(
    (b) => b.componentId === componentId,
  );
}

export async function listAnimationBindingsWithAnimation(
  componentId: string,
): Promise<ComponentAnimationBindingWithAnimation[]> {
  const bindings = await listAnimationBindings(componentId);
  const enriched: ComponentAnimationBindingWithAnimation[] = [];
  for (const b of bindings) {
    const animation = await getAnimationById(b.animationId);
    if (animation) enriched.push({ ...b, animation });
  }
  return enriched;
}

export async function getDefaultAnimationForComponent(
  componentId: string,
): Promise<ComponentAnimation | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.componentAnimationBindings)
      .where(
        and(
          eq(schema.componentAnimationBindings.componentId, componentId),
          eq(schema.componentAnimationBindings.isDefault, true),
        ),
      )
      .limit(1);
    if (!rows[0]) return null;
    return getAnimationById((rows[0] as { animationId: string }).animationId);
  }
  for (const b of memoryStore().componentAnimationBindings.values()) {
    if (b.componentId === componentId && b.isDefault) {
      return getAnimationById(b.animationId);
    }
  }
  return null;
}

export interface UpsertAnimationBindingInput {
  componentId: string;
  animationId: string;
  isDefault?: boolean;
  params?: Record<string, unknown>;
}

export async function upsertAnimationBinding(
  input: UpsertAnimationBindingInput,
): Promise<ComponentAnimationBinding> {
  // si on marque celui-ci default, on enlève les autres defaults
  if (input.isDefault) {
    const others = await listAnimationBindings(input.componentId);
    for (const b of others) {
      if (b.isDefault && b.animationId !== input.animationId) {
        await setAnimationBindingDefault(b.id, false);
      }
    }
  }

  // tente find existing
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.componentAnimationBindings)
      .where(
        and(
          eq(schema.componentAnimationBindings.componentId, input.componentId),
          eq(schema.componentAnimationBindings.animationId, input.animationId),
        ),
      )
      .limit(1);
    if (rows[0]) {
      const existing = toBinding(rows[0]);
      const updated: ComponentAnimationBinding = {
        ...existing,
        isDefault: input.isDefault ?? existing.isDefault,
        params: input.params ?? existing.params,
      };
      await drizzle
        .update(schema.componentAnimationBindings)
        .set({ isDefault: updated.isDefault, params: updated.params })
        .where(eq(schema.componentAnimationBindings.id, existing.id));
      return updated;
    }
  } else {
    for (const b of memoryStore().componentAnimationBindings.values()) {
      if (b.componentId === input.componentId && b.animationId === input.animationId) {
        const updated: ComponentAnimationBinding = {
          ...b,
          isDefault: input.isDefault ?? b.isDefault,
          params: input.params ?? b.params,
        };
        memoryStore().componentAnimationBindings.set(b.id, updated);
        return updated;
      }
    }
  }

  const created: ComponentAnimationBinding = {
    id: createId('anb'),
    componentId: input.componentId,
    animationId: input.animationId,
    isDefault: input.isDefault ?? false,
    params: input.params ?? {},
    createdAt: new Date(),
  };
  if (drizzle) {
    await drizzle.insert(schema.componentAnimationBindings).values(created);
    return created;
  }
  memoryStore().componentAnimationBindings.set(created.id, created);
  return created;
}

export async function setAnimationBindingDefault(id: string, isDefault: boolean): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .update(schema.componentAnimationBindings)
      .set({ isDefault })
      .where(eq(schema.componentAnimationBindings.id, id));
    return;
  }
  const store = memoryStore();
  const b = store.componentAnimationBindings.get(id);
  if (b) store.componentAnimationBindings.set(id, { ...b, isDefault });
}

export async function deleteAnimationBinding(id: string): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .delete(schema.componentAnimationBindings)
      .where(eq(schema.componentAnimationBindings.id, id));
    return;
  }
  memoryStore().componentAnimationBindings.delete(id);
}
