# 50.1 — Principes UX globaux (tracking admin)

## 1. Confiance avant friction

L'admin tracking manipule des configurations qui impactent les conversions
et donc le ROI publicitaire. Chaque action doit inspirer confiance :
- **Aperçu avant action** : montrer ce qui va changer AVANT de cliquer
- **Diff visuel** : signaler les divergences (champ rouge, badge ⚠)
- **Undo immédiat** : toute action est réversible (toast "Annuler" 5s)
- **Audit trail** : qui a modifié quoi quand

## 2. SSOT visible

Une seule source de vérité par concept. Quand deux endroits peuvent
contenir la même info, il faut :
- Soit fusionner (Approche A de l'audit)
- Soit afficher un indicateur de divergence (Approche B)

Aucun écran ne doit demander à l'admin "où est la bonne valeur ?".

## 3. Décision graduée

Les écrans critiques (Google Ads OAuth, destruction de versions) suivent
le pattern : Welcome → Choix → Préview → Confirm → Execute → Report.

Pour les actions légères (modifier une catégorie d'event) : edit in-place
avec toast de confirmation.

## 4. Hiérarchie visuelle claire

| Niveau | Usage | Exemple |
|---|---|---|
| H1 (display-md, 32-48px) | Page title | "Versions GTM" |
| H2 (text-xl, 20px) | Section | "Production" |
| H3 (text-base bold) | Sub-section | "Google Ads" |
| Body (14-16px) | Texte courant | Description, labels |
| Caption (11px) | Hints, timestamps | "il y a 3 j par Sara" |

## 5. Statuts visuels

| Statut | Couleur | Usage |
|---|---|---|
| Success / Active | `emerald-700` | Active version, success rate > 95% |
| Warning | `amber-700` | Divergence, success rate 70-95% |
| Error / Critical | `rose-700` | Error rate > 30%, action irréversible |
| Info | `stone-700` | Default, neutral |
| Disabled | `stone-400` | Désactivé |

## 6. Bouton primaire = action principale

Un seul bouton primaire par écran. Les autres actions sont secondaires
(outline) ou tertiaires (link).

```
[Bouton primaire (action principale)]   [Bouton outline]   [link]
```

Couleurs des boutons primaires :
- Action neutre : `bg-stone-900 text-white`
- Action destructive : `bg-rose-700 text-white`
- Action positive (publish, activate) : `bg-emerald-700 text-white`

## 7. Feedback immédiat

Toute action doit produire un feedback en < 200ms :
- Click → micro animation (scale 0.97 → 1)
- Submit → loader inline + bouton disabled
- Success → toast vert (5s auto-dismiss)
- Error → bannière inline (persistante jusqu'à correction)
- Network slow → loader avec "Encore quelques secondes…"

## 8. Mobile last (mais responsive)

L'admin est utilisée principalement desktop. Mais les pages doivent rester
lisibles mobile (responsive Tailwind `sm:` et `md:`).

Pas de touch-optimisations agressives (drag and drop = mouse-friendly).

## 9. Accessibilité par défaut

- Tab navigable
- ARIA labels sur tous les éléments interactifs
- Contraste AA min (WCAG 1.4.3)
- Focus visible (WCAG 2.4.7)
- Pas de truc bloqué par le clavier seul

## 10. Performance perçue

- Skeleton loaders (pas spinners) pour > 300ms
- Optimistic updates pour les actions courtes
- SWR cache pour éviter les re-fetches inutiles
- Pas de fullscreen loader (sauf premier paint)
