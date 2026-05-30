import { resolveApiKey } from '@/lib/ai-engine/services/api-key-manager';

/**
 * ACT-ARC-013 — Source de vérité UNIQUE de résolution des credentials provider,
 * consommée par l'AI-Engine (A), le create-flow (B) ET la découverte de modèles
 * (picker). Délègue à `resolveApiKey` (api-key-manager) qui résout DB-d'abord
 * puis la chaîne d'env (incl. `OPENAI_API_KEY` déjà présent dans le process,
 * len 164). Neutralise explicitement la chaîne vide (un `??` brut ne le fait pas)
 * pour fermer le split d'env de BUG-001 (le create-flow lisait
 * `CONTENT_STUDIO_OPENAI_API_KEY` seule, vide).
 *
 * Tous les chemins de génération DOIVENT passer par ici afin que le picker ne
 * puisse plus annoncer « Live » un provider que le générateur ne peut pas lire.
 */
export async function resolveProviderCredential(
  provider: string,
): Promise<string | undefined> {
  const key = await resolveApiKey(provider);
  if (typeof key !== 'string') return undefined;
  const trimmed = key.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Variante synchrone (env uniquement, sans DB) pour les rares appelants qui ne
 * peuvent pas être async. Même chaîne d'env que `resolveApiKey`, chaîne vide
 * neutralisée. À éviter quand l'async est possible (la version async honore
 * aussi les clés stockées en base).
 */
const ENV_CHAINS: Record<string, string[]> = {
  openai: [
    'AI_ENGINE_OPENAI_API_KEY',
    'CONTENT_STUDIO_OPENAI_API_KEY',
    'CHAT_OPENAI_API_KEY',
    'OPENAI_API_KEY',
  ],
};

export function resolveProviderCredentialFromEnv(
  provider: string,
): string | undefined {
  for (const name of ENV_CHAINS[provider] ?? []) {
    const val = process.env[name];
    if (val && val.trim().length > 0) return val.trim();
  }
  return undefined;
}
