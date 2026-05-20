# 10 — Critères d'acceptation et non-régression

Checklist exhaustive pour valider chaque phase et garantir l'absence de régression. À utiliser en revue de PR et en smoke post-déploiement.

## 1. Critères globaux (toute phase)

Avant merge :

- [ ] `pnpm typecheck` clean.
- [ ] `pnpm -r lint` clean.
- [ ] `pnpm vitest run` 100 % vert.
- [ ] `pnpm playwright test --grep '@composition'` 100 % vert.
- [ ] Couverture `lib/composition/**` ≥ 90 % branches.
- [ ] Couverture `components/kit/Composition*` ≥ 85 % branches.
- [ ] Couverture `components/admin/kit/**` ≥ 80 % branches.
- [ ] Pas de nouvel `eslint-disable` sans commentaire justificatif.
- [ ] Aucun `console.log` oublié.
- [ ] Tous les commits respectent la convention `feat(composition)` / `test(composition)` / `chore(composition)`.
- [ ] Snapshot Playwright stable 3 runs consécutifs en local.

## 2. Phase 0 — Quick wins visuels

### 2.1 Acceptation

- [ ] Section `composition-title` rend sur fond `#EFE9DD` (sable).
- [ ] Cards ont bordure `#C7CCC2` + fond `#FBFAF6` + padding `p-4 sm:p-5`.
- [ ] Titre intègre le volume en lowercase et inline : `1 Paste · 15 g`.
- [ ] Volume utilise `font-variant-numeric: tabular-nums`.
- [ ] Lien de fin : `Lire le détail ↓` (pas `Voir la composition`).
- [ ] Aucune régression sur le reste de `/kit` (Hero, sticky, FAQ, etc.).

### 2.2 Smoke test post-déploiement

```bash
curl -s https://femiglow.ma/kit | grep -c "Lire le détail"
# Attendu: 3
curl -s https://femiglow.ma/kit | grep -c "Voir la composition"
# Attendu: 0
```

## 3. Phase 1 — Schema étendu

### 3.1 Acceptation

- [ ] `subProductSchema` accepte `sensation`, `contextualImage`, `accentColor` optionnels.
- [ ] `sensation` exige ponctuation finale (`.`, `!`, `?`, `»`).
- [ ] `accentColor` enum strict `sauge | petale | ciel | champagne`.
- [ ] `mockKitPageContent` passe `kitPageContentSchema.parse()` sans erreur.
- [ ] Les 3 sous-produits ont `sensation` et `accentColor` renseignés.

### 3.2 Non-régression

- [ ] Tests `feed.xml/route.test.ts` passent.
- [ ] Tests `feed-xml-endpoint.test.ts` passent.
- [ ] Tests `kit-feed.test.ts` passent.
- [ ] Aucun champ obligatoire ajouté qui casserait un appelant existant.

## 4. Phase 2 — `CompositionCard`

### 4.1 Acceptation

- [ ] Pastille numérotée `01`, `02`, `03` visible en haut-gauche de chaque card.
- [ ] Couleur de pastille reprend `accentColor` (sauge / petale / ciel / champagne).
- [ ] Volume inline avec titre : `Paste · 15 g` (séparateur `·`).
- [ ] Sensation en italique Cormorant Garamond, encadrée par `« … »`.
- [ ] Si `sensation` absente, aucune ligne dédiée n'apparaît.
- [ ] Lien `Lire le détail ↓` pointe vers ancre INCI correcte.
- [ ] `CompositionReveal` n'utilise plus `ProductCard`.

### 4.2 Non-régression

- [ ] `ProductCard` reste fonctionnel (non supprimé encore).
- [ ] Snapshot DOM de `CompositionReveal` met à jour cleanly via `--update`.
- [ ] Le contrat `kitPageContentSchema` reste respecté.

## 5. Phase 3 — Crossfade

### 5.1 Acceptation

