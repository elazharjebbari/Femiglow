/**
 * Types partagés pour le module Event Mappings.
 * cf. docs/event-mappings/20-data/data-dictionary.csv
 */

export const PROVIDER_KINDS_FOR_MAPPING = [
  'meta',
  'google_ga4',
  'google_ads',
  'tiktok',
  'snap',
  'pinterest',
] as const;
export type MappingProviderKind = (typeof PROVIDER_KINDS_FOR_MAPPING)[number];

export const MAPPING_STATUSES = ['draft', 'active', 'archived', 'deleted'] as const;
export type MappingStatus = (typeof MAPPING_STATUSES)[number];

export const MAPPING_AUDIT_ACTIONS = [
  'create',
  'edit',
  'activate',
  'archive',
  'delete',
  'restore',
  'duplicate',
  'reset_to_default',
  'export_gtm',
  'test_event',
] as const;
export type MappingAuditAction = (typeof MAPPING_AUDIT_ACTIONS)[number];

/**
 * Une cellule de la matrice : un mapping event_canonique → provider.
 * cf. ADR-004.
 */
export interface MappingCell {
  /** Nom de l'event tel qu'envoyé au vendor. null = pas de dispatch. */
  mappedName: string | null;
  /** Meta : true ⇒ trackCustom. Ignoré pour les autres providers. */
  isCustom: boolean;
  /** Feature flag par cellule. */
  isEnabled: boolean;
  /** Notes admin (tooltip). */
  notes: string | null;
}

export type MappingsByProvider = Record<MappingProviderKind, MappingCell>;

/** Matrice complète : event_canonique → { provider → cellule }. */
export type Mappings = Record<string, MappingsByProvider>;

/** Row complète d'une version. */
export interface MappingVersion {
  id: string;
  name: string;
  notes: string | null;
  status: MappingStatus;
  isActive: boolean;
  isDefault: boolean;
  mappings: Mappings;
  clonedFrom: string | null;
  createdBy: string;
  createdAt: Date;
  activatedAt: Date | null;
  archivedAt: Date | null;
  deletedAt: Date | null;
}

/** Item de liste — sans le champ mappings pour économiser la bande passante. */
export interface MappingVersionListItem {
  id: string;
  name: string;
  notes: string | null;
  status: MappingStatus;
  isActive: boolean;
  isDefault: boolean;
  clonedFrom: string | null;
  createdBy: string;
  createdAt: Date;
  activatedAt: Date | null;
  archivedAt: Date | null;
  deletedAt: Date | null;
  eventsCount: number;
}

/** Entrée d'audit. */
export interface MappingAuditEntry {
  id: string;
  versionId: string | null;
  action: MappingAuditAction;
  actorId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  meta: Record<string, unknown>;
  createdAt: Date;
}

/** Résultat d'un dispatch dry-run pour 1 provider. */
export interface TestDispatchResult {
  providerKind: MappingProviderKind;
  wouldDispatch: boolean;
  mappedName: string | null;
  isCustom: boolean;
  skipReason: string | null;
}

/** Default id réservé. */
export const DEFAULT_VERSION_ID = '__default__';
