# Nouveau spot : "Plaque Reviews"

Objectif : créer un spot différent des hotspots pulsés (plus premium, plus "décor").

## Concept visuel
- Une petite plaque semi-transparente (glass) fixée sur un tableau.
- Un badge note (ex: 4.9★) visible.
- Pas de pulse.
- Hover (desktop): légère élévation + glow doux.
- Focus (clavier): ring visible.

## Paramètres style (via hotspot.style JSON)
- preset: "review_plaque"
- pulse: false
- dot_visible: false
- ring_width_px: 1
- glow_intensity: 0.25
- hover_expand: true
- blur_px: 6

## Tooltip
- label: "Avis clients"
- sublabel: "Voir 39 avis"

## Accessibilité
- Element focusable.
- aria-label explicite.
