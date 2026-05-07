# 05 — UI / UX & design

> *Charte chat, tokens, animations, états, micro-interactions, position, responsive*

---

## 1. Principes de design

| Principe                          | Traduction concrète                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Discrétion à l'arrêt**          | Pas de pulsation criarde, pas d'auto-ouverture intrusive, pas de bandeau « besoin d'aide ? »                 |
| **Visibilité dès qu'on cherche**  | Bouton flottant suffisamment dense (56 px), zone safe-area respectée, contraste AA, halo très léger          |
| **Continuité avec la maison**     | Tokens FemiGlow, typographies, vocabulaire « initiée / rituel / maison », pas d'emoji                        |
| **Hiérarchie de lecture**         | Bulles visiteur sobres, bulles agent avec accent sauge ; sources et métadonnées en hiérarchie secondaire     |
| **Fluide même en lent**           | Animations 240 ms ease-out, fallback fondu 80 ms en `reduced-motion`                                         |
| **Pas de friction commerciale**   | Pas de CTA dans la bulle agent V1, pas de pop-up panier, pas de timer                                        |

## 2. Tokens et thèmes

Les tokens sont stockés dans `chat_theme_preset.tokens` (JSONB),
appliqués via CSS variables sur la racine du widget. Aucun token
n'est en dur dans les composants.

```ts
// types/theme.ts
export type ThemeTokens = {
  color: {
    surface: string;             // #FBF8F1 — crème
    surfaceAlt: string;          // #FFFFFF
    text: string;                // #2C2A28 — encre
    textMuted: string;           // #6E6A66
    accent: string;              // #C5DBC4 — sauge
    accentAlt: string;           // #C5DBE5 — ciel
    accentRare: string;          // #C8A876 — champagne
    petal: string;               // #F2CECC
    border: string;              // #E8E2D5
    overlay: string;             // rgba(44,42,40,0.06)
    error: string;               // #8C3A3A
    success: string;             // #4F6B4D
  };
  radius: { xs: 6; sm: 10; md: 16; lg: 22; full: 9999 };
  shadow: {
    soft: '0 1px 2px rgba(44,42,40,0.04), 0 8px 24px rgba(44,42,40,0.06)';
    panel: '0 12px 48px rgba(44,42,40,0.10)';
  };
  font: {
    body: 'var(--font-inter), system-ui, sans-serif';
    display: 'var(--font-cormorant), serif';
    arabic: 'var(--font-plex-arabic), system-ui, sans-serif';
  };
  size: {
    launcher: 56;            // px
    launcherMobile: 52;
    panelW: 380;             // px desktop
    panelMaxH: 640;
    bubbleMaxW: 78;          // %
  };
};
```

> Les valeurs ci-dessus sont les **defaults** de la maison. Tout
> peut être overridé par preset.

## 3. Anatomie du launcher

```
   ┌────────────────┐
   │       ◐        │   56 px ⌀, fond crème, encre 30% en repos
   │   (souffle)    │   icône : vague asymétrique 24 px, encre
   └────────────────┘
     ↑ halo champagne 1 px ; pulse 4 s, opacité 0 → 0.12 → 0
```

