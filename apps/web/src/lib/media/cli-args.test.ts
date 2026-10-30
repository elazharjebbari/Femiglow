import { describe, expect, it } from 'vitest';
import { CliArgsError, parseBackfillBlurArgs, parseImportComponentMediaArgs } from './cli-args';

describe('parseBackfillBlurArgs', () => {
  it('valeurs par défaut et options', () => {
    expect(parseBackfillBlurArgs([])).toEqual({ dryRun: false, help: false });
    expect(
      parseBackfillBlurArgs(['--', '--dry-run', '--limit', '20', '--batch', '5', '--fetch-timeout', '3000']),
    ).toEqual({
      dryRun: true,
      limit: 20,
      batchSize: 5,
      fetchTimeoutMs: 3000,
      help: false,
    });
  });

  it('refuse les valeurs invalides et les arguments inconnus', () => {
    expect(() => parseBackfillBlurArgs(['--limit'])).toThrow(CliArgsError);
    expect(() => parseBackfillBlurArgs(['--limit', '0'])).toThrow(/entier positif/);
    expect(() => parseBackfillBlurArgs(['--limit', 'abc'])).toThrow(/entier positif/);
    expect(() => parseBackfillBlurArgs(['--nope'])).toThrow(/inconnu/);
  });
});

describe('parseImportComponentMediaArgs', () => {
  it('résout --root et --report depuis le dossier de lancement', () => {
    expect(
      parseImportComponentMediaArgs(
        ['--', '--root', 'generated/', '--component', 'kit-hero-produit', '--dry-run', '--report', 'out.json'],
        '/srv/femiglow/docs/hero-media-par-angle',
      ),
    ).toEqual({
      root: '/srv/femiglow/docs/hero-media-par-angle/generated',
      componentKey: 'kit-hero-produit',
      dryRun: true,
      publish: false,
      force: false,
      report: '/srv/femiglow/docs/hero-media-par-angle/out.json',
      help: false,
    });
  });

  it('chemins absolus, --publish, --force, --actor', () => {
    expect(
      parseImportComponentMediaArgs(['--root', '/data/gen', '--publish', '--force', '--actor', 'adm_1'], '/x'),
    ).toMatchObject({ root: '/data/gen', publish: true, force: true, actorId: 'adm_1' });
  });

  it('--root obligatoire (sauf --help), arguments inconnus refusés', () => {
    expect(() => parseImportComponentMediaArgs([], '/x')).toThrow(/--root/);
    expect(() => parseImportComponentMediaArgs(['--root'], '/x')).toThrow(/attend une valeur/);
    expect(() => parseImportComponentMediaArgs(['--root', '/a', '--bogus'], '/x')).toThrow(/inconnu/);
    expect(parseImportComponentMediaArgs(['--help'], '/x').help).toBe(true);
  });
});
