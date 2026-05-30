# F01 — Stepper Progress

## Objectif
Permettre à l'opérateur de comprendre où il en est dans le parcours de création (Cadrer → Générer → Visuel → Valider) et de naviguer en arrière sans perdre son travail.

## Comportement attendu

### Affichage
- 4 étapes visibles : Cadrer (frame), Générer (generate), Visuel (visual), Valider (validate)
- Pour chaque étape : un cercle avec numéro (ou check si complétée), un libellé, une description sous le libellé
- Connecteurs visuels (lignes) entre étapes
- En tête : badge "Mode mock" si `CONTENT_STUDIO_V2_MOCK_MODE=true`

### États
- **Active** : couleur accent (var(--cs-accent)), cercle plein, libellé bold
- **Complétée** : cercle vert avec icône Check, libellé normal
- **Future** : cercle gris, opacité 0.6 ; cliquable mais affiche tooltip "Complétez l'étape X pour continuer"
- **Passée navigable** : cercle vert, cliquable, scroll vers le composant correspondant

### Dérivation de l'étape active
L'étape active dérive **directement** de `draft.status` (source de vérité unique) :
- `idea` ou `brief` → frame
- `generated` → generate
- `needs_review` → visual
- `approved`, `scheduled`, `published`, `failed` → validate
- `rejected`, `archived` → frame (vue spéciale)

Pas de logique de "hasMedia + caption" comme aujourd'hui : si l'utilisateur attache un média, le draft passe par `POST /drafts/:id/review` au moment de la sélection variante, ce qui le pose en `needs_review` proprement.

### Navigation
- **Cliquer sur étape passée** : `onStepClick(stepKey)` scrolle vers le composant correspondant (smooth) et focus le premier champ interactif
- **Cliquer sur étape future** : tooltip explicatif, aucun effet
- **Cliquer sur étape active** : aucun effet (reste sur place)

### Aria
- `<ol role="list" aria-label="Étapes de création">`
- Chaque step : `<button aria-current={isActive ? 'step' : undefined}>`
- Disabled steps : `aria-disabled="true"` avec `tabIndex={-1}`

## Pré-requis techniques

- Recevoir `draft` en prop (peut être null)
- Lire `mockMode` depuis le contexte ou via API health
- Callback `onStepClick(key)` fourni par le parent

## Composant cible

```tsx
<Stepper
  draft={selectedDraft}
  mockMode={mockMode}
  onStepClick={(key) => scrollToSection(key)}
/>
```

## Tests à écrire

Voir `test-scenarios.yaml`.
