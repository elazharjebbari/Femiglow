// Side-effect-only env loader. Doit s'exécuter AVANT tout import de `@/lib/env`,
// sinon env.ts capture les defaults Zod (`./.media-storage`) au lieu des
// valeurs réelles du .env.
//
// Usage: `node --import ./scripts/_load-env.mjs --import tsx scripts/reset.ts`
// OU import en tête de script: `import './scripts/_load-env.mjs';` (ESM hisste,
// mais la SEMANTIQUE garantit que ce module s'évalue avant les imports déclarés
// après lui dans le même fichier).

import { readFileSync } from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const appsWeb = path.resolve(here, '..');
const envPath = path.join(appsWeb, '.env');

try {
  const content = readFileSync(envPath, 'utf8');
  for (const lineRaw of content.split('\n')) {
    const line = lineRaw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {
  // .env absent : on continue avec process.env tel quel.
}
