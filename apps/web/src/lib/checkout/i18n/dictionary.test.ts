import { describe, expect, it } from 'vitest';

import { getWizardDictionary } from './dictionary';

/** Chemins de toutes les clés, fonctions comprises. */
function keysOf(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    child && typeof child === 'object'
      ? keysOf(child as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('dictionnaire du wizard', () => {
  const fr = keysOf(getWizardDictionary('fr')).sort();

  it.each(['ar', 'en'] as const)('%s a les mêmes clés que fr', (language) => {
    expect(keysOf(getWizardDictionary(language)).sort()).toEqual(fr);
  });

  it('la durée de l’étape adresse n’est plus annoncée', () => {
    expect(fr).not.toContain('shell.timeEstimateAddress');
  });
});
