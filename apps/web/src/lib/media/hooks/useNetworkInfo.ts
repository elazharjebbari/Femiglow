'use client';
import { useEffect, useState } from 'react';

export interface NetworkInfo {
  effectiveType: '2g' | '3g' | '4g' | 'slow-2g' | 'unknown';
  saveData: boolean;
  downlink?: number;
}

interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType?: NetworkInfo['effectiveType'];
    saveData?: boolean;
    downlink?: number;
    addEventListener?: (event: string, listener: () => void) => void;
    removeEventListener?: (event: string, listener: () => void) => void;
  };
}

function read(): NetworkInfo {
  if (typeof navigator === 'undefined')
    return { effectiveType: 'unknown', saveData: false };
  const c = (navigator as NavigatorWithConnection).connection;
  if (!c) return { effectiveType: 'unknown', saveData: false };
  return {
    effectiveType: c.effectiveType ?? 'unknown',
    saveData: c.saveData ?? false,
    downlink: c.downlink,
  };
}

export function useNetworkInfo(): NetworkInfo {
  const [info, setInfo] = useState<NetworkInfo>(() => read());
  useEffect(() => {
    const c = (navigator as NavigatorWithConnection).connection;
    if (!c?.addEventListener) return;
    const handler = () => setInfo(read());
    c.addEventListener('change', handler);
    return () => c.removeEventListener?.('change', handler);
  }, []);
  return info;
}

/** Réseaux jugés trop lents pour lancer un média non demandé. */
const CONSTRAINED_EFFECTIVE_TYPES: ReadonlySet<NetworkInfo['effectiveType']> = new Set([
  'slow-2g',
  '2g',
  '3g',
]);

/**
 * `true` si l'on peut lancer un aperçu vidéo NON sollicité (autoplay
 * décoratif) : pas de mode « économie de données » et réseau au moins 4G
 * (ou inconnu — Safari/Firefox n'exposent pas `navigator.connection`).
 */
export function allowsUnrequestedMedia(info: NetworkInfo): boolean {
  if (info.saveData) return false;
  return !CONSTRAINED_EFFECTIVE_TYPES.has(info.effectiveType);
}
