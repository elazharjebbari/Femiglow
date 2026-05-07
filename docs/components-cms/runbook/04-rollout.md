# R4 — Rollout par page-group

> Déploiement progressif. Aucun big-bang. Chaque phase ajoute une
> surface de risque limitée, avec rollback indépendant. Les fields
> non encore migrés continuent de fonctionner via les valeurs codées
> en dur.
>
> Durée totale : **3 à 4 semaines** une fois le moteur (P1–P11) en
> place.

## Principe directeur

```
Avant la phase N             Après la phase N
─────────────────             ──────────────────
Texte codé en dur     ───►   <ComponentField/> + binding 'published' v1
                              identique au texte codé
```

Tant qu'aucun admin ne publie, **rien ne change visuellement**. La
phase N ne fait qu'**ouvrir** la possibilité d'éditer.

## Phase 1 — Infra (1 PR, jour 1)

### Ce qui ship

- Migrations : `component_field_bindings`, `component_field_history`.
- Colonne `fields` jsonb sur `site_components`.
- Pipeline de seed (B4) actif, mais le registre déclare `fields: []`
  pour tous les composants → **0 binding créé**.
- Routes API admin (squelette + handlers MSW).
- Cron `promote-scheduled-fields` enregistré (idle, 0 binding
  scheduled).

### Risque

**Quasi nul.** Aucun composant n'utilise `<ComponentField>`. Le
rendu public est strictement identique.

### Rollback

```bash
# 1. Revert PR
git revert <sha>

# 2. (optionnel destructif) drop tables
psql $DATABASE_URL <<SQL
  DROP TABLE component_field_history;
  DROP TABLE component_field_bindings;
  ALTER TABLE site_components DROP COLUMN fields;
SQL
```

### Critères de succès

- [ ] Migration appliquée en prod sans erreur
- [ ] `pnpm next build` passe en CI
- [ ] Aucune régression Playwright
- [ ] `SELECT count(*) FROM component_field_bindings` = 0

## Phase 2 — Layout (Header / Footer) (1 PR, jour 2-3)

### Ce qui ship

- Déclaration de fields pour `header` et `footer` :
  - Header : `nav-cta-label`, `nav-cta-href`.
  - Footer : `tagline`, `legal-line`, `social-instagram-href`,
    `social-instagram-label`.
- Adaptation des RSC `Header.tsx` et `Footer.tsx` pour utiliser
  `<ComponentField>`.
- Seed local + prod → 6 bindings v1.
- Catalog `catalog/layout-header.md`, `catalog/layout-footer.md`.

### Pourquoi commencer ici

- Surface visuelle minime mais **ubiquitaire** (toutes les pages).
- Si un bug du résolveur existe, on le voit partout et vite.
- Bon ratio « valeur démontrée / risque ».

### Comm fondatrice

> *« Je peux maintenant changer le tagline du footer depuis l'admin.
> Pas urgent, mais essaie quand tu auras 5 min, on verra ensemble si
> l'expérience est bonne. »*

Aucune session de formation à ce stade.

### Critères de succès

- [ ] Tagline footer édité depuis l'admin se reflète sur la home en
      ≤ 60 s.
- [ ] Lighthouse / Web Vitals inchangés (TTFB ≤ +5 ms).
- [ ] 0 incident remonté en 48 h.

### Rollback

Reverter la PR : les `<ComponentField>` redeviennent du texte en dur.
Les bindings DB deviennent orphelins puis archivés au seed. Aucune
perte de service.

## Phase 3 — Page Home (jour 4-7)

### Ce qui ship

Composants migrés :

- `home-hero` (kicker, title, subtitle, primary-cta, secondary-cta)
- `home-avis-strip` (kicker, title, items: list of quote)
- `home-promesses` (3 promesses : kicker + body)
- `home-rituel-teaser` (title, body, cta)
- `home-cross-links` (title, items: list of breadcrumb-segment + image)

Cible : ~25 fields, 5 composants.

### Comm fondatrice

> Premier vrai écran. Session de formation **avant** la mise en prod
> (~30 min) :
>
> 1. Démo : éditer le titre du hero, voir le live-preview.
> 2. Démo : programmer une publication.
> 3. Démo : restauration d'une version précédente.
> 4. La fondatrice fait un edit elle-même (avec coaching).

### Critères de succès

- [ ] Fondatrice publie au moins 1 modification sur la home dans les
      72 h suivant le go-live.
- [ ] Aucun signalement « j'ai cassé quelque chose ».
- [ ] Web Vitals home inchangés (LCP, CLS).

### Rollback

Revert composant par composant si besoin. Granularité PR.

## Phase 4 — Maison + Boutique (jour 8-12)

### Ce qui ship

- Page Maison : ~6 composants (`maison-hero`, `maison-rituel`,
  `maison-actifs`, `maison-cross-links`, `maison-faq`, `maison-cta`).
- Page Boutique : ~5 composants (`boutique-hero`, `boutique-grid-header`,
  `boutique-promise-strip`, `boutique-cross-links`, `boutique-faq`).

Cible : ~50 fields, 11 composants.

