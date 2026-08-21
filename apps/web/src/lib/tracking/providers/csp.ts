import { TRACKING_CSP_HOSTS } from './csp-hosts';

export interface CspExtensions {
  scriptSrc: string[];
  connectSrc: string[];
  frameSrc: string[];
}

/**
 * Construit la liste statique d'hôtes CSP issus de tous les providers
 * supportés. N'importe AUCUN adaptateur (qui pulle `node:crypto`) ;
 * compatible Edge Runtime / middleware Next.js.
 */
export function buildTrackingCspExtensions(): CspExtensions {
  const scripts = new Set<string>();
  const connects = new Set<string>();
  const frames = new Set<string>();
  for (const hosts of Object.values(TRACKING_CSP_HOSTS)) {
    for (const host of hosts.scriptSrc) scripts.add(host);
    for (const host of hosts.connectSrc) connects.add(host);
    for (const host of hosts.frameSrc ?? []) frames.add(host);
  }
  return {
    scriptSrc: Array.from(scripts),
    connectSrc: Array.from(connects),
    frameSrc: Array.from(frames),
  };
}
