/**
 * Auto-register custom matchers chat + génériques au démarrage de vitest.
 *
 * Le fichier `src/test/matchers/index.ts` appelle déjà `expect.extend(...)`
 * lors de son import. On force ici l'import en side-effect pour que tous
 * les matchers (généraux + chat-specific) soient disponibles partout sans
 * import explicite.
 */
import '@/test/matchers';
import '@/test/matchers/chat';