### Comm fondatrice

> Pas de session dédiée. Mention dans le standup : « Maison et
> Boutique éditables maintenant, comme la Home. Liste des champs
> dans le catalogue. »

### Critères de succès

- [ ] Catalog complet pour les 11 composants.
- [ ] Tests Playwright nominaux verts.
- [ ] Aucune régression de SEO sur les pages produit (titres H1
      stables au déploiement).

## Phase 5 — Journal (jour 13-18)

### Ce qui ship

> **Phase la plus délicate** : volume de rich-text élevé, avec
> markdown sanitization en jeu.

- Templates d'articles (`journal-article-hero`, `journal-article-body`,
  `journal-article-cta`, `journal-article-related`).
- Cards et listings (`journal-card`, `journal-listing-header`).
- Citation block, image-with-caption, pull-quote.

Cible : ~30 fields, dont ~10 rich-text.

### Précautions

- Le sanitizer est testé avec **15+ vecteurs XSS** (cf. T2).
- Allowlist HTML : `h2, h3, p, ul, ol, li, strong, em, a, blockquote, br`.
- Pas de `iframe`, `script`, `style`, `img` (les images passent par
  `<ComponentMedia>`, pas par le rich-text).
- Le `cta.href` ne peut pointer que vers les hôtes de
  `COMPONENTS_FIELDS_ALLOWED_HOSTS` (cf. R1).

### Comm fondatrice

> Session de **45 min** centrée sur l'éditeur rich-text :
>
> 1. Markdown vs WYSIWYG (le choix retenu).
> 2. Hiérarchie des titres (H2/H3, pas de H1 — il est posé par le
>    template).
> 3. Liens internes vs externes (les externes sont validés contre
>    une allowlist).
> 4. Programmation d'un article.

### Critères de succès

- [ ] 1 article complet édité depuis l'admin sans intervention dev.
- [ ] 0 violation a11y détectée par axe-core.
- [ ] Lighthouse Journal ≥ 90.

## Phase 6 — Affinement et monitoring (jour 19-25)

### Ce qui ship

- **Pas de migration de composant.** Phase de stabilisation.
- Dashboard d'observabilité : volumes de publications, conflits,
  échecs cron.
- Alertes : `field.schedule.failed` > 1/h → page astreinte.
- Tuning du cache : analyse hit-rate par page-group, ajustement de
  la granularité des tags.
- Onboarding du runbook chez la fondatrice (où trouver chaque écran,
  comment lire les badges).
- Recueil de feedback UX → backlog v1.1.

### Critères de succès

- [ ] Hit-rate cache RSC ≥ 95 % sur 7 j glissants.
- [ ] p95 publish-to-render-fresh ≤ 60 s.
- [ ] Backlog v1.1 priorisé.

## Tableau récapitulatif

| Phase | Surface | Fields | Risque | Durée | Rollback |
|-------|---------|--------|--------|-------|----------|
| P1 Infra | DDL + API squelette | 0 | Très faible | 1 j | Revert + drop tables |
| P2 Layout | Header / Footer | 6 | Faible | 1-2 j | Revert PR |
| P3 Home | 5 composants | ~25 | Moyen | 3-4 j | Revert composant par composant |
| P4 Maison + Boutique | 11 composants | ~50 | Moyen | 4-5 j | Revert PR par page |
| P5 Journal | Rich-text intensif | ~30 | Élevé (XSS) | 5-6 j | Revert + invalidate cache |
| P6 Stabilisation | n/a | 0 | Faible | 5-7 j | n/a |

Total cumulatif : ~110 fields, 30 composants migrés.

## Bonnes pratiques inter-phase

### Avant chaque phase

```
[ ] Suite Vitest verte (tous tests existants)
[ ] Suite Playwright verte
[ ] Diff DB inspecté (pas de migration imprévue)
[ ] Plan de comm fondatrice si changement perceptible
[ ] Liste de checks post-déploiement
```

### Après chaque phase

```
[ ] Smoke test manuel : 1 publish, 1 schedule, 1 restore
[ ] Vérification cron promote-scheduled-fields a tourné
[ ] Pas d'incident en 48 h
[ ] Catalog mis à jour
[ ] Annonce dans le standup hebdo
```

## Communication à la fondatrice

| Étape | Format | Objectif |
|-------|--------|----------|
| Pré-P1 | Email | Annonce du chantier, calendrier, pas de changement visible. |
| Pré-P2 | Slack/SMS | Tu peux tester l'édition du footer si tu veux. |
| Pré-P3 | Session 30 min en visio | Démo + premier edit guidé sur la home. |
| Pré-P5 | Session 45 min | Rich-text et règles de sécurité. |
| Post-P5 | Doc PDF (1 page) | Mémo d'édition rapide. |
| Pré-P6 | Standup | Stabilisation, pas de nouveau composant. |

## Cross-references

- Bootstrap → R1
- Ajout simple → R2
- Ajout composant → R3
- Incident → R5
- Phases techniques de build → P1 (`action-plan/01-phases.md`)
- Risques associés → P3 (`action-plan/03-risks.md`)
