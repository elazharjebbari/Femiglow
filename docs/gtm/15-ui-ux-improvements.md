# 15 — UI/UX de l'export GTM — audit & améliorations

> *Audit de l'interface `/admin/tracking/gtm` livrée en V1, plan
> d'amélioration pragmatique, et plan d'action exécutable.*

---

## 1. Périmètre de l'audit

5 composants livrés dans la V1 (cf. doc 14) :

```
src/components/admin/tracking/gtm/
├── GtmExportClient.tsx     // page client : sélecteur env + actions + preview
├── GtmStatsGrid.tsx        // 4 cartes (tags / triggers / variables / folders)
├── GtmMetaInfo.tsx         // 5 méta-infos (taille, lignes, version, date, sha256)
└── GtmJsonPreview.tsx      // viewer JSON pretty-printed avec line numbers
```

Critères d'analyse : UI, UX, accessibilité, animation, charte
graphique, ergonomie.

## 2. Audit — points faibles identifiés

| #     | Point                                                          | Sévérité | Raison                                                                                                       |
| ----- | -------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| A-01  | Sélecteur env en `<select>` natif                              | moyenne  | OS-native, ne respecte pas la grammaire de la console (qui utilise des onglets et des cartes)                 |
| A-02  | Aucune icône (boutons texte-only)                               | moyenne  | « Télécharger » et « Copier » sans symbole visuel — friction de scan, asymétrie avec le reste de la console  |
| A-03  | Feedback `✓ Copié` brutal (pas de transition)                   | basse    | Le check apparaît bloc, pas d'animation, pas d'`aria-live`                                                    |
| A-04  | Erreurs sans contexte ni icône                                 | basse    | Bandeau rouge basique, sans symbole, sans bouton « réessayer »                                                |
| A-05  | Loading state minimal (« chargement… » texte)                  | moyenne  | Pas de skeleton, le contenu reste visible et change brutalement                                              |
| A-06  | Stats : chiffres apparaissent direct, pas de count-up           | basse    | Absence d'animation discrète qui pourrait guider l'œil                                                        |
| A-07  | Sha256 tronqué sans action de copie                             | moyenne  | Donnée techniquement utile pour audit / Git, pas accessible en 1 clic                                         |
| A-08  | Pas de timestamp relatif (« il y a 2 minutes »)                | basse    | Lisibilité moindre du « généré le »                                                                          |
| A-09  | Bloc « Comment importer » en liste numérotée nue                | moyenne  | Important pédagogiquement → mérite une visualisation par étapes                                              |
| A-10  | JsonPreview : pas de syntax highlighting                       | élevée   | Lecture difficile sur 4 000 lignes, le code paraît brut                                                       |
| A-11  | JsonPreview : pas de scroll-to-line, pas de Ctrl+F custom      | basse    | Recherche fastidieuse                                                                                        |
| A-12  | JsonPreview : pas de mode plein écran                          | moyenne  | Sur 4 000 lignes, le viewer 60vh est étouffant                                                               |
| A-13  | Pas de raccourcis clavier (Cmd+S download, Cmd+Shift+C copy)   | basse    | Confort admin                                                                                                 |
| A-14  | Focus rings non explicites sur les boutons                     | moyenne  | A11y — navigation clavier difficile à suivre                                                                  |
| A-15  | Pas de hiérarchie d'animation à l'entrée (fade-in séquentiel)  | basse    | Tous les blocs apparaissent en bloc                                                                          |
| A-16  | Stats — pas de mise en valeur subtile des chiffres « chat »    | basse    | Détail noyé dans le sub-label, mérite un accent (sauge, conforme FemiGlow)                                    |
| A-17  | « Bloc Comment importer » mélange `<em>` et `<strong>` sans rythme | basse | Manque de poids visuel cohérent                                                                              |
| A-18  | Aucune indication visuelle de l'environnement actif dans le header | moyenne | Risque admin : télécharger le mauvais env. Un badge env coloré aide                                          |
| A-19  | Pas d'animation sur le bouton « Voir tout » du JsonPreview      | basse    | Transition manquante                                                                                         |

