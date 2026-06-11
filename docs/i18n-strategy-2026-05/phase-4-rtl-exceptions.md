# Phase 4 RTL — Exceptions volontairement préservées

> Liste des occurrences `left-*` / `right-*` / `text-left` etc. que la
> migration logical properties a **volontairement préservées** (au lieu
> de migrer vers `start-*` / `end-*` / `text-start` etc.).
>
> Baseline pré-migration : 107 occurrences P0
> Post-migration : 1 occurrence préservée (cf. ci-dessous)
> Taux de migration : ≥ 99 %

## Exceptions

### 1. Centering hack avec `translate-x-1/2` (1 occurrence)

**Fichier** : `apps/web/src/components/kit/VideoPosterCover.tsx:209`

```tsx
className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 grid h-16 w-16 place-items-center rounded-full ..."
```

**Raison** : `left-1/2 -translate-x-1/2` est un *centering hack*
classique qui place l'élément à 50 % depuis le bord gauche, puis le
translate de -50 % de sa propre largeur — l'élément finit centré
horizontalement, **indépendamment de la langue**.

Tailwind 3.4 n'a pas d'équivalent logical pour `translate-x-*` (la
transform reste physique, contrairement à `inset-inline-start`). Si
on remplaçait `left-1/2` par `start-1/2`, en RTL on aurait `right: 50%`
mais `-translate-x-1/2` continuerait à translater vers la gauche
physique, ce qui décalerait l'élément hors du centre.

**Décision** : conserver `left-1/2 -translate-x-1/2` tel quel. Le
résultat visuel est identique en LTR et RTL (élément centré). C'est
donc un faux positif de l'audit.

## Patterns non comptés par l'audit mais à connaître

### Slideovers / drawers — `translate-x-full`

`MiniCartSlideOver.tsx` et autres drawers utilisent `translate-x-full`
pour masquer le panneau hors écran à droite. En RTL avec `end-0`, le
panneau est ancré à gauche, donc on a explicitement ajouté
`rtl:-translate-x-full` pour le faire glisser à gauche en RTL.

### Icônes directionnelles — chevrons & flèches

`HeroGalleryArrow.tsx` & `RitualPhotoLightbox.tsx` : on a appliqué
`rtl:scale-x-[-1]` (ou `rtl:rotate-180`) sur les SVG / spans contenant
les caractères ← → afin qu'ils pointent dans le sens de lecture en RTL.
Cf. Phase 4.5 du plan pour l'audit exhaustif des icônes.

### Chat panel / launcher

Avant migration, `ChatPanel.tsx` et `ChatLauncher.tsx` faisaient un
*manual RTL switch* via JS (`isRtl ? 'left-7' : 'right-7'`). On a
simplifié en utilisant les logical properties (`end-7`) qui font le
travail automatiquement. Le code est plus court et plus maintenable.

## Re-générer la baseline

```bash
python3 docs/i18n-strategy-2026-05/scripts/audit-rtl-classes.py \
  > docs/i18n-strategy-2026-05/phase-4-rtl-audit.csv \
  2> /tmp/audit-stats.txt
cat /tmp/audit-stats.txt
```

Cible : ≤ 10 occurrences (les exceptions documentées ci-dessus).
