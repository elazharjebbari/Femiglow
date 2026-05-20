# 02 — Vision & objectifs

## 1. Vision en une phrase

> Transformer la grille de 4 étapes d'une **liste statique de gestes** en
> une **timeline rythmée et chiffrée** qui réduit l'anxiété d'usage,
> ancre le résultat « miroir » et relance le funnel d'achat — sans
> briser la voix lente FemiGlow.

## 2. Personae visées

| Persona | Avant la refonte | Après la refonte |
|---|---|---|
| Lectrice première visite | « Ça a l'air bien, mais combien de temps ? » | « 5 minutes, 4 gestes. Je peux le faire. » |
| Cliente comparant 2 marques | Lit en diagonale, sort sans CTA | Lit la timeline, clique « Démarrer le rituel » |
| Cliente revenante | A déjà acheté, vient voir le rituel | Trouve son repère visuel, partage la timeline |

## 3. KPIs précis

### 3.1 Engagement section

| KPI | Mesure | Baseline | Cible J+30 | Cible J+90 |
|---|---|---|---|---|
| `pack_steps_view` count / total `/kit` visits | IO 0.4 sur grille | — | ≥ 60 % | ≥ 75 % |
| `pack_steps_complete_view` count | IO 0.5 sur step 4 | — | ≥ 30 % | ≥ 50 % |
| Temps moyen passé sur grille | (IO complete - IO view) | ~6 s (estimé) | ≥ 12 s | ≥ 15 s |

### 3.2 Conversion

| KPI | Mesure | Baseline | Cible J+30 | Cible J+90 |
|---|---|---|---|---|
| `pack_steps_cta_click` count | Click PostCtaLink | — | ≥ 3 % visiteurs `/kit` | ≥ 5 % |
| Lift CTR « Commander le rituel » | A/B test (avec/sans grille refondue) | 6 % | +1 pt (= 7 %) | +2 pts (= 8 %) |

### 3.3 Performance / UX

| KPI | Cible |
|---|---|
| Lighthouse `/kit` mobile | ≥ 92 (préservé) |
| CLS | ≤ 0.05 (les durées ne provoquent pas de reflow) |
| Bundle delta `/kit` | ≤ +3 kB gzipped |
| Axe violations sérieuses/critiques | 0 |

## 4. Tracking events à introduire

| Event | Trigger | Params Zod | Quand |
|---|---|---|---|
| `pack_steps_view` | IO 0.4 sur `<StepsTimeline>` | `{layout: 'mobile' \| 'desktop', total_steps: 4, total_duration_label: '5 minutes'}` | Une fois par session |
| `pack_steps_complete_view` | IO 0.5 sur step 4 | `{}` | Une fois par session |
| `pack_steps_cta_click` | Click `PostCtaLink` post-grille | `{cta_target: '#commander-femiglow'}` | À chaque clic |

(Optionnel itération suivante — pas dans le scope G0-G4) :
- `pack_steps_step_view` (par step IO 0.5) — segmentation fine
- `pack_steps_step_hover` (desktop) — heatmap intent

## 5. Décisions éditoriales

| Champ | Valeur retenue |
|---|---|
| Kicker header | « EN TOUT » |
| Titre header | « 5 minutes le soir » |
| Lead header | « Quatre gestes lents, une fois par semaine. » |
| Durée step 1 | « 30 s » |
| Durée step 2 | « 1 min » |
| Durée step 3 | « 2 min » |
| Durée step 4 | « 1 min » |
| Outcome step 4 | « L'ongle devient miroir » (italique display) |
| Badge step 4 | « RÉSULTAT » sous la pastille |
| Label CTA post-grille | « Démarrer le rituel ↓ » |
| Ancre cible CTA | `#commander-femiglow` |

Tous éditables via override admin singleton `kit-steps` (Phase G5).

## 6. Critères de réussite

La refonte est considérée réussie quand :

- [ ] `pack_steps_view` ≥ 60 % à J+30 (mesuré sur 14 jours)
- [ ] `pack_steps_complete_view` ≥ 30 % à J+30
- [ ] `pack_steps_cta_click` ≥ 3 % à J+30
- [ ] Lighthouse `/kit` mobile inchangé (≥ 92)
- [ ] Zéro régression sur les composants adjacents (PriceBlock,
      PackVisualBound, Claims, SocialProof)
- [ ] Axe 0 violation sérieuse/critique
- [ ] Tests vitest + Playwright 100 % verts
- [ ] Validation visuelle sur 3 viewports (375 / 768 / 1280)

## 7. Anti-objectifs

Ce qu'on **ne cherche PAS** à faire :

- Pas d'animation criarde, pas de pulse multiple, pas de « wow effect »
- Pas de vidéos intégrées par step (la section vidéo `/kit` les a déjà)
- Pas de countdown / urgency (incompatible voix maison)
- Pas de mention nominale fondatrice
- Pas de cliché orientaliste (zellige bleu, lanterne) — voix lente FemiGlow uniquement
- Pas de remplacement complet du composant — c'est une **évolution
  incrémentale** rétro-compatible