- [ ] Desktop : hover déclenche fade vers contextuelle (500 ms).
- [ ] Mobile : tap toggle entre isolated et contextual.
- [ ] Clavier : `Enter` ou `Space` toggle le crossfade.
- [ ] `role="button"`, `aria-pressed` mis à jour à chaque toggle.
- [ ] Si `contextualSlot` absent → pas de bouton interactif, pas de toggle.
- [ ] `prefers-reduced-motion: reduce` → pas de transition CSS (fallback instantané).
- [ ] Image isolated reste visible si JS désactivé (progressive enhancement).

### 5.2 Non-régression

- [ ] Le rendu desktop sans hover initial est identique à phase 2.
- [ ] Le `kit-comparatif` registry continue d'exposer les 3 slots originaux.
- [ ] Les anciens bindings Component-Media restent valides.

## 6. Phase 4 — Animations

### 6.1 Acceptation

- [ ] Card apparaît avec opacity 0 → 1 + translateY 12 → 0 sur scroll.
- [ ] Stagger 120 ms entre cards.
- [ ] Durée 600 ms.
- [ ] Animation joue une seule fois (`once: true`).
- [ ] `prefers-reduced-motion: reduce` → aucune animation, cards visibles d'emblée.

### 6.2 Non-régression

- [ ] Aucune autre section de `/kit` n'a vu son comportement de scroll changer.
- [ ] LCP `/kit` ≤ 2,5 s (cible WebVitals).
- [ ] Bundle size augment ≤ 10 kb gzip pour la phase Framer Motion (déjà chargé ailleurs).

## 7. Phase 5 — Vue éclatée

### 7.1 Acceptation

- [ ] Visuel exploded rendu en tête de section, **avant** la grille 3 cards.
- [ ] Responsive : 3 tailles (mobile, tablet, desktop).
- [ ] Fond visuel cohérent avec la section (sable `#EFE9DD`).
- [ ] `alt` descriptif (« Vue éclatée du Kit FemiGlow… »).
- [ ] Composant rétrocompat : si `exploded` absent dans content, la figure n'est pas rendue.

### 7.2 Non-régression

- [ ] Si le visuel n'est pas binded en DB, rendu inchangé vs phase 4.
- [ ] CLS n'augmente pas (image avec dimensions intrinsèques).

## 8. Phase 6 — Admin éditeur

### 8.1 Acceptation index `/admin/kit/composition`

- [ ] Liste affiche 3 cards (Paste, Powder, Polissoir).
- [ ] Chaque card affiche statut (`Brouillon`, `Publié`, `Mock`).
- [ ] Click sur une card navigue vers `/admin/kit/composition/[id]`.

### 8.2 Acceptation éditeur `/admin/kit/composition/[id]`

- [ ] Formulaire pré-rempli avec valeurs courantes (override DB ou mock fallback).
- [ ] Aperçu live à droite met à jour à chaque keystroke.
- [ ] Sections collapsibles : Identité, Description, Image isolée, Image contextuelle, Ingrédients, Certifications.
- [ ] AccentColorPicker rend 4 radios avec preview color chip.
- [ ] Validation Zod côté UI affiche les erreurs sous chaque champ invalide.
- [ ] Save crée/update un brouillon. Toast confirmation.
- [ ] Publish désactivé si dirty. Click → publie + toast.
- [ ] Reset ouvre modale `RESET-<id>`. Bouton confirmer désactivé tant que la saisie ne correspond pas.
- [ ] Reset valide → DELETE override + retour mock + toast.

### 8.3 Acceptation API

- [ ] `PATCH /api/admin/kit/composition/[id]` exige session admin (401 sinon).
- [ ] `PATCH` valide le body via Zod (422 si invalide).
- [ ] `PATCH` succès → 200 avec settings updated.
- [ ] `POST /publish` revalide `tag('kit-composition')`.
- [ ] `POST /reset` supprime l'override DB.

### 8.4 Non-régression

