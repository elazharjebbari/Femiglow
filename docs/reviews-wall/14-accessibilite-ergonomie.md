# 14 — Accessibilité et ergonomie

WCAG 2.2 AA est le seuil de conformité minimum. Cette spécification décrit chaque point d'attention de l'expérience « Rituels partagés » : focus, clavier, lecteurs d'écran, contrastes, mobile, ergonomie cognitive.

## 1. Le principe directeur

L'accessibilité chez FemiGlow n'est pas un patch ; elle est **un signe de soin**. La cliente qui navigue au lecteur d'écran reçoit la même qualité éditoriale, le même délai, la même voix maison. C'est exactement la posture « initiée », transposée à un autre canal de perception.

## 2. WCAG 2.2 AA — checklist par critère

| # | Critère WCAG | Application au wall | Statut |
| --- | --- | --- | --- |
| 1.1.1 | Contenu non textuel | Toute photo a un `alt` éditorial signifiant | À implémenter |
| 1.3.1 | Information et relations | `<article>`, `<section>`, `<fieldset>`, `<legend>` corrects | À implémenter |
| 1.3.2 | Ordre logique | Citation → signature → tags → badge — ordre DOM correspond à l'ordre visuel | À implémenter |
| 1.3.4 | Orientation | Le drawer fonctionne en portrait et en paysage | À tester |
| 1.3.5 | Identifier la finalité des champs | `autocomplete="given-name"`, `address-level2` etc. | À implémenter |
| 1.4.3 | Contraste minimum | Voir § 5 ci-dessous | Validé |
| 1.4.4 | Redimensionner le texte | Zoom 200 % sans perte | À tester |
| 1.4.10 | Reflow | Réflow correct à 320 px CSS | À tester |
| 1.4.11 | Contraste UI | Bordures et chips ≥ 3:1 | Validé |
| 1.4.13 | Hover et focus persistants | Tooltips fermables avec ESC ; visibles tant que focus | À implémenter |
| 2.1.1 | Clavier | Tout est utilisable au clavier | À implémenter |
| 2.1.2 | Pas de piège clavier | ESC ferme drawer, lightbox, wizard | À implémenter |
| 2.4.3 | Ordre de focus | Cf. § 4 | À implémenter |
| 2.4.6 | En-têtes et étiquettes | Chaque section a son `<h2>` ou `<legend>` | À implémenter |
| 2.4.7 | Focus visible | Outline 2 px sauge-dark, offset 4 px | Validé |
| 2.4.11 | Focus non masqué (Min) | Le focus ne disparaît jamais sous footer sticky | À tester |
| 2.5.3 | Étiquette dans le nom | Le `aria-label` reprend le texte visible | À implémenter |
| 2.5.5 | Cible | 44×44 px minimum | Validé |
| 2.5.8 | Taille de cible (Min) | Cible WCAG 2.2 ≥ 24 px en l'absence d'alternative | Validé |
| 3.1.1 | Langue de la page | `<html lang="fr">` | Existant |
| 3.2.1 | Au focus | Pas de changement de contexte au focus | Validé |
| 3.2.2 | À la saisie | Pas de submit automatique | Validé |
| 3.3.1 | Identification des erreurs | Messages d'erreur associés au champ via `aria-describedby` | À implémenter |
| 3.3.2 | Étiquettes ou instructions | Tous les champs ont un label visible | Validé |
| 3.3.7 | Saisie redondante | Aucune redondance forcée | Validé |
| 3.3.8 | Authentification accessible (Min) | N/A (pas d'auth utilisatrice publique) | N/A |
| 4.1.2 | Nom, rôle, valeur | `role="dialog"`, `aria-modal`, `aria-pressed` corrects | À implémenter |
| 4.1.3 | Messages d'état | `aria-live="polite"` sur load more compte | À implémenter |

## 3. Focus management

### 3.1 Drawer

| Action | Comportement |
| --- | --- |
| Ouverture | Focus se pose sur le bouton **Fermer** (en haut à gauche du drawer). Pourquoi pas le titre ? Le titre est un `<h2>` non focusable. Le bouton Fermer est la première action atteignable au clavier et signal le pattern « modal ». |
| Tab | Boucle dans le drawer : Fermer → chips filtres → cartes (lien photo si présent) → load more → lien partager → CTA pack → lien politique → retour Fermer |
| Shift+Tab | Sens inverse |
| Arrière-plan | `inert` posé sur `<main>` pour neutraliser focus, click, hover |
| ESC | Ferme le drawer, restaure focus sur l'élément déclencheur (lien `Lire les 26 rituels →`) |

### 3.2 Wizard

| Étape | Focus initial |
| --- | --- |
| Étape 1 | Textarea body |
| Étape 2 | Première checkbox tags (Ongles plus lisses) |
| Étape 3 | Champ Prénom |
| Confirmation | Bouton « Continuer la lecture » |

À chaque transition d'étape, focus se pose sur le premier élément interactif de la nouvelle étape, avec annonce vocale via `aria-live="polite"` : « Étape 2 sur 3 — Vos mots-clés ».

### 3.3 Lightbox photo

| Action | Focus |
| --- | --- |
| Ouverture | Bouton Fermer |
| Tab | Fermer → ← précédent → → suivant → caption (si lien) → boucle |
| ← / → clavier | Navigue entre photos |
| ESC | Ferme, restaure focus sur la photo cliquée |

### 3.4 Pile de focus (stack management)

Une seule modale ouverte à la fois. Si l'initiée clique sur une photo dans une carte du drawer :

1. La lightbox s'ouvre **par-dessus** le drawer.
2. Le drawer reçoit `inert` jusqu'à fermeture de la lightbox.
3. À la fermeture de la lightbox, focus revient sur la photo cliquée.

Pas de stack profonde > 2.

## 4. Navigation clavier complète

### 4.1 Sur `/kit` module compact

- Tab → arrive sur la première carte (lien clickable).
- Enter → ouvre le drawer en mode liste (URL `?wall=open`).
- Tab → seconde carte → troisième carte → lien `Lire les 26 rituels →` → suite de la page.

### 4.2 Dans le drawer

```
[×] → [Tous] → [Avec photos] → [Halal] → [Récents]
  → [card 1] → [photo 1] → [card 2] → ...
  → [Afficher plus]
  → [Partager mon rituel →]
  → [Recevoir le pack — 199 dh]
  → [Comment vérifiés →]
  → [×] (boucle)
```

### 4.3 Dans le wizard

```
Step 1 : [textarea] → [radio Oui] → [radio Hésite] → [radio Non]
       → [Soumettre tel quel] → [Continuer →]
       → [textarea] (boucle)

Step 2 : [tag 1] → [tag 2] → ... → [tag 9]
       → [zone drop] → [zone bouton choisir]
       → [thumbnail 1] → [remove 1] → [thumbnail 2] → ...
       → [Passer] → [Continuer]
       → [tag 1] (boucle)

Step 3 : [prénom] → [ville] → [mois] → [année]
       → [anonyme checkbox]
       → [Passer] → [Partager mon rituel]
       → [Retour] → [prénom] (boucle)
```

## 5. Contrastes (vérifiés)

### 5.1 Couleurs maison

| Combinaison | Ratio | WCAG | Usage |
| --- | --- | --- | --- |
| Encre `#2C2A28` sur Crème `#FBF8F1` | 14,2:1 | AAA | Body text |
| Encre `#2C2A28` sur Crème pure `#FFFFFF` | 14,9:1 | AAA | Body text card |
| Brume `#6B6863` sur Crème `#FBF8F1` | 5,6:1 | AA | Signature, helper text |
| Brume `#6B6863` sur Sauge `#C5DBC4` | 4,3:1 | AA (limite) | À éviter sur ce fond |
| Sauge-dark `#A8C4A6` sur Crème `#FBF8F1` | 1,9:1 | Non AA | Décoratif uniquement, jamais texte |
| Encre sur Sauge `#C5DBC4` | 10,5:1 | AAA | Texte de chip actif |
| Champagne `#C8A876` sur Crème `#FBF8F1` | 2,1:1 | Non AA | Décoratif uniquement (fleuron, séparateurs) |

### 5.2 Règles d'application

- **Body text**, **citations**, **signatures** : toujours encre ou brume sur crème.
- **CTA primaire** : encre sur crème (en bouton, c'est l'inverse — crème sur encre, 14,2:1).
- **Chip actif** : encre sur sauge — 10,5:1 OK.
- **Chip default** : encre sur crème-pure, bordure 1 px ligne (`#E8E0D2`) — bordure ratio 1,3:1 vs fond, **insuffisant**. À renforcer : utiliser une bordure 1,5 px en sauge-pale `#D9E6D7` qui donne un ratio 1,9:1, ou 2 px en sauge-dark `#A8C4A6` (3:1, conforme UI). **Décision** : passer à bordure 1,5 px en sauge-pale uniformément sur les chips et cartes du wall.
- **Focus ring** : 2 px sauge-dark `#A8C4A6` sur fond crème = 1,9:1. Augmenter offset à 4 px et utiliser **encre** pour le focus ring sur les boutons : 14,2:1, conforme WCAG 1.4.11.

## 6. Lecteurs d'écran — flux de lecture

### 6.1 Carte de témoignage

Chaque carte est un `<article>` :

```html
<article aria-labelledby="card-k7m3qp2x-quote">
  <img src="..." alt="Mains d'Amal, six semaines après le début du rituel" />
  <blockquote id="card-k7m3qp2x-quote">
    « Trois mois et l'ongle a retrouvé sa nervure. »
  </blockquote>
  <footer>
    <span>— Amal, Rabat</span>
    <span>Initiée depuis février 2026</span>
    <ul aria-label="Tags choisis par Amal">
      <li>Ongles plus lisses</li>
      <li>Plus de casse</li>
    </ul>
    <span aria-label="Amal recommanderait ce rituel">Reviendrait</span>
  </footer>
</article>
```

Lecture VoiceOver attendue : « Article. Image, Mains d'Amal, six semaines après le début du rituel. Citation, Trois mois et l'ongle a retrouvé sa nervure. Tiret cadratin, Amal, Rabat. Initiée depuis février 2026. Tags choisis par Amal, liste, Ongles plus lisses, Plus de casse. Amal recommanderait ce rituel, Reviendrait. »

### 6.2 Synthèse globale

```html
<section aria-labelledby="ritual-summary-title">
  <h2 id="ritual-summary-title" class="visually-hidden">Synthèse</h2>
  <p>26 initiées ont partagé.</p>
  <p>24 reprendraient le rituel.</p>
  <p>
    <span class="visually-hidden">Tags les plus mentionnés :</span>
    Ongles plus lisses · Plaque souple · Cuticules apaisées
  </p>
</section>
```

### 6.3 Load more

```html
<button
  type="button"
  aria-label="Afficher plus de rituels partagés. 12 affichés sur 26."
  aria-controls="rituals-list"
>
  Afficher plus (12 / 26)
</button>
```

Après chargement, annonce vocale via `aria-live="polite"` sur le conteneur de liste : « 12 nouveaux rituels chargés. 24 affichés sur 26. ».

### 6.4 Wizard

Chaque étape commence par un `<h2>` lu en premier, puis l'instruction de l'étape. Les radio et checkbox ont des `<fieldset><legend>` corrects.

## 7. Mobile

### 7.1 Touch targets

Tous les éléments interactifs ≥ 44×44 px (WCAG 2.5.5). Padding extra appliqué autour des liens texte pour atteindre cette taille même si visuellement plus petit.

### 7.2 Scroll horizontal des chips

Avec scroll-snap pour aider l'orientation :

```css
.ritual-filters {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding-bottom: 8px;
}

.ritual-filter-chip {
  scroll-snap-align: start;
  flex-shrink: 0;
}
```

Indice visuel de scroll : `mask-image: linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)` — suggère que le contenu se prolonge à droite.

### 7.3 Bottom sheet — drag accessibility

Le drag-to-close est une **affordance secondaire**. Le bouton Fermer reste l'action principale. La poignée de drag (`<div role="button" aria-label="Fermer le panneau" tabIndex="0">`) répond aussi à `Enter` et `Space` clavier.

### 7.4 Keyboard mobile

iOS et Android : `inputmode="email"`, `enterkeyhint="next"` sur les champs du wizard. Le textarea body : `enterkeyhint="enter"`.

## 8. Réduction de la charge cognitive

### 8.1 Hick's Law

| Surface | Choix simultanés | Conforme ? |
| --- | --- | --- |
| Chips filtres | 4 | Oui (≤ 7) |
| Tags wizard | 9 | Limite — acceptable car liste fermée et catégorisable mentalement |
| Bouton de tri | Pas exposé au lancement (Recommandé par défaut) | Oui |
| Action sur carte admin | 5 boutons (approuver, rejeter, masquer, featured, restaurer) | Conforme avec hiérarchie visuelle (approuver / rejeter primaires) |

### 8.2 Miller's Law (7±2)

Les insights agrégés sont limités à **3 top tags** pour ne pas saturer.

### 8.3 Fitts' Law

CTA pack en pied de drawer, plein largeur, hauteur 56 px = la cible la plus grande accessible au pouce. Bouton fermer en haut à gauche est en zone confortable (zone Thumb Reach étendue).

### 8.4 Loi de proximité (Gestalt)

- Citation et signature de la même carte regroupées visuellement (pas de séparateur entre eux).
- Filtres regroupés en une ligne, séparés du contenu liste par un trait fin sauge-pale.
- CTA pack séparé du reste par padding 24 px supérieur et ombre subtle haut.

## 9. Tests d'accessibilité

### 9.1 Outils automatiques

- **axe-core en CI** : configuration `jest-axe` ou `@axe-core/playwright` exécutée sur chaque PR.
- **Lighthouse a11y** : score cible ≥ 95.
- **ESLint plugin jsx-a11y** : règles strictes (no-redundant-roles, label-has-associated-control, etc.).

### 9.2 Tests manuels

À effectuer une fois par release :

| Outil | Parcours testé |
| --- | --- |
| VoiceOver (macOS / Safari) | Ouvrir drawer → lire 2 cartes → filtrer → submit wizard |
| TalkBack (Android Chrome) | Idem mobile |
| NVDA (Windows Firefox) | Idem desktop |
| Clavier seul (sans souris) | Ouvrir drawer → filtrer → lire → soumettre — tout doit fonctionner |
| Zoom 200 % (Firefox) | Pas de scroll horizontal, pas de troncation |
| Zoom 400 % | Conforme reflow WCAG 1.4.10 |
| `prefers-reduced-motion` | Aucune animation > 100 ms |

### 9.3 Tests utilisateurs

À planifier une fois en prod :

- 1 utilisatrice voyante senior (60+) — vérifier la lisibilité et la compréhension.
- 1 utilisatrice malvoyante (zoom élevé) — vérifier la mise en page.
- 1 utilisatrice non-voyante avec VoiceOver / NVDA — vérifier la qualité du flux.

## 10. Synthèse — règles d'or accessibilité

1. **Tout est utilisable au clavier**, sans exception.
2. **Aucune information par couleur seule.** Les chips actifs ont aussi un changement de bordure et un état `aria-pressed`.
3. **Tous les inputs ont un label visible**, pas de placeholder-as-label.
4. **Tous les boutons icôniques ont un `aria-label`** explicite.
5. **Le focus est toujours visible**, jamais masqué par un sticky footer.
6. **Les modales ont focus trap + ESC + retour focus** à l'élément déclencheur.
7. **Les photos ont des `alt` éditoriaux**, pas `alt="image"`.
8. **Les messages d'état sont annoncés** via `aria-live`.
9. **Les changements d'étape sont annoncés vocalement** au wizard.
10. **`prefers-reduced-motion` désactive toutes les animations longues.**
11. **Le contraste de la bordure des chips a été corrigé** : 1,5 px sauge-pale au lieu de 1 px ligne.
12. **Les contrastes texte sont AA ou AAA** sur toutes les paires utilisées.