- État repos : ombre `soft`, fond `surface`, icône encre.
- État hover : ombre `panel`, fond `surfaceAlt`, halo 2 px.
- État focus clavier : anneau 2 px `accent` + offset 2 px.
- État avec messages non-lus : pastille champagne 8 px en haut-droite,
  jamais de chiffre (charte « pas d'urgence »).
- État ouvert : icône bascule en croix en 200 ms.

## 4. Anatomie du panneau

### 4.1 Desktop (≥ 1024 px)

```
                                    ┌───────────────────────────────────┐
                                    │ ─── Header                      ✕ │
                                    │  La maison à l'écoute             │
                                    │  Aujourd'hui, 16:42               │
                                    ├───────────────────────────────────┤
                                    │                                   │
                                    │  [salutation contextuelle]        │
                                    │  [3 suggestions discrètes]        │
                                    │                                   │
                                    │  ◀ bulle agent                    │
                                    │  bulle visiteur ▶                 │
                                    │                                   │
                                    │  · · ·  (typing)                  │
                                    │                                   │
                                    ├───────────────────────────────────┤
                                    │ [Composer textarea]      → envoi  │
                                    │ FR · العربية · Darija (sélecteur) │
                                    └───────────────────────────────────┘
                                              380 × 640 max
```

Position : `bottom: 24px; right: 24px`. Le launcher reste visible
dans le coin inférieur droit même panel ouvert (en mode desktop)
ou est remplacé par la croix dans le header (en mode mobile).

### 4.2 Mobile (< 768 px)

Plein écran avec safe-area. L'animation d'ouverture est un
glissement vers le haut depuis le launcher, 280 ms ease-out.

### 4.3 Tablette (768-1024 px)

Panel ancré bas-droit, largeur 420 px, hauteur 70 vh.

## 5. États du widget

| État                | Visuel                                                                      |
| ------------------- | --------------------------------------------------------------------------- |
| Idle, repos         | Launcher seul, halo lent toutes les 6-8 s                                   |
| Idle, message non-lu | Launcher + pastille champagne                                              |
| Ouvert, vide        | Salutation contextuelle + 3 suggestions                                     |
| Ouvert, conversation | Liste de messages, dernière réponse en focus initial scroll                |
| Saisie en cours     | Bouton envoi `accent`, sinon `border`                                       |
| En envoi            | Bouton envoi avec spinner sauge 14 px                                       |
| Streaming           | Voyant `typing` puis bulle agent qui se remplit token par token             |
| Erreur réseau       | Bulle agent avec icône souffle suspendu + bouton « réessayer »              |
| Modération bloqué   | Bulle agent : « la maison ne peut pas répondre à cela. Reformulons-le ? »   |
| Rate-limit          | Toast bas-panel discret 4 s, le composer reste actif après le délai         |
| Hors-ligne          | Bandeau bas-panel : « la maison est hors-ligne, je reviendrai dans un instant » |

## 6. Bulles de messages

| Rôle      | Fond                  | Texte    | Ornement                                      |
| --------- | --------------------- | -------- | --------------------------------------------- |
| Visiteur  | `accent` (sauge)      | encre    | aucun                                         |
| Agent     | `surface` + 1 px `border` | encre    | gauche : barre verticale 2 px champagne discret |
| Système   | `overlay`             | textMuted | italique, taille -1                            |
| Erreur    | `surface`             | encre    | icône souffle suspendu 12 px                  |

Rayons : `radius.lg` (22) sauf coin proche du bord opposé qui passe
à `radius.sm` (10) pour l'ancrage.

Espacement : `12 px` entre bulles d'un même rôle, `20 px` entre
changements de rôle.

## 7. Typographie

| Usage                         | Police                  | Taille / poids  | Notes                                  |
| ----------------------------- | ----------------------- | --------------- | -------------------------------------- |
| Wordmark header               | Cormorant Garamond ital | 16 / 500        | « la maison à l'écoute »               |
| Métadonnées header            | Inter                   | 11 / 500        | textMuted, lettrage 0.04 em            |
| Bulle visiteur                | Inter                   | 15 / 400        | line-height 1.5                        |
| Bulle agent                   | Inter                   | 15 / 400        | idem                                   |
| Suggestions                   | Inter                   | 13 / 500        | accent, hover sous-lignage 1 px        |
| Composer                      | Inter                   | 15 / 400        | placeholder textMuted 70 %             |
| Sources / coulisses           | Inter                   | 11 / 500        | textMuted, lettrage 0.06 em            |
| Bulle arabe                   | IBM Plex Sans Arabic    | 16 / 400        | line-height 1.7                        |

## 8. Animations

Toutes les durées en `motion.ms`. Désactivées si `prefers-reduced-motion`.

| Effet                                  | Durée  | Easing              | Notes                                      |
| -------------------------------------- | ------ | ------------------- | ------------------------------------------ |
| Ouverture panel desktop                | 240    | `cubic-bezier(.16,1,.3,1)` | translateY -8 + scale 0.96 → 1   |
| Ouverture panel mobile                 | 280    | idem                | translateY 16 → 0 + opacity 0 → 1          |
| Apparition bulle                       | 220    | `ease-out`          | translateY 6 → 0, opacity 0 → 1            |
| Apparition tokens (humanisation)       | variable | linéaire           | piloté par `humanize.client.ts`            |
| Halo launcher                          | 4000   | `ease-in-out`       | opacity 0 → 0.12 → 0, désactivé reduced    |
| Voyant typing                          | 1200   | `ease-in-out infinite` | trois points qui montent / descendent  |
| Pop suggestion                         | 180    | `ease-out`          | opacity 0 → 1, translateY 4 → 0            |
| Disparition suggestion (saisie)        | 120    | `ease-in`           | scale 1 → 0.98, opacity 1 → 0              |
| Erreur shake                           | 280    | `ease-in-out`       | translateX ± 4 px (1 cycle), discret       |

Toutes les animations passent par framer-motion (variantes typées).
Les CSS animations sont réservées aux pulses passifs (halo).

## 9. Interactions et raccourcis

| Action                                | Raccourci             |
| ------------------------------------- | --------------------- |
| Ouvrir / fermer le panel              | `Esc` (ferme), `Alt + C` (toggle) |
| Envoyer le message                    | `Entrée`              |
| Saut de ligne dans le composer        | `Shift + Entrée`      |
| Effacer le brouillon                  | `Esc` dans le composer (panel reste ouvert) |
| Naviguer dans les suggestions         | `Tab` / `Shift+Tab`   |

## 10. Responsive

| Breakpoint | Position           | Largeur | Hauteur            |
| ---------- | ------------------ | ------- | ------------------ |
| < 480 px   | full screen        | 100 vw  | 100 svh            |
| 480-768 px | bottom-sheet 80 vh | 100 vw  | 80 svh             |
| 768-1024   | ancré bas-droit    | 420 px  | 70 vh              |
| ≥ 1024 px  | ancré bas-droit    | 380 px  | min(640, 70 vh)    |

Safe-area iOS : `padding-bottom: max(env(safe-area-inset-bottom), 16px)`.

## 11. Charte conversationnelle (rédactionnelle)

### 11.1 Salutations contextuelles (FR)

| Page             | Matin (5 h-11 h)                                  | Après-midi                                            | Soir / nuit                                          |
| ---------------- | ------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| `/` accueil      | « la maison te souhaite un matin doux. en quoi puis-je t'éclairer ? » | « bienvenue. veux-tu qu'on parle d'un rituel ? »          | « les soirs sont propices aux gestes lents. dis-moi tout. » |
| `/kit`           | « le kit t'intrigue ? je suis là pour répondre. » | « tu peux me poser toutes tes questions sur le rituel. » | idem                                                  |
| `/journal/[slug]`| « j'ai lu cet article aussi. que voudrais-tu approfondir ? » | idem                                          | idem                                                  |
| `/panier`        | « besoin d'un éclairage avant de finaliser ? » | idem                                                | idem                                                  |
| `/commander`     | (chat masqué dans le tunnel — voir doc 07)         | idem                                                | idem                                                  |

### 11.2 Suggestions par défaut

Trois maximum, libellés courts, pas d'impératif :

- « parle-moi du rituel »
- « comment l'utiliser ? »
- « livraison au Maroc »

Les suggestions sont **par preset** (cf. `chat_theme_preset.pageSalutations`).

### 11.3 Lexique inviolable (extraits)

| Préférer            | Éviter                  |
| ------------------- | ----------------------- |
| la maison           | la marque               |
| initiée             | cliente / utilisatrice  |
| rituel              | produit / formule       |
| gestes              | étapes                  |
| reçu                | acheté                  |
| t'accompagner       | t'aider à choisir       |
| (silence)           | « génial », « parfait » |

Le glossaire complet est dans [annexes/glossaire-editorial.md](annexes/glossaire-editorial.md).

## 12. Iconographie

- Icône launcher : vague asymétrique (existante dans le design
  system, fichier `icons/wave.svg`).
- Icône envoi : flèche stylisée bord-à-bord (24 × 24).
- Icône close : croix fine 1.25 px (24 × 24).
- Icône info / coulisses : étoile à 4 branches (admin uniquement).
- Aucune icône commerciale (cart, money, etc.).

## 13. Mode coulisses (admin / interne)

Quand un admin connecté ouvre le widget, un bouton « voir les
coulisses » apparaît dans le header. Il déploie le `ChatVisualizer`
(cf. doc 11) en panneau latéral additionnel, sans modifier la
conversation visiteur. Permet de comprendre les flux en live.

## 14. Storybook

Chaque composant a sa story :

```
stories/chat/
├── ChatLauncher.stories.tsx          // états : default, hover, focus, unread, busy, reduced-motion
├── ChatPanel.stories.tsx             // états : empty, conversation, error, ratelimit, RTL
├── MessageBubble.stories.tsx         // user, assistant, system, error, with-sources
├── TypingIndicator.stories.tsx
├── SuggestionsRail.stories.tsx
├── ChatComposer.stories.tsx
└── ChatVisualizer.stories.tsx
```

Chaque story expose des **controls** pour tokens, langue, état.
L'addon `@storybook/addon-a11y` est obligatoire.

## 15. Maquettes (livrables design)

Le designer livre Figma :

- frame 1 : launcher (5 états)
- frame 2 : panel desktop (5 états)
- frame 3 : panel mobile (5 états)
- frame 4 : RTL desktop + mobile
- frame 5 : reduced motion (frames statiques)
- frame 6 : visualizer admin

Les tokens sont publiés en **Figma variables** synchronisés sur
les CSS variables via le pipeline existant.

## 16. Lecture suivante

- [04 — Frontend](04-frontend.md) pour l'arborescence composants.
- [06 — Multilingue & humanisation](06-multilingue-humanisation.md)
  pour les choix de cadence et de salutations.
- [11 — Visualisation système](11-visualisation-systeme.md) pour
  le mode coulisses.