- [ ] Pages admin existantes (`/admin/seo`, `/admin/components`, etc.) restent fonctionnelles.
- [ ] Cascade `mock → override → publish` cohérente.
- [ ] Audit events `composition.draft|publish|unpublish|reset` posés dans `auditEvents`.

## 9. Phase 7 — E2E + a11y

### 9.1 Acceptation

- [ ] Spec `@composition-render` : 3 cards visibles, numéros `01`/`02`/`03`, fond sable.
- [ ] Spec `@composition-interaction` : hover/tap déclenche crossfade.
- [ ] Spec `@composition-admin` : parcours nominal édition + publish + reset.
- [ ] Spec `@composition-a11y` : 0 violation axe sur `/kit` et `/admin/kit/composition/*`.
- [ ] Aucun flake en 5 runs consécutifs.

### 9.2 Non-régression

- [ ] Tous les autres tags Playwright (`@kit`, `@admin-seo`, `@og`, etc.) continuent de passer.
- [ ] Latence d'exécution Playwright `@composition` ≤ 60 s total.

## 10. Phase 8 — Cleanup

### 10.1 Acceptation

- [ ] `ProductCard` supprimé.
- [ ] Aucun import résiduel vers `ProductCard`.
- [ ] `apps/web/src/components/kit/README.md` créé et lisible.
- [ ] `pnpm typecheck` + `pnpm vitest run` verts.
- [ ] `pnpm --filter web build` réussit.

### 10.2 Non-régression

- [ ] Aucune section ne fait référence à `ProductCard` directement.
- [ ] Snapshot final de `CompositionReveal` identique à la fin de phase 4 (avant cleanup).

## 11. Critères de non-régression globaux

### 11.1 Métadonnées critiques

Pour `/kit`, **avant** et **après** chaque phase :

- [ ] `<title>` inchangé.
- [ ] `<meta name="description">` inchangé.
- [ ] JSON-LD `Product` valide (Rich Results Test).
- [ ] OG image inchangée.
- [ ] Sticky cart CTA toujours visible au scroll.

### 11.2 Performance

- [ ] LCP `/kit` ≤ 2,5 s (mesure WebVitals).
- [ ] CLS ≤ 0,1.
- [ ] FID ≤ 100 ms.
- [ ] Bundle size gzip total augment ≤ 30 kb sur toute la refonte.

### 11.3 Accessibilité

- [ ] `/kit` axe 0 violations (post phase 7).
- [ ] `/admin/kit/composition/[id]` axe 0 violations (post phase 7).
- [ ] Navigation clavier complète sur la section et l'éditeur.
- [ ] Focus visible sur tous les éléments interactifs.

### 11.4 Comportement public

- [ ] Hover desktop déclenche crossfade en moins de 100 ms.
- [ ] Tap mobile toggle en moins de 100 ms.
- [ ] `prefers-reduced-motion` désactive toutes les animations.
- [ ] Le lien `Lire le détail ↓` scrolle vers l'ancre INCI correspondante.
- [ ] Aucun lien cassé.

### 11.5 Comportement admin (post phase 6)

- [ ] Édition save → publish → revalidation revient en < 5 s.
- [ ] Modification visible sur `/kit` après revalidation.
- [ ] Reset → mock TS revient en < 2 s.
- [ ] Modale reset bloque tant que `RESET-<id>` n'est pas tapé correctement.

## 12. Sign-off

Une phase est considérée comme close quand :

1. Toutes les cases à cocher de sa section sont validées.
2. Revue PR approuvée (ou auto-revue documentée si solo).
3. Smoke tests post-déploiement passés.
4. Aucune alerte 5xx dans les 24 h suivant le déploiement.

Le plan global est considéré comme livré quand :

- Phases 0-8 closes.
- Couverture tests atteinte (`07-tests-strategy.md` §6).
- KPIs `02-vision-objectifs.md` §2 mesurés et conformes.
- Documentation handoff (`apps/web/src/components/kit/README.md`) à jour.
- Au moins 1 éditeur non-développeur a publié une modification via `/admin/kit/composition` (validation usabilité).
