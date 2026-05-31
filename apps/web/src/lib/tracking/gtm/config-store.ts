/**
 * Service CRUD pour les versions de configuration GTM.
 *
 * Stockage : `tracking_settings` (key = `gtm.config_versions`),
 * value = `GtmConfigState` (JSONB). Pas de table dédiée.
 *
 * Toutes les écritures sont atomiques : on lit l'état complet,
 * on le modifie, on le rééécrit. Les races concurrentes restent
 * possibles ; en V1 on accepte le « last-write-wins » documenté
 * (cf. docs/gtm/16-vars-config-and-viz.md §13).
 */

import { randomUUID } from 'node:crypto';
import {
  getTrackingSetting,
  setTrackingSetting,
} from '@/lib/db/queries/tracking/settings';
import {
  GTM_CONFIG_VERSIONS_KEY,
  MAX_CONFIG_VERSIONS,
  emptyConfigState,
  gtmConfigCreateInputSchema,
  gtmConfigStateSchema,
  type GtmConfigCreateInput,
  type GtmConfigState,
  type GtmConfigVersion,
} from './config-schema';

export interface SaveOptions {
  actorId: string;
}

export interface ListResult {
  activeId: string | null;
  versions: Array<Pick<GtmConfigVersion, 'id' | 'name' | 'notes' | 'createdAt' | 'createdBy'>>;
}

async function readState(): Promise<GtmConfigState> {
  const raw = await getTrackingSetting<unknown>(GTM_CONFIG_VERSIONS_KEY, emptyConfigState());
  // Tolérance aux schémas anciens : si parse échoue, repartir d'un état vide.
  const parsed = gtmConfigStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : emptyConfigState();
}

async function writeState(state: GtmConfigState, opts: SaveOptions): Promise<void> {
  await setTrackingSetting(GTM_CONFIG_VERSIONS_KEY, state, { actorId: opts.actorId });
}

export const gtmConfigStore = {
  async list(): Promise<ListResult> {
    const state = await readState();
    return {
      activeId: state.activeId,
      versions: state.versions
        .map((v) => ({
          id: v.id,
          name: v.name,
          notes: v.notes,
          createdAt: v.createdAt,
          createdBy: v.createdBy,
        }))
        // Plus récent en premier
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    };
  },

  async get(id: string): Promise<GtmConfigVersion | null> {
    const state = await readState();
    return state.versions.find((v) => v.id === id) ?? null;
  },

  async getActive(): Promise<GtmConfigVersion | null> {
    const state = await readState();
    if (!state.activeId) return null;
    return state.versions.find((v) => v.id === state.activeId) ?? null;
  },

  async create(input: GtmConfigCreateInput, opts: SaveOptions): Promise<GtmConfigVersion> {
    const parsed = gtmConfigCreateInputSchema.parse(input);
    const state = await readState();

    const version: GtmConfigVersion = {
      id: randomUUID(),
      name: parsed.name,
      notes: parsed.notes ?? null,
      createdAt: new Date().toISOString(),
      createdBy: opts.actorId,
      perEnv: parsed.perEnv,
    };

    state.versions.push(version);

    // FIFO : drop les anciennes au-delà de MAX_CONFIG_VERSIONS,
    // sans jamais supprimer l'active.
    if (state.versions.length > MAX_CONFIG_VERSIONS) {
      const sorted = state.versions
        .slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      const toRemove: string[] = [];
      for (const v of sorted) {
        if (state.versions.length - toRemove.length <= MAX_CONFIG_VERSIONS) break;
        if (v.id === state.activeId) continue;
        toRemove.push(v.id);
      }
      state.versions = state.versions.filter((v) => !toRemove.includes(v.id));
    }

    // Si aucune active, la nouvelle devient active automatiquement.
    if (!state.activeId) state.activeId = version.id;

    await writeState(state, opts);
    return version;
  },

  /**
   * D-003 — Clone d'une version (édition = nouvelle version dérivée).
   * Idempotente : ne mute jamais la source. Le clone est ajouté à la liste
   * et marqué `clonedFrom: source.id`. Pas d'auto-activation.
   *
   * Throws `config_version_not_found` si `sourceId` est inconnu.
   */
  async clone(
    sourceId: string,
    input: { name: string; notes?: string | null },
    opts: SaveOptions,
  ): Promise<GtmConfigVersion> {
    const state = await readState();
    const source = state.versions.find((v) => v.id === sourceId);
    if (!source) throw new Error('config_version_not_found');

    const cloned: GtmConfigVersion = {
      id: randomUUID(),
      name: input.name,
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
      createdBy: opts.actorId,
      // Deep-clone JSON pour éviter toute mutation partagée avec la source.
      perEnv: JSON.parse(JSON.stringify(source.perEnv)) as typeof source.perEnv,
      clonedFrom: source.id,
    };
    state.versions.push(cloned);

    // FIFO identique à create — préserve toujours l'active.
    if (state.versions.length > MAX_CONFIG_VERSIONS) {
      const sorted = state.versions
        .slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      const toRemove: string[] = [];
      for (const v of sorted) {
        if (state.versions.length - toRemove.length <= MAX_CONFIG_VERSIONS) break;
        if (v.id === state.activeId) continue;
        toRemove.push(v.id);
      }
      state.versions = state.versions.filter((v) => !toRemove.includes(v.id));
    }

    await writeState(state, opts);
    return cloned;
  },

  async activate(id: string, opts: SaveOptions): Promise<GtmConfigVersion> {
    const state = await readState();
    const target = state.versions.find((v) => v.id === id);
    if (!target) throw new Error('config_version_not_found');
    state.activeId = id;
    await writeState(state, opts);
    return target;
  },

  /**
   * Désactive la version active courante (state.activeId = null). Aucune
   * version n'est plus active. Utile pour archiver un mapping temporairement
   * sans le supprimer.
   */
  async deactivate(id: string, opts: SaveOptions): Promise<void> {
    const state = await readState();
    if (state.activeId !== id) {
      throw new Error('config_version_not_active');
    }
    state.activeId = null;
    await writeState(state, opts);
  },

  async remove(id: string, opts: SaveOptions): Promise<void> {
    const state = await readState();
    if (state.activeId === id) {
      throw new Error('cannot_remove_active_config');
    }
    state.versions = state.versions.filter((v) => v.id !== id);
    await writeState(state, opts);
  },

  /** Test seam : reset complet (utilisé par les tests). */
  async _resetForTests(opts: SaveOptions): Promise<void> {
    await writeState(emptyConfigState(), opts);
  },
};
