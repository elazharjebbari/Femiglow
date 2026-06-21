/**
 * F04 — logique pure du cockpit : batterie F04-U-013..035.
 *
 * Parser (erreurs CKPT-03 + combinaisons + sérialisation), map des raisons de
 * skip (CKPT-02), saut de page (CKPT-12), échappement CSV RFC 4180 (CKPT-01 —
 * source unique client/serveur).
 */
import { describe, expect, it } from 'vitest';
import { parseFilters, serializeFilters, deserializeFilters } from '../filters-parser';
import { SKIP_REASON_LABELS_FR, formatSkipReasons } from '../skip-reasons';
import { offsetForPage, pageCount } from '../pagination';
import { csvEscape, csvLine } from '../csv';

const NOW = new Date('2026-06-10T12:00:00.000Z');

describe('F04 — erreurs du parser (CKPT-03)', () => {
  it("F04-U-013 — attempts:abc → erreur « attendu : >N, <N, =N » positionnée", () => {
    const r = parseFilters('attempts:abc', NOW);
    expect(r.filters).toHaveLength(0);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]!.message).toContain('attendu : >N, <N, =N');
    expect(r.errors[0]!.raw).toBe('attempts:abc');
  });

  it('F04-U-014 — status:plop → « Statut inconnu » avec exemples valides', () => {
    const r = parseFilters('status:plop', NOW);
    expect(r.errors[0]!.message).toContain('Statut inconnu : « plop »');
    expect(r.errors[0]!.message).toMatch(/failed, dlq, delivered/);
  });

  it('F04-U-015 — after:32/13 → « Date invalide » avec formats acceptés', () => {
    const r = parseFilters('after:32/13', NOW);
    expect(r.errors[0]!.message).toContain('Date invalide');
    expect(r.errors[0]!.message).toMatch(/2026-05-01, today, -7d/);
  });

  it("F04-U-016 — has:foo → « has: » n'accepte que « error »", () => {
    const r = parseFilters('has:foo', NOW);
    expect(r.errors[0]!.message).toContain("n'accepte que « error »");
  });

  it('F04-U-017 — status: (vide) → « Valeur manquante pour « status: » »', () => {
    const r = parseFilters('status:', NOW);
    expect(r.errors[0]!.message).toBe('Valeur manquante pour « status: »');
  });

  it('F04-U-018 — parsing PARTIEL : status:failed appliqué malgré attempts:abc fautif', () => {
    const r = parseFilters('status:failed attempts:abc', NOW);
    expect(r.filters).toHaveLength(1);
    expect(r.filters[0]).toMatchObject({ key: 'status', value: ['failed'] });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]!.raw).toBe('attempts:abc');
  });

  it("F04-U-019 — position d'erreur = index exact du token fautif", () => {
    const input = 'status:failed attempts:abc';
    const r = parseFilters(input, NOW);
    expect(r.errors[0]!.position).toBe(input.indexOf('attempts:abc'));
  });

  it('F04-U-020 — 4 filtres valides combinés : errors vide, freetext absent', () => {
    const r = parseFilters('status:failed to:*@bad.tld template:cart-* attempts:>2', NOW);
    expect(r.filters).toHaveLength(4);
    expect(r.errors).toHaveLength(0);
    expect(r.freetext).toBeUndefined();
  });

  it('F04-U-021 — opérateur inconnu attempts:>>3 → erreur format', () => {
    const r = parseFilters('attempts:>>3', NOW);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]!.message).toContain('attendu : >N, <N, =N');
  });
});

describe('F04 — sérialisation des filtres', () => {
  it('F04-U-022 — round-trip serialize → deserialize stable', () => {
    const original = parseFilters('status:failed,dlq template:cart-* attempts:>2 has:error', NOW);
    const params = serializeFilters(original.filters);
    const round = deserializeFilters(params, NOW);
    expect(round.errors).toHaveLength(0);
    // Mêmes filtres (raw diffère par construction — comparer la sémantique).
    expect(round.filters.map(({ raw: _raw, ...rest }) => rest)).toEqual(
      original.filters.map(({ raw: _raw, ...rest }) => rest),
    );
  });

  it('F04-U-023 — after est sérialisé en ISO 8601', () => {
    const r = parseFilters('after:2026-05-01', NOW);
    const params = serializeFilters(r.filters);
    expect(params.get('after')).toMatch(/^2026-05-01T00:00:00/);
  });
});

