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
      'src/components/admin/emails/cockpit/RetryButton.tsx',
      'src/components/admin/emails/cockpit/TransactionalCockpit.tsx',
    ]);
    ratchet('window.confirm/alert', /window\.(confirm|alert)\s*\(/, whitelist);
  });

  it('F01-U-068 — toLocale*String direct : tout passe par ui/format-datetime (TRV-05)', () => {
    // Dette au 2026-06-06 — migration vers formatAge/formatAbsolute au fil
    // des chantiers C3-C8 (chaque écran refondu retire son entrée).
    const whitelist = new Set([
      'src/app/admin/emails/automation/page.tsx',
      'src/app/admin/emails/automation/runs/[id]/page.tsx',
      'src/app/admin/emails/automation/runs/page.tsx',
      'src/app/admin/emails/campaigns/[id]/page.tsx',
      'src/app/admin/emails/campaigns/page.tsx',
      'src/app/admin/emails/templates/page.tsx',
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

  it('F01-U-065/066 — COULEUR hors ui/tokens.ts : source unique, liste décroissante (charte 09 §A.1, G10)', () => {
    // Verrou ÉLARGI (P3.0) : ne couvre plus seulement les doublons legacy
    // (sage/red/blue) mais TOUTE classe de couleur sémantique (non-stone) — la
    // charte impose que la couleur vienne d'ui/tokens.ts (TONE/TONE_BORDER).
    // tokens.ts est l'UNIQUE endroit autorisé (exempté). Chaque écran migré sur
    // les tokens (P3.0→P5) retire son entrée. `stone-` (neutre) est permis.
    // Au 2026-06-20 : 43 fichiers portent encore une couleur en dur. StatusBadge
    // et Pill en sont SORTIS (dérivent de tokens) — preuve de l'unification.
    const whitelist = new Set([
      'src/app/admin/emails/audiences/[id]/page.tsx',
      'src/app/admin/emails/audiences/page.tsx',
      'src/app/admin/emails/automation/AutomationRowActions.tsx',
      'src/app/admin/emails/automation/page.tsx',
      'src/app/admin/emails/automation/runs/[id]/page.tsx',
      'src/app/admin/emails/automation/runs/run-status.tsx',
      'src/app/admin/emails/campaigns/CampaignsListClient.tsx',
      'src/app/admin/emails/campaigns/CreateCampaignForm.tsx',
      'src/app/admin/emails/campaigns/[id]/CampaignActions.tsx',
      'src/app/admin/emails/error.tsx',
      'src/app/admin/emails/events/error.tsx',
      'src/app/admin/emails/listmonk/[[...path]]/page.tsx',
      'src/app/admin/emails/templates/new/NewTemplateForm.tsx',
      'src/app/admin/emails/transactional/[id]/page.tsx',
      'src/components/admin/emails/DashboardAutoRefresh.tsx',
      'src/components/admin/emails/EmailsTabs.tsx',
      'src/components/admin/emails/HealthBadge.tsx',
      'src/components/admin/emails/KpiCards.tsx',
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
      // SuppressionList : MIGRÉ sur le socle v2 (Banner/Button/SkeletonTable) — P3.0-c.
      'src/components/admin/emails/cockpit/TransactionalCockpit.tsx',
      'src/components/admin/emails/common/EntityCombobox.tsx',
      'src/components/admin/emails/events/EventsDashboardView.tsx',
      'src/components/admin/emails/templates/TemplateEditor.tsx',
      // ui/ConfirmDialog : MIGRÉ sur le socle v2 (Button/Input/Banner) — P3.0-c.
      'src/components/admin/emails/ui/Wizard.tsx',
      'src/components/admin/emails/ui/toast.tsx',
      'src/components/admin/emails/wizard/CampaignWizard.tsx',
    ]);
    ratchet(
      'couleur hors tokens.ts',
      // Classes de couleur nommées (non-stone) ET couleurs arbitraires
      // (-[#hex] / -[rgb…] / -[hsl…]) — la charte A.7 §3 exige « 0 hex brut ».
      /(\b(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|sage|slate|gray|zinc)-[0-9])|((bg|text|border|ring|from|to|via|fill|stroke)-\[(#|rgb|hsl))/,
      whitelist,
      // ui/tokens.ts = unique source autorisée des classes de couleur.
      new Set(['src/components/admin/emails/ui/tokens.ts']),
    );
  });

  it('F01-U-069 — anneau de focus UNIQUE : focus-visible:ring via le token FOCUS (charte 09 §A.4)', () => {
    // La charte impose un seul utilitaire de focus (ui/tokens.ts FOCUS). Tout
    // `focus-visible:ring` littéral ailleurs doit migrer vers ${FOCUS}.
    // Dette au 2026-06-20 : 3 fichiers. Cliquet décroissant.
    const whitelist = new Set([
      'src/components/admin/emails/KpiCards.tsx',
      'src/components/admin/emails/audiences/AudienceWizard.tsx',
      'src/components/admin/emails/events/EventsDashboardView.tsx',
    ]);
    ratchet(
      'focus-visible:ring hors token FOCUS',
      /focus-visible:ring/,
      whitelist,
      new Set(['src/components/admin/emails/ui/tokens.ts']),
    );
  });
});
