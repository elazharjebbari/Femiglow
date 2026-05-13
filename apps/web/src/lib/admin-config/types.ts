/**
 * Types Admin-Config — modèles partagés entre serveur, client et tests.
 * cf. docs/admin-config/architecture/02-data-model.md
 */

export type Section = 'nav' | 'flags' | 'rbac' | 'branding';

export const SECTIONS: readonly Section[] = ['nav', 'flags', 'rbac', 'branding'] as const;

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: string;
  position: number;
  requiresRole?: 'editor' | 'admin' | 'superadmin';
}

export interface NavConfig {
  items: NavItem[];
}

export interface FlagsConfig {
  flags: Record<string, boolean>;
}

export type RbacAction = 'read' | 'write' | 'publish' | 'delete';
export type RbacResource =
  | 'components'
  | 'seo'
  | 'products'
  | 'media'
  | 'users'
  | 'app-config'
  | 'legal';

export type RbacMatrix = Record<string, Record<RbacResource, RbacAction[]>>;

export interface RbacConfig {
  matrix: RbacMatrix;
}

export interface BrandingColors {
  primary: string;
  accent: string;
  bg: string;
  text: string;
}

export interface BrandingFonts {
  heading: string;
  body: string;
}

export interface BrandingConfig {
  colors: BrandingColors;
  fonts: BrandingFonts;
  logoMediaId: string | null;
}

export interface SectionPayloadMap {
  nav: NavConfig;
  flags: FlagsConfig;
  rbac: RbacConfig;
  branding: BrandingConfig;
}

export interface ConfigMetaActor {
  id: string;
  email: string;
}

export interface ConfigMeta {
  version: number;
  updatedAt: string;
  updatedBy: ConfigMetaActor | null;
  isDefault: boolean;
}

export interface ResolvedSection<S extends Section = Section> {
  section: S;
  payload: SectionPayloadMap[S];
  meta: ConfigMeta;
}

export interface ResolvedAppConfig {
  nav: NavConfig;
  flags: FlagsConfig;
  rbac: RbacConfig;
  branding: BrandingConfig;
  meta: Record<Section, ConfigMeta>;
}

export interface ConfigSnapshot {
  id: string;
  section: Section;
  capturedAt: string;
  version: number;
  actor: ConfigMetaActor | null;
  note: string | null;
  payload?: unknown;
}

export interface AdminConfigErrorBody {
  ok: false;
  error: {
    code:
      | 'STALE_VERSION'
      | 'INVALID_PAYLOAD'
      | 'UNAUTHORIZED'
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'INTERNAL';
    message: string;
    issues?: unknown;
  };
}
