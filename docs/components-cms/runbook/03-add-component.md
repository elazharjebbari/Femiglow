# R3 — Ajouter un nouveau composant

> Cas plus rare que R2. On crée un composant React **et** on
> l'enregistre comme entité CMS-éditable.
>
> Durée moyenne : **1 j homme** (dev + tests + doc + revue).

## Quand passer par ce runbook

- Le composant n'existe **pas encore** dans `SITE_COMPONENT_REGISTRY`.
- On veut que ses textes / icônes / CTA soient éditables depuis
  l'admin.
- On veut un slot media (déjà couvert par le système Component-Media
  existant) **et / ou** des fields éditoriaux (cette extension).

## Vue d'ensemble (10 étapes)

```
┌─ 1. RSC                  apps/web/src/components/<group>/<Name>.tsx
├─ 2. Registre composant   registry.ts : SiteComponentSeed + slots[] + fields[]
├─ 3. Seed                 seed-pipeline : pas d'action si registry-driven
├─ 4. Tests RSC + RTL      éditeurs en isolation, panneau admin en intégration
├─ 5. Catalog              catalog/<key>.md
├─ 6. Page consumer        intégrer <NewComponent /> dans la page (RSC)
├─ 7. Slot defs (si media) updates registry + bindings
├─ 8. Animation (si rev/   animations-registry.ts
│    parallax)
├─ 9. Playwright           parcours admin nominal
└─ 10. Revue + merge       checklist PR
```

## Étape 1 — Créer le composant React

```tsx
// apps/web/src/components/sections/MaisonRituelSection.tsx
import { ComponentField } from '@/components/cms/ComponentField';
import { ComponentMedia } from '@/components/cms/ComponentMedia';

export async function MaisonRituelSection() {
  return (
    <section aria-labelledby="rituel-h">
      <ComponentField componentKey="maison-rituel" fieldKey="kicker">
        {(k) => k.value && <Eyebrow>{k.value}</Eyebrow>}
      </ComponentField>

      <ComponentField componentKey="maison-rituel" fieldKey="title">
        {(t) => <Heading id="rituel-h" as="h2">{t.value}</Heading>}
      </ComponentField>

      <ComponentField componentKey="maison-rituel" fieldKey="description">
        {(d) => <RichText html={d.value} />}
      </ComponentField>

      <ComponentMedia componentKey="maison-rituel" slot="primary" />

      <ComponentField componentKey="maison-rituel" fieldKey="cta">
        {(c) => c.value && <CTA href={c.value.href}>{c.value.label}</CTA>}
      </ComponentField>
    </section>
  );
}
```

Conventions :

- **Toujours RSC** sauf si interaction client (alors composant
  séparé `ComponentNameClient.tsx`).
- **Pas d'appel direct** à `getSiteComponentByKey` ; tout passe par
  `<ComponentField>` ou `<ComponentMedia>`.
- **Pas de fetch** dans le composant : la cascade s'occupe de tout.
- **Pas de `useState`** : c'est un RSC.

## Étape 2 — Enregistrer au registre

Fichier : `apps/web/src/lib/components/registry.ts`.

```ts
{
  key: 'maison-rituel',                      // kebab-case, jamais renommé
  name: 'Section rituel — page Maison',
  description: 'Section éditoriale rituel sur la page Maison.',
  category: 'editorial',
  pageGroup: 'maison',
  filePath: 'src/components/sections/MaisonRituelSection.tsx',
  slots: [SLOT_HERO_PRIMARY],                // ou nouveau si non standard
  defaultSvgFallback: '/images/maison-rituel.svg',
  defaultLoadingStrategy: 'lazy',
  defaultFetchPriority: 'auto',
  supportsAnimation: true,
  variantPolicy: 'default',
  fields: [
    { key: 'kicker', label: 'Kicker', type: 'kicker',
      required: false, defaultValue: 'Notre rituel',
      config: { maxLength: 30 }, group: 'En-tête', order: 10 },
    { key: 'title', label: 'Titre', type: 'text',
      required: true,  defaultValue: 'Un rituel pensé pour vous.',
      config: { maxLength: 80 }, group: 'En-tête', order: 20 },
    { key: 'description', label: 'Description', type: 'rich-text',
      required: true, defaultValue: '## Doux et efficace\n\nUne routine…',
      config: { maxLength: 1200, allowedTags: ['p','h2','strong','em','ul','li'] },
      group: 'Corps', order: 30 },
    { key: 'cta', label: 'CTA principal', type: 'cta',
      required: false, defaultValue: { label: 'Découvrir', href: '/rituel', variant: 'primary' },
      config: { variants: ['primary','secondary'] },
      group: 'CTA', order: 40 },
  ],
}
```

## Étape 3 — Seed

> **Le seed est déclenché par le registre.** Aucun fichier à
> ajouter. Au prochain run :
>
> ```bash
> pnpm --filter @femiglow/web seed:components-fields --filter-page-group maison
> ```
>
> Sortie attendue : 4 bindings `published` v1 créés pour
> `maison-rituel`.

Vérification :

```sql
SELECT field_key, status, version
FROM component_field_bindings
WHERE component_id = (SELECT id FROM site_components WHERE key = 'maison-rituel')
ORDER BY field_key;

-- Attendu :
-- cta         | published | 1
-- description | published | 1
-- kicker      | published | 1
-- title       | published | 1
```

## Étape 4 — Tests

### RTL en isolation par éditeur (déjà fait globalement)

Les éditeurs `TextEditor`, `RichTextEditor`, `CtaEditor`, `KickerEditor`
sont testés une fois pour toutes en T4. **Pas de re-test par
composant.**

### RTL panneau admin (intégration)

