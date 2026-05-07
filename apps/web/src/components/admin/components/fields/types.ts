/**
 * Types partagés du registre d'éditeurs (F1).
 *
 * Tous les éditeurs implémentent `EditorComponent<T>` et reçoivent
 * `EditorProps<T>`. Le parent (`FieldRow` puis le moteur de formulaire F3)
 * gère le state, la persistance et l'affichage des erreurs serveur.
 *
 * Cf. docs/components-cms/frontend/01-field-editor-registry.md
 */
import type { ComponentType } from 'react';
import type { ComponentFieldDefinition } from '@/lib/db/types';

export interface EditorProps<T = unknown> {
  /** Valeur courante (peut être null si pas encore édité). */
  value: T | null;
  /** Appelé à chaque changement. Le parent debounce le save (cf. F3). */
  onChange: (next: T) => void;
  /** Erreur de validation Zod (FR), ou null. */
  error: string | null;
  /** Définition du champ (label, config, required, …). */
  fieldDef: ComponentFieldDefinition;
  /** Locale courante. v1 : toujours 'fr'. */
  locale: string;
  /** id HTML pour <label htmlFor>. Géré par le parent. */
  id: string;
  /** Mode lecture seule (preview, restauration en cours). */
  readOnly?: boolean;
}

/**
 * Un éditeur est un composant React typé. On utilise `ComponentType` plutôt
 * que `FC` pour ne pas imposer la convention `displayName` et permettre des
 * composants asynchrones côté tests/SSR.
 */
export type EditorComponent<T = unknown> = ComponentType<EditorProps<T>>;

/**
 * État d'un champ côté formulaire — produit par F3 et lu par F1.
 */
export interface FieldDirtyState {
  initial: unknown;
  current: unknown;
  error: string | null;
  saving: boolean;
  /** ISO date string : timestamp serveur du dernier `updatedAt` connu. */
  lastSavedAt: string | null;
  /**
   * Optimistic concurrency : ISO date string du dernier `updatedAt` retourné
   * par le serveur. Envoyé en `If-Match` au prochain PATCH. NULL si pas
   * encore de save (premier draft).
   */
  ifMatch?: string | null;
}
