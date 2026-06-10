/**
 * F01 — VERROUS D'ARCHITECTURE à CLIQUET (F01-U-065..068, TRV-01/05 + design).
 *
 * Sémantique cliquet (amendement des oracles U-067/068 consigné en batterie) :
 * les oracles d'origine (« 0 occurrence ») sont inatteignables tant que les
 * migrations P1.5→P5 ne sont pas terminées. Le verrou garantit donc :
 *   1. AUCUN NOUVEAU fichier fautif (la dette ne croît jamais) ;
 *   2. une liste blanche qui ne peut que DÉCROÎTRE : une entrée qui ne
 *      contient plus l'occurrence DOIT être retirée (le test échoue sinon).
 * À la fin du programme, listes vides = oracles d'origine satisfaits.
 *
 * Env node (fs) — pas de jsdom.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOTS = [
  'src/components/admin/emails',
  'src/app/admin/emails',
];

/** Fichiers source prod (hors tests). */
function listSources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name === '__tests__' || name === '__qa__') continue;
        walk(p);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(name) || /\.test\./.test(name)) continue;
      out.push(p);
    }
  };
  for (const r of ROOTS) walk(join(process.cwd(), r));
  return out;
}

/** Cliquet générique : regex × liste blanche (chemins POSIX relatifs à src/). */
function ratchet(name: string, pattern: RegExp, whitelist: Set<string>, exempt: Set<string> = new Set()) {
  const offenders = new Set<string>();
  for (const file of listSources()) {
    const rel = relative(process.cwd(), file).split(sep).join('/');
    if (exempt.has(rel)) continue;
    if (pattern.test(readFileSync(file, 'utf8'))) offenders.add(rel);
  }
  const nouveaux = [...offenders].filter((f) => !whitelist.has(f)).sort();
  const aRetirer = [...whitelist].filter((f) => !offenders.has(f)).sort();
  expect(nouveaux, `${name} : NOUVEAUX fichiers fautifs (interdit — utiliser le socle ui/)`).toEqual([]);
  expect(aRetirer, `${name} : entrées de liste blanche devenues propres — RETIRE-les (cliquet)`).toEqual([]);
}

describe('Verrous cliquet — section emails', () => {
  it('F01-U-067 — window.confirm/alert : aucun nouveau, liste qui décroît (TRV-01)', () => {
    // Dette au 2026-06-06 (P1.2) — adoption ConfirmDialog : P1.5 (pilote
    // Suppression) puis chantiers C3-C8. NE RIEN AJOUTER ICI.
    const whitelist = new Set([
      'src/app/admin/emails/automation/AutomationRowActions.tsx',
      'src/app/admin/emails/campaigns/[id]/CampaignActions.tsx',
      'src/components/admin/emails/audiences/AudienceDetailActions.tsx',
      'src/components/admin/emails/cockpit/RetryButton.tsx',
      'src/components/admin/emails/cockpit/TransactionalCockpit.tsx',
    ]);
    ratchet('window.confirm/alert', /window\.(confirm|alert)\s*\(/, whitelist);
  });

  it('F01-U-068 — toLocale*String direct : tout passe par ui/format-datetime (TRV-05)', () => {
    // Dette au 2026-06-06 — migration vers formatAge/formatAbsolute au fil
    // des chantiers C3-C8 (chaque écran refondu retire son entrée).
    const whitelist = new Set([
      'src/app/admin/emails/audiences/[id]/page.tsx',
      'src/app/admin/emails/automation/page.tsx',
      'src/app/admin/emails/automation/runs/[id]/page.tsx',
      'src/app/admin/emails/automation/runs/page.tsx',
      'src/app/admin/emails/campaigns/[id]/page.tsx',
      'src/app/admin/emails/campaigns/page.tsx',
      'src/app/admin/emails/templates/page.tsx',
      'src/components/admin/emails/audiences/AudienceDetailActions.tsx',
      'src/components/admin/emails/audiences/AudiencePreview.tsx',
      'src/components/admin/emails/audiences/RuleEditor.tsx',
      'src/components/admin/emails/audiences/SnapshotsPanel.tsx',
      'src/components/admin/emails/audiences/rule-defaults.ts',
      'src/components/admin/emails/cockpit/CommandPalette.tsx',
      'src/components/admin/emails/cockpit/FilteredTable.tsx',
      'src/components/admin/emails/cockpit/KpiHeader.tsx',
      'src/components/admin/emails/cockpit/TransactionalCockpit.tsx',
      'src/components/admin/emails/events/EventsDashboardView.tsx',
      'src/components/admin/emails/templates/TemplateEditor.tsx',
      'src/components/admin/emails/wizard/CampaignWizard.tsx',
    ]);
    ratchet(
      'toLocale*String',
      /\.toLocale(String|TimeString|DateString)\s*\(/,
      whitelist,
      // Le formateur central est l'unique endroit autorisé (par construction
      // il n'utilise QUE Intl.DateTimeFormat, mais on l'exempte du scan pour
      // que ses commentaires/doc ne déclenchent pas le verrou).
      new Set(['src/components/admin/emails/ui/format-datetime.ts']),
    );
  });

  it('F01-U-065/066 — tokens : aucun NOUVEAU sage-/red-/blue-, liste justifiée (design §1)', () => {
    // Dette chromatique au 2026-06-06 (3 doublons : sage/emerald, red/rose,
    // blue/sky). Chaque écran refondu (C3-C8) migre vers les tones de ui/Pill
    // et retire son entrée. common/StatusBadge : nuances blue- héritées des
    // statuts opened/clicked, migrées avec la passe design C10.
    const whitelist = new Set([
      'src/app/admin/emails/audiences/[id]/page.tsx',
      'src/app/admin/emails/campaigns/CampaignsListClient.tsx',
      'src/app/admin/emails/templates/new/NewTemplateForm.tsx',
      'src/components/admin/emails/audiences/AudienceDetailActions.tsx',
      'src/components/admin/emails/audiences/AudiencePreview.tsx',
      'src/components/admin/emails/audiences/AudienceRowActions.tsx',
      'src/components/admin/emails/audiences/AudienceRulesBuilder.tsx',
      'src/components/admin/emails/audiences/AudienceWizard.tsx',
      'src/components/admin/emails/audiences/CountryMultiSelect.tsx',
      'src/components/admin/emails/audiences/RuleEditor.tsx',
      'src/components/admin/emails/audiences/SnapshotsPanel.tsx',
      'src/components/admin/emails/automation/AutomationWizard.tsx',
      'src/components/admin/emails/automation/StepEditor.tsx',
      'src/components/admin/emails/automation/StepList.tsx',
      'src/components/admin/emails/cockpit/BulkActionsBar.tsx',
      'src/components/admin/emails/cockpit/CommandPalette.tsx',
      'src/components/admin/emails/cockpit/FilteredTable.tsx',
      'src/components/admin/emails/cockpit/KpiHeader.tsx',
      'src/components/admin/emails/cockpit/RetryButton.tsx',
      'src/components/admin/emails/cockpit/SavedViewsSidebar.tsx',
      'src/components/admin/emails/cockpit/TransactionalCockpit.tsx',
      'src/components/admin/emails/common/StatusBadge.tsx',
      'src/components/admin/emails/templates/TemplateEditor.tsx',
    ]);
    ratchet('tokens sage-/red-/blue-', /\b(sage|red|blue)-[0-9]/, whitelist);
  });
});
