/**
 * Lit le flag admin `menuHintEnabled` (section `flags` de l'app-config).
 *
 * Pilote l'indice animé « ↑ Voir le pack ci-dessous » ancré au menu dans le
 * `Header`. **OFF par défaut** (et si le flag est absent du payload DB) : il
 * chevauchait la barre promo sticky sur mobile. Réactivable depuis
 * `/admin/settings/flags` (clé `menuHintEnabled`).
 *
 * Lu côté serveur dans les layouts publics (`[locale]` + legacy `(marketing)`)
 * et passé en prop au `Header` client — pas d'appel réseau côté client.
 */
import { getSection } from '@/lib/admin-config/resolve';

const DEFAULT_MENU_HINT_ENABLED = false;

export async function getMenuHintEnabled(): Promise<boolean> {
  try {
    const resolved = await getSection('flags');
    const value = resolved.payload.flags?.menuHintEnabled;
    return typeof value === 'boolean' ? value : DEFAULT_MENU_HINT_ENABLED;
  } catch {
    return DEFAULT_MENU_HINT_ENABLED;
  }
}
