import { describe, expect, it } from 'vitest';
import { SEED_RITUALS, getSeedStats } from './seed-data';

describe('SEED_RITUALS — distribution éditoriale', () => {
  it('volume suffisant pour crédibilité (> 30)', () => {
    expect(SEED_RITUALS.length).toBeGreaterThanOrEqual(30);
  });

  it('signal "oui" majoritaire mais pas écrasant (60-90 % des APPROVED)', () => {
    const approved = SEED_RITUALS.filter((r) => r.status === 'APPROVED');
    const oui = approved.filter((r) => r.wouldRecommend === 'oui').length;
    const ratio = oui / approved.length;
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(0.9);
  });

  it('présence de "hesite" et "non" pour crédibilité', () => {
    const s = getSeedStats();
    expect(s.bySignal.hesite).toBeGreaterThan(0);
    expect(s.bySignal.non).toBeGreaterThan(0);
  });

  it('couverture photo ≥ 25 % (UGC convertit 2× mieux)', () => {
    const approved = SEED_RITUALS.filter((r) => r.status === 'APPROVED');
    const withPhotos = approved.filter((r) => (r.photos?.length ?? 0) > 0).length;
    expect(withPhotos / approved.length).toBeGreaterThanOrEqual(0.25);
  });

  it('aucun avis avec visage frontal en APPROVED (RGPD)', () => {
    // Convention : nos photos sources reviews1, reviews9 contiennent un visage.
    const approved = SEED_RITUALS.filter((r) => r.status === 'APPROVED');
    for (const r of approved) {
      for (const p of r.photos ?? []) {
        expect(p.url).not.toMatch(/reviews(1|9)\.jpg$/);
      }
    }
  });

  it('3 featured par locale (cap maison FR/AR/EN — Phase 7E-11)', () => {
    // Le module « voix de la maison » affiche 3 cartes featured et filtre par
    // langue (repli FR). Chaque locale doit donc avoir exactement 3 featured.
    const featuredByLang = (lang: 'fr' | 'ar' | 'en') =>
      SEED_RITUALS.filter((r) => r.featured && (r.language ?? 'fr') === lang).length;
    expect(featuredByLang('fr')).toBe(3);
    expect(featuredByLang('ar')).toBe(3);
    expect(featuredByLang('en')).toBe(3);
    expect(getSeedStats().featured).toBe(9);
  });

  it('PENDING > 0 pour alimenter la queue admin', () => {
    expect(getSeedStats().byStatus.PENDING).toBeGreaterThan(0);
  });

  it('REJECTED + HIDDEN > 0 pour démos de modération', () => {
    const { REJECTED, HIDDEN } = getSeedStats().byStatus;
    expect(REJECTED + HIDDEN).toBeGreaterThan(0);
  });

  it('toutes les villes ∈ catalogue ou null', () => {
    const allowed = new Set([
      'Rabat',
      'Casablanca',
      'Salé',
      'Tanger',
      'Marrakech',
      'Fès',
      'Agadir',
      'Oujda',
      'Tétouan',
      'Meknès',
      'Kénitra',
      'Autre',
      null,
    ]);
    for (const r of SEED_RITUALS) {
      expect(allowed.has(r.authorCity)).toBe(true);
    }
  });

  it('verified_purchase ≥ 50 %', () => {
    const s = getSeedStats();
    expect(s.verified / s.total).toBeGreaterThanOrEqual(0.5);
  });

  it('longueur moyenne body > 80 caractères (pas que des "Super !")', () => {
    const avg =
      SEED_RITUALS.reduce((acc, r) => acc + r.body.length, 0) / SEED_RITUALS.length;
    expect(avg).toBeGreaterThan(80);
  });

  it('couverture temporelle : 90 jours d\'historique', () => {
    const maxDaysAgo = Math.max(...SEED_RITUALS.map((r) => r.daysAgo));
    expect(maxDaysAgo).toBeGreaterThanOrEqual(80);
  });

  it('sources variées (au moins 3 distinctes)', () => {
    const sources = new Set(SEED_RITUALS.map((r) => r.source));
    expect(sources.size).toBeGreaterThanOrEqual(3);
  });

  it('au moins un avis en arabe pour couverture linguistique', () => {
    const ar = SEED_RITUALS.filter((r) => r.language === 'ar');
    expect(ar.length).toBeGreaterThanOrEqual(1);
  });

  it('aucun body ne contient d\'URL externe en APPROVED', () => {
    const approved = SEED_RITUALS.filter((r) => r.status === 'APPROVED');
    for (const r of approved) {
      expect(r.body).not.toMatch(/https?:\/\//);
      expect(r.body).not.toMatch(/www\./);
    }
  });
});