Fichier : `apps/web/src/components/admin/components/__tests__/maison-rituel-panel.spec.tsx`.

```tsx
it('renders all 4 field editors for maison-rituel', async () => {
  render(<ComponentFieldsPanel componentKey="maison-rituel" />);
  expect(await screen.findByLabelText(/Kicker/)).toBeInTheDocument();
  expect(await screen.findByLabelText(/Titre/)).toBeInTheDocument();
  expect(await screen.findByLabelText(/Description/)).toBeInTheDocument();
  expect(await screen.findByLabelText(/CTA principal/)).toBeInTheDocument();
});

it('saves kicker on edit and surfaces the binding version', async () => {
  // … MSW handler renvoie 200 + version=2
  // … RTL : type, debounce, vérifie le badge "v2"
});
```

### Scénario unitaire (Vitest)

Fichier : `apps/web/src/lib/components/__tests__/scenarios/maison-rituel.spec.ts`.

Voir T6 pour la matrice — au minimum :

- `cascade falls back to defaultValue when no binding`,
- `cascade picks published binding over default`,
- `validator rejects too-long title`,
- `rich-text body sanitizes <script>`.

### Playwright parcours

Fichier : `e2e/components-cms/maison-rituel.spec.ts`.

```ts
test('admin can edit the maison-rituel kicker end-to-end', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/components/maison-rituel');
  await page.getByLabel('Kicker').fill('Édition de saison');
  await page.getByRole('button', { name: 'Publier' }).click();
  await expect(page.getByText('Publié — version 2')).toBeVisible();

  // public side
  await page.goto('/maison');
  await expect(page.getByText('Édition de saison')).toBeVisible();
});
```

## Étape 5 — Catalogue

Créer `docs/components-cms/catalog/maison-rituel.md` à partir du
template `_template.md`. Inclure :

- description fonctionnelle,
- liste des champs (key, type, défaut, contraintes),
- liste des slots (cf. système Component-Media),
- screenshot (au moins du panneau admin),
- liens vers les tests dédiés.

## Étape 6 — Intégrer le composant à sa page

```tsx
// apps/web/src/app/maison/page.tsx
import { MaisonRituelSection } from '@/components/sections/MaisonRituelSection';

export default function MaisonPage() {
  return (
    <>
      {/* … */}
      <MaisonRituelSection />
    </>
  );
}
```

## Étape 7 — Slot defs (si media)

Si le composant a un slot media non couvert par les SlotDefinition
existants, ajouter une constante dans `registry.ts` (cf. exemples
`SLOT_HERO_PRIMARY`, `SLOT_CARD_COVER`). Cf. système Component-Media
pour le détail.

## Étape 8 — Animation (si applicable)

Si le composant utilise un profil d'animation (`reveal-up`,
`scale-hover`, …), s'assurer qu'il est dans
`apps/web/src/lib/components/animations-registry.ts`. Sinon, le seed
le crée comme inactif. L'admin pourra l'attacher depuis le panneau
animations.

## Étape 9 — Vérifier `tsc` + tests

```bash
pnpm --filter @femiglow/web tsc --noEmit
pnpm --filter @femiglow/web vitest run
pnpm --filter @femiglow/web test:e2e -- --grep maison-rituel
```

## Étape 10 — Checklist PR

```markdown
## Nouveau composant : `maison-rituel`

### Code
- [ ] RSC créé `MaisonRituelSection.tsx`
- [ ] Entrée registre `SITE_COMPONENT_REGISTRY` complète
  - [ ] `key`, `name`, `pageGroup`, `filePath`, `slots`, `fields`
  - [ ] `defaultSvgFallback` pointe vers un fichier qui existe
  - [ ] `category` cohérent
- [ ] Composant intégré à sa page (RSC consumer)

### Tests
- [ ] Test panneau admin (RTL + MSW)
- [ ] Test scénario cascade (Vitest)
- [ ] Test Playwright nominal
- [ ] (Si media) test rendu avec et sans binding actif
- [ ] (Si animation) test reduced-motion désactive l'effet

### Doc
- [ ] `catalog/maison-rituel.md` complet
- [ ] Screenshot du panneau admin
- [ ] (Si nouveau slot) `SlotDefinition` documenté
- [ ] (Si nouveau type de field) doc mis à jour dans A2 / F1

### Validation
- [ ] `pnpm tsc --noEmit`
- [ ] `pnpm vitest run`
- [ ] `pnpm next build`
- [ ] Bindings v1 créés en DB après seed local
- [ ] Pas de régression Playwright sur les autres pages
```

## Concernant la review

Le reviewer **doit** vérifier :

1. **Stabilité de la `key`** : aucun risque de renommage post-merge.
2. **`defaultValue` cohérent avec la maquette** : c'est le contenu
   live tant qu'aucun admin n'a publié.
3. **Contraintes `maxLength` réalistes** : trop court → admin
   frustré ; trop long → overflow visuel.
4. **`required` correct** : un champ marqué non-required ET sans
   `defaultValue` peut renvoyer `null` au RSC, ce dernier doit
   gérer.
5. **`group` et `order`** logiques pour l'admin (lisibilité du
   panneau).
6. **Pas d'utilisation de `useState` ou `useEffect`** dans la RSC.
7. **Pas de référence à `process.env`** côté client.
8. **`server-only` sur tout module touchant la DB**.

## Rollback

Identique R2 : reverter la PR. Les bindings deviennent orphelins
puis archivés au prochain seed.

## Cross-references

- Modèle de données → A2
- Cascade → A3
- Versioning → A4
- Editor registry → F1
- RSC helpers → F2
- Tests par scénario → T6
- Ajout simple d'un champ → R2
- Rollout → R4