## 3. Charte FemiGlow — rappel et application admin

L'admin n'est **pas** le site public. Elle utilise un système
sobre `stone-*` (gray neutre) volontaire — densité d'info. Mais
on peut **distiller subtilement** les marqueurs FemiGlow :

| Surface admin             | Couleur                              | Usage suggéré                                |
| ------------------------- | ------------------------------------ | -------------------------------------------- |
| Texte / fond              | `stone-50` / `stone-900` (existant)  | Inchangé                                     |
| Accent **discret** sauge  | `#A8C4A6` (sauge profond)            | Pastilles « chat dim », ring focus, hairlines |
| Accent **discret** champagne | `#C8A876`                         | sha256 / hashes (signal noble)                |
| Accent ciel (info)        | `#7AA8C0`                            | Badge env, info banners                      |
| Accent pétale (success)    | `#4F6B4D` (vert profond, pas rose)  | « Copié », « Téléchargé »                    |
| Erreur                    | `#8C3A3A` (existant)                 | Inchangé                                     |

**Règle** : la charte FemiGlow infuse l'admin **par touches** —
elle ne la remplace pas. Sauge sur les détails « identité chat »,
champagne sur les hashes, jamais d'usage massif.

## 4. Plan d'action — 12 améliorations V1.1

Ordonnées par ratio impact/effort.

| ID         | Sujet                                                          | Effort | Impact   |
| ---------- | -------------------------------------------------------------- | ------ | -------- |
| UX-01      | Convertir sélecteur env en groupe d'onglets `<button[role=tab]>` | 0.5 j  | élevé    |
| UX-02      | Ajouter icônes SVG inline (download, copy, check, alert, expand) | 0.25 j | élevé   |
| UX-03      | Animation `✓ Copié` (scale + opacity, `aria-live`)             | 0.1 j  | moyen    |
| UX-04      | Bandeau d'erreur stylé avec icône + bouton « réessayer »       | 0.1 j  | moyen    |
| UX-05      | Loading skeleton sur stats pendant pending                     | 0.25 j | élevé    |
| UX-06      | Animation count-up subtile sur stats au mount                  | 0.1 j  | basse    |
| UX-07      | Sha256 cliquable → copie le hash complet                       | 0.1 j  | moyen    |
| UX-08      | Timestamp relatif (« il y a … »)                               | 0.1 j  | basse    |
| UX-09      | Bloc « Comment importer » en steps visuels (cards numérotées)  | 0.25 j | moyen    |
| UX-10      | Mode plein écran du JsonPreview (modal, Esc pour fermer)       | 0.5 j  | élevé    |
| UX-11      | Raccourcis clavier (Cmd+S download, Cmd+Shift+C copy hash)    | 0.1 j  | basse    |
| UX-12      | Badge env coloré dans le header de la page                    | 0.1 j  | moyen    |
| UX-13      | Focus rings explicites + transitions cohérentes sur boutons    | 0.1 j  | moyen    |
| UX-14      | Touches FemiGlow : sauge sur les sub-labels « chat »          | 0.1 j  | basse    |

**Total V1.1** : ~ 2.6 jours.

### Hors scope V1.1 (gardé pour V1.2)

- Syntax highlighting Shiki SSR (gros morceau, ~ 0.75 j + bundle)
- Recherche dans le JsonPreview (Ctrl+F custom)
- Diff vs production distant (nécessite GTM API)
- Mode push API depuis l'UI

## 5. Décisions de design

### 5.1 Onglets > select

Le sélecteur natif est correct, mais des onglets :

- visualisent les 4 environnements en parallèle ;
- évitent un clic supplémentaire pour ouvrir le menu ;
- sont alignés avec la sous-navigation tracking (qui utilise déjà
  des tabs avec underline) ;
- supportent mieux la navigation clavier (`←` / `→` natifs avec
  `role="tablist"`).

### 5.2 Icônes SVG inline (pas de lib)

