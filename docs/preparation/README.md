# FemiGlow — Dossier de préparation projet
> *Maison de soin · Casablanca · 2026*
> Document de cadrage Next.js · Phase prototype pré-CMS

---

## À qui s'adresse ce dossier

Ce dossier est l'**unique source de vérité opérationnelle** pour la mise en chantier de la boutique FemiGlow en Next.js. Il s'adresse :

- au **Product Owner** (priorisation, roadmap, KPIs)
- aux **designers UI/UX** (système, ergonomie, animation)
- aux **développeurs front et back** (architecture, contrats API, conventions)
- aux **partenaires CMS / intégration** (modèles de contenu, schémas)
- au **QA** (critères d'acceptation, accessibilité, performance)

Il prolonge — sans les remplacer — les spécifications éditoriales détaillées du dossier `../pages/` (architecture du site, charte graphique, neuf pages B2C). Là où la documentation source raconte *ce que la maison veut être*, ce dossier raconte *comment on la construit, on la teste, on la fait évoluer*.

---

## Principes directeurs

Cinq principes président à toutes les décisions de ce dossier. Toute proposition technique, design ou éditoriale qui les contredit doit être réinterrogée avant d'être validée.

| # | Principe | Implication concrète |
|---|---|---|
| **1** | **Composants découplés des données dès l'origine** | Aucune donnée codée en dur dans un composant ; props typés, schémas Zod, source pluggable (mock JSON aujourd'hui, CMS demain) |
| **2** | **L'absence comme signature** | Pas d'urgence, pas d'emoji, pas de réduction-coupon, pas de pop-up ; espace blanc abondant, friction minimale |
| **3** | **Une maison, deux portes (B2C / B2B)** | L'arborescence et la palette se déclinent par contexte sans rupture identitaire |
| **4** | **Mobile-first, accessible by default** | WCAG 2.2 AA minimum, touch ≥ 44 px, `prefers-reduced-motion` respecté partout |
| **5** | **Performance comme posture** | Budgets explicites (LCP < 2.5 s, CLS < 0.1, INP < 200 ms), images servies par `next/image`, polices auto-hébergées |

---

## Plan du dossier

Quinze documents thématiques, organisés des fondations vers l'opérationnel.

### Fondations stratégiques
- [00 — Résumé exécutif](./00-executive-summary.md)
- [01 — Marque, vision et voix](./01-marque-vision-voix.md)
- [02 — Design system & tokens](./02-design-system.md)

### Architecture produit
- [03 — Architecture de l'information](./03-architecture-information.md)
- [04 — Spécifications de pages](./04-specifications-pages.md)
- [05 — Bibliothèque de composants](./05-bibliotheque-composants.md)

### Architecture technique
- [06 — Architecture technique Next.js](./06-architecture-technique.md)
- [07 — Modèles de données & contrats API](./07-modeles-donnees-api.md)

### Qualité d'expérience
- [08 — UX, animations et micro-interactions](./08-ux-animations-interactions.md)
- [09 — Ergonomie & accessibilité](./09-ergonomie-accessibilite.md)
- [10 — Performance & Web Vitals](./10-performance-web-vitals.md)
- [11 — SEO & métadonnées](./11-seo-metadata.md)

### Excellence opérationnelle
- [12 — QA, débogage & observabilité](./12-qa-debugging-observabilite.md)
- [13 — Modularité, évolutivité, maintenabilité](./13-modularite-evolutivite.md)
- [14 — Roadmap d'exécution](./14-roadmap-execution.md)
- [15 — Stratégie d'itération composant par composant](./15-strategie-iteration.md)

### Annexes
- [Annexe A — Tokens CSS prêts à intégrer](./annexes/tokens.css.md)
- [Annexe B — Index des composants](./annexes/composants-index.md)
- [Annexe C — Glossaire éditorial](./annexes/glossaire-editorial.md)

---

## Comment lire ce dossier

| Profil | Lecture recommandée |
|---|---|
| **Décideur / Product Owner** | 00 → 03 → 14 |
| **Designer UI/UX** | 01 → 02 → 04 → 05 → 08 → 09 |
| **Développeur Front** | 02 → 05 → 06 → 07 → 10 |
| **Développeur Back / CMS** | 03 → 07 → 13 |
| **QA / Lead qualité** | 09 → 10 → 11 → 12 |
| **Lecture intégrale** | 00 → 14 dans l'ordre |

---

## Statut & convention de versioning

- **Version dossier** : v1.0 — Initiale (mai 2026)
- **Statut** : ✦ Cadrage validé pour entrée en build phase prototype
- **Mise à jour** : à chaque itération majeure (évolution scope, livraison sprint), la table de versions de chaque document doit être mise à jour
- **Source de vérité éditoriale** : `../pages/` reste référence pour le contenu textuel et la philosophie ; ce dossier les opérationnalise

> *« Pas une marque. Une maison. Pas un produit. Un rituel. Pas une cliente. Une initiée. »*