describe('F04 — raisons de skip traduites (CKPT-02)', () => {
  it("F04-U-024 — not_found → 'non trouvé'", () => {
    expect(SKIP_REASON_LABELS_FR.not_found).toBe('non trouvé');
  });
  it("F04-U-025 — wrong_status → 'statut non relançable'", () => {
    expect(SKIP_REASON_LABELS_FR.wrong_status).toBe('statut non relançable');
  });
  it("F04-U-026 — suppressed → 'adresse en liste de suppression'", () => {
    expect(SKIP_REASON_LABELS_FR.suppressed).toBe('adresse en liste de suppression');
  });
  it("F04-U-027 — cap_exceeded → 'au-delà du plafond de tentatives'", () => {
    expect(SKIP_REASON_LABELS_FR.cap_exceeded).toBe('au-delà du plafond de tentatives');
  });
  it("F04-U-028 — agrégation comptée : 2 not_found + 1 wrong_status → '2 non trouvé · 1 statut non relançable'", () => {
    expect(
      formatSkipReasons([
        { reason: 'not_found' },
        { reason: 'not_found' },
        { reason: 'wrong_status' },
      ]),
    ).toBe('2 non trouvé · 1 statut non relançable');
    // Une seule raison distincte → label nu (le compte vit dans « N ignorés »).
    expect(formatSkipReasons([{ reason: 'wrong_status' }, { reason: 'wrong_status' }])).toBe(
      'statut non relançable',
    );
  });
});

describe('F04 — saut de page (CKPT-12)', () => {
  it('F04-U-029 — page 3 → offset 100 (PAGE_SIZE 50)', () => {
    expect(offsetForPage(3, 5_000)).toBe(100);
    expect(offsetForPage('12', 5_000)).toBe(550);
  });
  it('F04-U-030 — page < 1 ramenée à 1 → offset 0', () => {
    expect(offsetForPage(0, 5_000)).toBe(0);
    expect(offsetForPage(-4, 5_000)).toBe(0);
  });
  it('F04-U-031 — page 99 sur 5 pages → ramenée à la dernière (offset 200)', () => {
    expect(pageCount(230)).toBe(5);
    expect(offsetForPage(99, 230)).toBe(200);
  });
  it('F04-U-031b — non-numérique → null (aucune navigation)', () => {
    expect(offsetForPage('abc', 230)).toBeNull();
    expect(offsetForPage('', 230)).toBeNull();
  });
});

describe('F04 — échappement CSV RFC 4180 (CKPT-01)', () => {
  it("F04-U-032 — virgule → champ entouré de guillemets", () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
  });
  it('F04-U-033 — guillemet interne doublé', () => {
    expect(csvEscape('di"t')).toBe('"di""t"');
  });
  it('F04-U-034 — retour ligne → champ entouré', () => {
    expect(csvEscape('a\nb')).toBe('"a\nb"');
    expect(csvEscape('a\r\nb')).toBe('"a\r\nb"');
  });
  it('F04-U-035 — null/undefined → champ vide', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });
  it('F04-U-035b — csvLine : date ISO + tentatives n/max', () => {
    const line = csvLine({
      id: 'out_1',
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
      toEmail: 'a@b.ma',
      toName: 'Salma, "la" testeuse',
      template: 'welcome-rituel',
      subject: 'Bonjour',
      status: 'delivered',
      attempts: 1,
      maxAttempts: 5,
    });
    expect(line).toBe(
      'out_1,2026-06-01T10:00:00.000Z,a@b.ma,"Salma, ""la"" testeuse",welcome-rituel,Bonjour,delivered,1/5',
    );
  });
});

// ── F04-S — anti-injection de formule CSV/DDE (sécurité G12) ────────────────
describe('F04-S — anti-injection de formule CSV (sécurité)', () => {
  it.each(['=', '+', '-', '@', '\t', '\r'])(
    'F04-S-001 — neutralise un déclencheur de tête « %s » par un préfixe apostrophe',
    (lead) => {
      const out = csvEscape(`${lead}HACK()`);
      // commence par l'apostrophe de neutralisation, jamais par le déclencheur brut.
      expect(out.startsWith("'") || out.startsWith('"\'')).toBe(true);
      expect(out.replace(/^"/, '').startsWith(lead)).toBe(false);
    },
  );

  it('F04-S-002 — payload =HYPERLINK (vecteur contact public) devient du texte inerte', () => {
    expect(csvEscape('=HYPERLINK("https://evil.tld","x")')).toBe(
      '"\'=HYPERLINK(""https://evil.tld"",""x"")"',
    );
  });

  it('F04-S-003 — DDE =cmd|\'/c calc\' neutralisé (préfixe + quoting RFC 4180)', () => {
    const out = csvEscape("=cmd|'/c calc'!A1");
    expect(out).toBe("'=cmd|'/c calc'!A1"); // pas de virgule/quote → pas de quoting, juste le préfixe
    expect(out.startsWith("'=")).toBe(true);
  });

  it('F04-S-004 — une valeur bénigne (ne commençant pas par un déclencheur) est INCHANGÉE', () => {
    expect(csvEscape('Bonjour')).toBe('Bonjour');
    expect(csvEscape('a@b.ma')).toBe('a@b.ma'); // @ en milieu de chaîne ≠ en tête
    expect(csvEscape('3 - 2 articles')).toBe('3 - 2 articles');
  });
});
