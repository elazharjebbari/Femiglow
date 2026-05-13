# Design UI — Système visuel & spécifications

> Le chat est un **objet de marque** avant d'être un produit. Chaque pixel doit refléter FemiGlow : féminin, premium, doux, confiance.

## Doctrine de design

1. **Maison FemiGlow, pas chatbot générique.** Couleurs, courbes, voix : signature.
2. **Mobile-first** parce que 80% du trafic l'est.
3. **Système, pas one-shot.** Tokens partout, jamais de magic numbers.
4. **Performance = design.** Un design qui blank-screen 2 s n'est pas un bon design.
5. **Accessibilité = design.** Contrastes WCAG AA, pas négociables.
6. **RTL = design natif.** Pas un mode "support".
7. **Conversion = design.** Chaque élément doit servir un job to be done.

## Fichiers de cette section

- [`README.md`](README.md) — ce fichier
- [`design-tokens.yaml`](design-tokens.yaml) — tokens couleurs/typo/spacing/radii/shadows
- [`components-spec.md`](components-spec.md) — spec détaillée chaque composant (états, variantes)
- [`wireframes-user.md`](wireframes-user.md) — wireframes ASCII pour user-facing
- [`wireframes-admin.md`](wireframes-admin.md) — wireframes ASCII pour admin manager
- [`copy-guidelines.md`](copy-guidelines.md) — voice & tone, microcopy patterns

## Lien avec Tailwind

Tous les tokens du `design-tokens.yaml` se traduisent en `tailwind.config.ts`. Le DS frontend doit consommer **les classes Tailwind utility** (pas du CSS custom inline) sauf pour des animations Framer Motion.

```yaml
# Exemple : token primary
color.primary.500: "#6B46C1"
# → tailwind class: bg-primary-500, text-primary-500
```

## Inspirations & moodboard

| Marque | Élément emprunté |
|---|---|
| Apple (iMessage) | Bulles arrondies, ombres douces, microinteractions |
| Stripe | Système de couleurs purple + rigueur typographique |
| Glossier | Voix produit (intime, proche) |
| Notion | États focus/hover discrets, focus ring violet |
| Linear | Cadence rapide, transitions sub-200ms |

Aucune marque copiée — synthèse créative.

## Process de design

1. **Wireframe ASCII** → validation logique (dans ce dossier).
2. **Mockup Figma** → maquettes haute fidélité (lien Figma dans `.notion`).
3. **Prototype interactif Figma** → validation parcours, tests utilisateurs.
4. **Handoff dev** → tokens YAML + components-spec.md.
5. **Live preview** → Storybook (`pnpm storybook`).

## Gouvernance des tokens

| Action | Qui peut |
|---|---|
| Ajouter un token | Designer + dev lead chat |
| Modifier un token (breaking) | Designer + product owner |
| Renommer un token | Designer + dev (avec migration script) |
| Supprimer un token | Designer + product owner (avec deprecation 1 release) |

Toute modification de `design-tokens.yaml` → PR avec :
- Avant/après visuel (capture Storybook).
- Liste des composants impactés.
- Approval du designer.

## Lien tokens ↔ existant

Le repo a déjà `lib/admin/chat-v2/design-system/` partiellement. La v2 du dossier consolide tout dans :
- `design-tokens.yaml` (source de vérité).
- Generator script `pnpm tokens:gen` qui produit `tailwind.config.ts` et CSS custom properties.
