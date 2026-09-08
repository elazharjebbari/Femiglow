# 02 — UI/UX & fonctionnement détaillé

Deux surfaces : **A. le rail de bulles** (inline, léger) et **B. le viewer** (overlay plein écran).

## A. Le rail de bulles (`StoriesRail`)

**Rendu** : liste horizontale scroll-snap — on réutilise le pattern éprouvé de
`src/components/commerce/HandsTestimonialCarousel.tsx` (`flex snap-x snap-mandatory overflow-x-auto`,
items `shrink-0 snap-start`, `role="list"`, `tabIndex=0`). Pas de librairie carousel.

**Une bulle** =
- Cercle 72 px (mobile) / 80 px (desktop), `<button>` natif (clavier + focus ring champagne).
- Fond = **poster** de la story (variant `format='poster'` WebP, ~5–15 kB) via `next/image`
  `sizes` serré ; `loading="lazy"` sauf la 1ʳᵉ.
- **Anneau d'état** : dégradé « non-vu » (accent marque) vs gris « vu » (persistance
  `localStorage: fg_stories_seen`).
- **Libellé** court sous le cercle (2 lignes max, tronqué), i18n (`marketing.kit.stories.*`).
- `aria-label` = « Ouvrir la story : {titre} ({n} segments) ».

**Payload** : le rail ne charge **que des posters**. Aucune vidéo, aucun JS de player. Impact
quasi nul sur le poids initial et le LCP. Décodage des posters différé via `useMediaInView`
(`src/lib/media/hooks/useMediaInView.ts`) si le rail est bas dans la page.

**États** : chargé / vide (rail masqué si 0 story) / erreur feed (masqué, non bloquant).

## B. Le viewer (`StoryViewer`) — overlay plein écran

**Montage** : ouvert au tap d'une bulle. **Code-splitté** (`next/dynamic(() => import(...),
{ ssr:false })`) → le bundle du viewer + la logique player ne sont téléchargés **qu'à la 1ʳᵉ
ouverture**. Rendu dans un **React portal** (`fixed inset-0 z-[60]`, fond noir), body scroll-lock.

### Structure visuelle (haut → bas)
1. **Barres de progression segmentées** — une barre par segment de la story courante ; la barre
   active se remplit en fonction de la lecture (vidéo `timeupdate` ou timer pour image). Barres
   passées = pleines, futures = vides. **Miroir en RTL**.
2. **Header** — titre de la story · bouton **mute/unmute** · bouton **X** (fermer).
3. **Média** — segment courant en 9:16 centré (`aspect-[9/16]`, `object-cover`), fond noir.
   Rendu délégué au player (voir §03) : `<video autoPlay muted playsInline>` multi-`<source>`
   webm+mp4, poster affiché tant que la 1ʳᵉ frame n'est pas prête.
4. **Footer** — **CTA** primaire (ex. « Commander le pack ») + légende optionnelle. Le CTA
   réutilise la logique de `CommanderAnchorButton` : ferme le viewer, scrolle vers
   `#commander-femiglow` (le wizard), émet `story_cta_click` + `add_to_cart`/`cta_click`.

### Interactions (gestes & clavier)
| Action | Geste (LTR) | Clavier | Effet |
|---|---|---|---|
| Segment suivant | tap zone **droite** (70 %) | `→` | segment+1, sinon story suivante |
| Segment précédent | tap zone **gauche** (30 %) | `←` | segment−1, sinon story précédente |
| Pause / reprise | **maintien** (long-press) | `Espace` | gèle la lecture + les barres |
| Mute / unmute | bouton | `m` | son on/off (persisté) |
| Fermer | swipe **bas** / X | `Échap` | ferme, restaure le scroll page |
| Story suivante/préc. | swipe **latéral** | — | change de bulle sans repasser par le rail |

> **RTL (arabe)** : zones tap et sens des swipes **inversés**, ordre des barres et des bulles
> miroir. Piloté par `getLocaleConfig(locale).direction` + variants Tailwind `rtl:`.

### Lecture & auto-advance
- Chaque segment : autoplay **muet** au montage. À la fin (`onEnded`/`video_complete`) → segment
  suivant automatiquement. Segment image (si un jour) → timer de `durationMs`.
- **Préchargement** : seul le **segment suivant** est préchargé (`preload="metadata"` + poster) ;
  les autres restent des URLs non chargées. Le segment N−1 est déchargé quand on avance.
- **Pause** au long-press, au passage en arrière-plan (`visibilitychange`), et si
  `prefers-reduced-motion` → pas d'auto-advance, contrôles play/pause visibles.

### États du viewer
`loading` (poster + spinner discret) · `playing` · `paused` · `ended-segment` (transition) ·
`ended-story` (→ story suivante ou fermeture) · `error` (skip segment + toast discret).

### Accessibilité
- **Focus trap** dans l'overlay ; focus initial sur le média/close ; retour du focus sur la bulle
  d'origine à la fermeture.
- `role="dialog" aria-modal="true" aria-label="{titre story}"`. Barres de progression
  `role="progressbar" aria-valuenow`. Boutons avec `aria-label`.
- Zones tap = `<button>` invisibles labellisées (« segment suivant/précédent ») — pas des `div`.
- **Reduced-motion** : transitions instantanées, pas d'auto-advance, contrôles explicites.
- Le viewer ne doit jamais déclencher de dialog natif bloquant.

### Design tokens
Tokens maison (`champagne`, `encre`, `creme`, `sauge`, `terracotta`), anneau non-vu en dégradé
accent, animations sous `motion-safe:`. Cohérence avec la charte /kit existante.

## C. Parcours nominal (happy path)
1. La cliente voit le rail (posters) après le Hero.
2. Tap sur « Les 4 gestes » → viewer s'ouvre (`story_open`), 1ᵉʳ clip joue muet.
3. Elle tape à droite pour avancer, maintient pour observer un geste (`story_pause`).
4. Au segment « résultat », le CTA « Commander » attire → tap (`story_cta_click`).
5. Viewer se ferme, scroll animé vers le wizard `#commander-femiglow`, `add_to_cart` émis.
6. Elle complète le wizard → `purchase`. Funnel entièrement attribué `story_id`.
