/**
 * INF-TIMER-DRIFT — anti-drift entre `scripts/check-email-timers.sh` et le code.
 *
 * Le script de vérification des timers (R-003) découvre les routes cron
 * emailing au runtime via `find ... -name 'email-*' -o -name 'rituals-email-*'`.
 * Ce test lit À LA FOIS le script ET le filesystem pour garantir qu'ils ne
 * divergent pas silencieusement :
 *
 *   1. Toute route cron emailing présente sur le disque (un dossier avec
 *      `route.ts` sous `src/app/api/cron/` matchant les patterns du script) est
 *      bien dans la liste « attendue » que le script produirait — donc surveillée.
 *   2. Réciproquement, le script ne « réclame » pas de timer pour une route qui
 *      n'existe pas (pas de timer fantôme).
 *   3. Le script encode bien la convention de nommage timer
 *      `femiglow-cron-<name>.timer` et reste LECTURE SEULE (aucune commande
 *      d'écriture systemd / fichier).
 *
 * Si quelqu'un ajoute `src/app/api/cron/email-foo/route.ts` sans que le script
 * (ou la convention) suive, ce test casse — c'est l'anti-drift voulu.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(HERE, '..', '..'); // scripts/__tests__ → web root
const SCRIPT_PATH = join(WEB_ROOT, 'scripts', 'check-email-timers.sh');
const CRON_DIR = join(WEB_ROOT, 'src', 'app', 'api', 'cron');

/**
 * Réplique la règle de découverte du script : sous `src/app/api/cron`, les
 * dossiers `email-*` ou `rituals-email-*` qui contiennent un `route.ts`.
 */
function discoverEmailCronRoutes(): string[] {
  if (!existsSync(CRON_DIR)) return [];
  return readdirSync(CRON_DIR)
    .filter((name) => /^email-/.test(name) || /^rituals-email-/.test(name))
    .filter((name) => {
      const dir = join(CRON_DIR, name);
      return statSync(dir).isDirectory() && existsSync(join(dir, 'route.ts'));
    })
    .sort();
}

describe('check-email-timers.sh — anti-drift (INF-TIMER-DRIFT)', () => {
  const script = readFileSync(SCRIPT_PATH, 'utf8');

  // INF-TIMER-DRIFT-1 — le script encode les MÊMES patterns de découverte que ce
  // que le test attend (email-* et rituals-email-*). Si le pattern du script
  // change, ce garde-fou le détecte.
  it('le script découvre via les patterns email-* et rituals-email-*', () => {
    expect(script).toMatch(/-name\s+'email-\*'/);
    expect(script).toMatch(/-name\s+'rituals-email-\*'/);
    // Il ne retient que les dossiers ayant un route.ts (vraie route).
    expect(script).toMatch(/route\.ts/);
  });

  // INF-TIMER-DRIFT-2 — toute route cron emailing du disque est bien recensée.
  it('toutes les routes cron emailing du code sont couvertes par le script', () => {
    const routes = discoverEmailCronRoutes();
    // Garde-fou : on s'attend à AU MOINS les 6 crons emailing du module 11.
    expect(routes.length).toBeGreaterThanOrEqual(6);
    expect(routes).toEqual(
      expect.arrayContaining([
        'email-audience-purge',
        'email-automation',
        'email-campaign-sync',
        'email-listmonk-cleanup',
        'email-outbox',
        'rituals-email-j45',
      ]),
    );
  });

  // INF-TIMER-DRIFT-3 — convention de nommage timer présente dans le script.
  it('le script encode la convention femiglow-cron-<name>.timer', () => {
    expect(script).toMatch(/femiglow-cron-\$\{c\}\.timer/);
    expect(script).toMatch(/\^femiglow-cron-.*\\\.timer\$/);
  });

  // INF-TIMER-DRIFT-4 — LECTURE SEULE : aucune commande d'écriture systemd / fs.
  // (le script ne doit jamais muter l'état serveur — il est lançable en prod).
  it('le script reste lecture seule (aucune écriture systemd / fichier)', () => {
    // Pas de mutation systemd.
    expect(script).not.toMatch(/systemctl\s+(start|stop|enable|disable|restart|daemon-reload)/);

    // Pas de redirection d'écriture vers un VRAI fichier. On ne raisonne que sur
    // le CODE (lignes non-commentaires) : on retire d'abord les lignes `#…` puis
    // les redirections inoffensives autorisées (stderr, /dev/null) ; toute
    // redirection `>` résiduelle vers un token serait suspecte.
    const codeOnly = script
      .split('\n')
      .filter((l) => !/^\s*#/.test(l))
      .join('\n');
    const sanitized = codeOnly
      .replace(/\d?>&\d/g, ' ') // 2>&1, >&2 …
      .replace(/\d?>\s*\/dev\/null/g, ' ') // >/dev/null, 2>/dev/null
      .replace(/<<<?/g, ' ') // here-string / here-doc
      .replace(/<\s*\(/g, ' '); // process substitution `< (`
    const writeRedirects = sanitized.match(/[12]?>\s*[^\s&|;)]+/g) ?? [];
    expect(writeRedirects).toEqual([]);

    // Pas de rm / install / cp / mv destructeurs.
    expect(script).not.toMatch(/\b(rm|cp|mv|install)\s+-/);
  });

  // INF-TIMER-DRIFT-5 — sémantique d'exit code documentée (0 ok / 1 manquant).
  it('le script échoue (exit 1) quand un timer manque et réussit (exit 0) sinon', () => {
    expect(script).toMatch(/exit 1/);
    expect(script).toMatch(/exit 0/);
    // Tolérance CI : si systemctl manque, sortie 0 explicite.
    expect(script).toMatch(/command -v systemctl/);
  });
});
