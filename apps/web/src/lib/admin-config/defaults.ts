/**
 * Defaults Admin-Config — valeurs par défaut codées en TS pour chaque section.
 * Servent de base à la cascade `getAppConfig()` et de filet de sécurité (failsafe)
 * en cas de payload DB invalide. cf. docs/admin-config/architecture/03-cascade.md
 */
import type {
  BrandingConfig,
  FlagsConfig,
  NavConfig,
  RbacConfig,
  Section,
  SectionPayloadMap,
} from './types';

export const navDefault: NavConfig = {
  items: [
    { key: 'dashboard', label: 'Tableau de bord', href: '/admin', icon: 'home', position: 0 },
    { key: 'leads', label: 'Leads', href: '/admin/leads', icon: 'users', position: 1 },
    {
      key: 'components',
      label: 'Composants',
      href: '/admin/components',
      icon: 'box',
      position: 2,
    },
    { key: 'media', label: 'Médias', href: '/admin/media', icon: 'image', position: 3 },
    { key: 'legal', label: 'Pages légales', href: '/admin/legal', icon: 'file', position: 4 },
    { key: 'tracking', label: 'Tracking', href: '/admin/tracking', icon: 'activity', position: 5 },
    { key: 'webhooks', label: 'Webhooks', href: '/admin/webhooks', icon: 'webhook', position: 6 },
    { key: 'audit', label: 'Audit', href: '/admin/audit', icon: 'list', position: 7 },
    {
      key: 'settings',
      label: 'Réglages',
      href: '/admin/settings',
      icon: 'gear',
      position: 8,
      requiresRole: 'admin',
    },
  ],
};

export const flagsDefault: FlagsConfig = {
  flags: {
    newComposer: false,
    betaSeo: false,
    productsCmsEnabled: true,
    appConfigUiEnabled: true,
    freeShipping: true,
  },
};

export const rbacDefault: RbacConfig = {
  matrix: {
    superadmin: {
      components: ['read', 'write', 'publish', 'delete'],
      seo: ['read', 'write', 'publish', 'delete'],
      products: ['read', 'write', 'publish', 'delete'],
      media: ['read', 'write', 'publish', 'delete'],
      users: ['read', 'write', 'publish', 'delete'],
      'app-config': ['read', 'write', 'publish', 'delete'],
      legal: ['read', 'write', 'publish', 'delete'],
    },
    admin: {
      components: ['read', 'write', 'publish'],
      seo: ['read', 'write', 'publish'],
      products: ['read', 'write', 'publish'],
      media: ['read', 'write', 'publish'],
      users: ['read'],
      'app-config': ['read', 'write'],
      legal: ['read', 'write', 'publish'],
    },
    editor: {
      components: ['read', 'write'],
      seo: ['read', 'write'],
      products: ['read', 'write'],
      media: ['read', 'write'],
      users: [],
      'app-config': ['read'],
      legal: ['read', 'write'],
    },
    viewer: {
      components: ['read'],
      seo: ['read'],
      products: ['read'],
      media: ['read'],
      users: [],
      'app-config': ['read'],
      legal: ['read'],
    },
  },
};

export const brandingDefault: BrandingConfig = {
  colors: {
    primary: '#A8B5A0',
    accent: '#D4B896',
    bg: '#FAF6EE',
    text: '#2A2620',
  },
  fonts: {
    heading: 'Cormorant Garamond',
    body: 'Inter',
  },
  logoMediaId: null,
};

export const defaults: SectionPayloadMap = {
  nav: navDefault,
  flags: flagsDefault,
  rbac: rbacDefault,
  branding: brandingDefault,
};

export function getDefault<S extends Section>(section: S): SectionPayloadMap[S] {
  return defaults[section];
}
