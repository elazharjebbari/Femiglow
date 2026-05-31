import { describe, expect, it } from 'vitest';
import { GTM_TEMPLATES, findTemplate } from './templates';
import { gtmConfigPerEnvSchema, GTM_ENVS } from './config-schema';

describe('GTM_TEMPLATES', () => {
  it('expose 4 templates', () => {
    expect(GTM_TEMPLATES).toHaveLength(4);
  });

  it.each(['maroc-ecommerce', 'sandbox', 'b2b-saas', 'minimal'] as const)(
    'template %s existe et a un nom',
    (id) => {
      const t = findTemplate(id);
      expect(t).toBeDefined();
      expect(t!.name.length).toBeGreaterThan(0);
      expect(t!.description.length).toBeGreaterThan(0);
    },
  );

  it('chaque template a les 4 envs renseignés', () => {
    for (const t of GTM_TEMPLATES) {
      for (const env of GTM_ENVS) {
        expect(t.perEnv[env]).toBeDefined();
      }
    }
  });

  it('chaque template a une structure perEnv valide (sans superRefine cross-env)', () => {
    // Les templates sont des starting points : ils activent des providers
    // sans pré-remplir les Pixel IDs (l'admin le fait ensuite). Ils ne
    // passent donc pas le superRefine, mais la structure perEnv elle-même
    // doit être valide.
    for (const t of GTM_TEMPLATES) {
      const r = gtmConfigPerEnvSchema.safeParse(t.perEnv);
      expect(r.success).toBe(true);
    }
  });

  it('template maroc-ecommerce active 6 providers en prod', () => {
    const t = findTemplate('maroc-ecommerce')!;
    expect(t.perEnv.production.enabledProviders).toEqual(
      expect.arrayContaining(['google_ga4', 'meta', 'tiktok', 'snap', 'pinterest', 'google_ads']),
    );
    expect(t.perEnv.production.defaultCurrency).toBe('MAD');
  });

  it('template b2b-saas utilise EUR', () => {
    const t = findTemplate('b2b-saas')!;
    expect(t.perEnv.production.defaultCurrency).toBe('EUR');
  });

  it('template sandbox active aucun provider en prod', () => {
    const t = findTemplate('sandbox')!;
    expect(t.perEnv.production.enabledProviders).toEqual([]);
  });

  it('findTemplate retourne null pour un id inconnu', () => {
    expect(findTemplate('inexistant')).toBeNull();
  });
});