Pas de `lucide-react` ou `heroicons`. SVG inline 16-20 px,
`stroke-current`, dimensions fixes. Cinq icônes suffisent pour
toute l'UI export :

- `IconDownload`
- `IconCopy`
- `IconCheck`
- `IconAlert`
- `IconExpand` (plein écran)

### 5.3 Animation "premium silencieuse"

Toutes les transitions :

- durée **150-220 ms**, jamais > 300 ms ;
- easing `ease-out` pour les apparitions, `ease-in` pour les disparitions ;
- jamais de spring / bounce ;
- toutes désactivées par `@media (prefers-reduced-motion)`.

### 5.4 Skeleton minimal

Carte stat → bloc gris animé (pulse), même hauteur que le
contenu. Pas de placeholder de texte (pas de « ████ »), juste
une zone grise calme. 4 cartes = 4 skeletons.

### 5.5 Modal plein écran

Pas de portail React lourd. Un simple `<dialog>` HTML5 ou un
overlay `fixed inset-0` avec `z-50`, focus-trap natif via
`autofocus` + `Esc`.

### 5.6 Touches FemiGlow

- `bg-[#A8C4A6]/10 text-[#3F5B41]` pour les pastilles « chat dim »
- `text-[#7A6940]` (champagne foncé) pour les hashes
- `text-[#4F6B4D]` pour les success states
- Hairlines sauge `border-[#A8C4A6]/40`

Choix de classes Tailwind arbitraires `[#xxxxxx]` plutôt que
d'étendre la config Tailwind à ce stade — c'est ciblé et
réversible.

## 6. Découpage technique

| Fichier touché                                  | Modifs                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `GtmExportClient.tsx`                            | Tabs env, icônes, skeleton, badge env, raccourcis, fullscreen trigger |
| `GtmStatsGrid.tsx`                               | Animation count-up, skeleton fallback, accent sauge sub-label         |
| `GtmMetaInfo.tsx`                                | Sha256 cliquable, timestamp relatif, accent champagne                 |
| `GtmJsonPreview.tsx`                             | Mode plein écran modal, fade-in scroll, sticky gutter                 |
| `GtmIcons.tsx` (nouveau)                         | 5 icônes SVG inline                                                    |
| `GtmHelpSteps.tsx` (nouveau)                     | 6 étapes import en cards numérotées                                    |
| `GtmEnvTabs.tsx` (nouveau, extrait de Client)    | Tabs ARIA-conformes pour les 4 environnements                          |
| `GtmFullscreenPreview.tsx` (nouveau)              | Modal plein écran                                                     |
| `*.test.ts`                                       | Mise à jour si signatures de composants changent                      |

## 7. Critères d'acceptation V1.1

1. Tous les boutons ont un focus ring visible navigation clavier.
2. Sélecteur env est un `role="tablist"` avec navigation `←/→`.
3. Boutons « Télécharger » et « Copier » portent une icône SVG.
4. Skeleton stats apparaît pendant `pending`, fade-out à l'arrivée.
5. Sha256 click → copie complète + toast `✓ Hash copié`.
6. Bloc « Comment importer » montre 6 étapes en cards.
7. JsonPreview a un bouton expand → modal plein écran ; Esc ferme.
8. Cmd+S sur la page → déclenche le téléchargement.
9. Le contenu chat (stats `0/X chat`, dims chat) est visuellement
   marqué en sauge.
10. Toutes les animations désactivées en `prefers-reduced-motion`.
11. Tests existants restent verts ; ajout d'1 test pour l'a11y
    onglets.

## 8. Hors scope (V1.2 et au-delà)

- Syntax highlighting JSON (Shiki SSR ; ~ +120 kB SSR HTML)
- Recherche custom dans le preview (Ctrl+F overlay)
- Diff visuel vs container distant (GTM API + react-diff-viewer)
- Push depuis l'UI (Phase 2 du doc 14, déjà documenté)
- Storybook stories des composants GTM

## 9. Lecture suivante

- [14 — Export GTM depuis l'admin](14-admin-export.md) — spec V1
- [10 — Automatisation](10-automatisation.md) — phases globales
