/**
 * Génération des modèles d'import à la volée.
 * Cf. docs/reviews-wall/execution/15-import-templates-formats.md § 10
 */

export type TemplateFormat = 'csv' | 'csv-comma' | 'tsv' | 'json' | 'jsonl';

const FIXTURES = [
  {
    body:
      "Trois mois et l'ongle a retrouvé sa nervure. J'ai cessé de le forcer. Je remarque que les cuticules ont apaisé.",
    wouldRecommend: 'oui',
    ritualTags: 'ongles-plus-lisses,plus-de-casse',
    authorFirstName: 'Amal',
    authorCity: 'Rabat',
    initiatedSince: '2026-02',
    isAnonymous: 'false',
    language: 'fr',
    productKey: 'pack-femiglow',
  },
  {
    body:
      'Cinq minutes le soir, devenu un rituel. Je le fais avec ma tisane après le travail.',
    wouldRecommend: 'oui',
    ritualTags: 'rituel-devenu-habitude,mains-detendues',
    authorFirstName: 'Yasmine',
    authorCity: 'Rabat',
    initiatedSince: '2024-03',
    isAnonymous: 'false',
    language: 'fr',
    productKey: 'pack-femiglow',
  },
  {
    body:
      'La paste donne un fini qui me ressemble enfin. Naturel, sans vernis, simple à intégrer dans mon rituel du soir.',
    wouldRecommend: 'hesite',
    ritualTags: '',
    authorFirstName: '',
    authorCity: 'Casablanca',
    initiatedSince: '',
    isAnonymous: 'true',
    language: 'fr',
    productKey: 'pack-femiglow',
  },
];

const CANONICAL_COLUMNS = [
  'body',
  'wouldRecommend',
  'ritualTags',
  'authorFirstName',
  'authorCity',
  'initiatedSince',
  'isAnonymous',
  'language',
  'productKey',
] as const;

function csvEscape(value: string, separator: string): string {
  const needsQuote = value.includes(separator) || value.includes('"') || value.includes('\n');
  if (!needsQuote) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function generateTemplate(format: TemplateFormat): {
  content: string;
  contentType: string;
  filename: string;
} {
  const date = new Date().toISOString().slice(0, 10);

  if (format === 'csv' || format === 'csv-comma' || format === 'tsv') {
    const sep = format === 'csv-comma' ? ',' : format === 'tsv' ? '\t' : ';';
    const lines: string[] = [
      `# FemiGlow — Rituels partagés — Modèle d'import ${format.toUpperCase()}`,
      `# Version : 1`,
      `# Date : ${date}`,
      `# Documentation : voir page d'aide /admin/rituals/import`,
      CANONICAL_COLUMNS.join(sep),
    ];
    for (const fixture of FIXTURES) {
      const row = CANONICAL_COLUMNS.map((col) =>
        csvEscape(fixture[col as keyof typeof fixture] ?? '', sep),
      ).join(sep);
      lines.push(row);
    }
    return {
      content: lines.join('\n') + '\n',
      contentType:
        format === 'tsv'
          ? 'text/tab-separated-values; charset=utf-8'
          : 'text/csv; charset=utf-8',
      filename: `rituels-modele-${date}.${format === 'tsv' ? 'tsv' : 'csv'}`,
    };
  }

  if (format === 'json') {
    const payload = {
      version: 1,
      generatedAt: new Date().toISOString(),
      defaults: { productKey: 'pack-femiglow', language: 'fr' },
      rituals: FIXTURES.map((f) => ({
        body: f.body,
        wouldRecommend: f.wouldRecommend,
        ritualTags: f.ritualTags ? f.ritualTags.split(',') : [],
        authorFirstName: f.authorFirstName || null,
        authorCity: f.authorCity || null,
        initiatedSince: f.initiatedSince || null,
        isAnonymous: f.isAnonymous === 'true',
        language: f.language,
      })),
    };
    return {
      content: JSON.stringify(payload, null, 2) + '\n',
      contentType: 'application/json; charset=utf-8',
      filename: `rituels-modele-${date}.json`,
    };
  }

  if (format === 'jsonl') {
    const lines = FIXTURES.map((f) =>
      JSON.stringify({
        body: f.body,
        wouldRecommend: f.wouldRecommend,
        ritualTags: f.ritualTags ? f.ritualTags.split(',') : [],
        authorFirstName: f.authorFirstName || null,
        authorCity: f.authorCity || null,
        initiatedSince: f.initiatedSince || null,
        isAnonymous: f.isAnonymous === 'true',
        language: f.language,
      }),
    );
    return {
      content: lines.join('\n') + '\n',
      contentType: 'application/x-ndjson; charset=utf-8',
      filename: `rituels-modele-${date}.jsonl`,
    };
  }

  throw new Error(`Format inconnu : ${format}`);
}
