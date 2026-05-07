/**
 * Référentiel statique des 13 pages cartographiées de FemiGlow.
 * Utilisé comme seed initial des `seo_settings.known_pages` et comme
 * autocomplete UI dans /admin/seo.
 */
import type { KnownPage } from './types';

export const FEMIGLOW_KNOWN_PAGES: KnownPage[] = [
  { key: 'home', label: 'Accueil', path: '/', scope: 'page' },
  { key: 'kit', label: 'Le Kit', path: '/kit', scope: 'page' },
  { key: 'rituel', label: 'Le Rituel', path: '/rituel', scope: 'page' },
  { key: 'manifeste', label: 'Manifeste', path: '/manifeste', scope: 'page' },
  { key: 'fondatrice', label: 'Fondatrice', path: '/fondatrice', scope: 'page' },
  { key: 'temoignages', label: 'Témoignages', path: '/temoignages', scope: 'page' },
  { key: 'journal', label: 'Journal', path: '/journal', scope: 'page' },
  { key: 'faq', label: 'FAQ', path: '/faq', scope: 'page' },
  { key: 'contact', label: 'Contact', path: '/contact', scope: 'page' },
  { key: 'cgv', label: 'CGV', path: '/cgv', scope: 'page' },
  { key: 'mentions-legales', label: 'Mentions légales', path: '/mentions-legales', scope: 'page' },
  { key: 'confidentialite', label: 'Confidentialité', path: '/confidentialite', scope: 'page' },
  { key: 'cookies', label: 'Cookies', path: '/cookies', scope: 'page' },
];
