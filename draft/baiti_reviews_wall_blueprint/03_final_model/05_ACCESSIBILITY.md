# Accessibilité (A11y) - Reviews Wall

Référence : WAI ARIA Authoring Practices - Dialog (Modal) Pattern.

## Exigences

### Dialog/drawer
- role="dialog" + aria-modal="true"
- aria-labelledby sur le titre
- Focus initial sur titre ou élément statique en haut
- Focus trap (Tab/Shift+Tab)
- ESC ferme
- Retour focus sur l'élément déclencheur (le spot)
- Contenu derrière inert (visuellement + interaction)

### Navigation clavier
- Chips accessibles (boutons)
- Liste d'avis navigable
- Lightbox photo accessible

### Contrastes
- Conserver contrastes AA (texte/boutons).

### Touch targets
- Boutons >= 44px.

### Langue
- Avis en FR/AR :
  - support `dir="rtl"` sur contenu arabe si détecté (option)
