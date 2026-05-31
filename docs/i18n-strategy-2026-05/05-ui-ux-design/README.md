# 05 — UI / UX Design pour l'internationalisation FemiGlow

> **TL;DR** — Tout l'aspect visible, ressenti et utilisable de l'i18n FemiGlow : où poser le sélecteur de langue, comment basculer en RTL sans casser l'éditorial, quelles polices charger en arabe, comment localiser les images du hero, comment préserver le wizard checkout et comment garder la voix de marque cohérente sur trois langues.

## Audience cible de ce sous-dossier

| Lecteur | Ce qu'il vient chercher |
|---|---|
| **Fondatrice** | La sensation FemiGlow tient-elle en arabe ? En anglais ? Le sélecteur ne casse pas l'aspect sobre du header ? |
| **Designer** | Specs précis (Tailwind, focus rings, mockups, typography) pour livrer des Figma à jour |
| **Dev frontend** | Code recipes (`ms-*`, `me-*`, `text-start`), `dir="rtl"`, swap d'images, font loading via `next/font` |
| **QA / a11y** | Checklists par composant, scénarios Playwright RTL, audit clavier du switcher |
| **Traducteur** | Guide de ton par langue + glossaire FemiGlow figé (CSV) |

## Position dans l'étude

Ce dossier vient **après** les décisions techniques (00, 01, 02) et **avant** l'implémentation frontend (04). Il fige le vocabulaire visuel et éditorial que les devs vont matérialiser. Toute décision UX prise ici doit être traçable jusqu'au composant dans `apps/web/src/components/`.

## Sommaire des fichiers

| Fichier | Aspect couvert | Quand le lire |
|---|---|---|
| [`README.md`](./README.md) | Index du dossier (ce document) | Premier |
| [`locale-switcher-ui.md`](./locale-switcher-ui.md) | 3 designs candidats du sélecteur de langue + a11y + tests | Avant Figma |
| [`rtl-support.md`](./rtl-support.md) | Tailwind logical properties, `dir="rtl"`, miroir d'icônes, audit composants | Avant de coder header/wizard |
| [`typography.md`](./typography.md) | Polices par locale (Inter, Newsreader, Cairo, IBM Plex Arabic), `next/font`, line-height, fallbacks | Avant de toucher `app/layout.tsx` |
| [`images-localization.md`](./images-localization.md) | Stratégie pour visuels traduits, alt text, CDN, workflow CMS | Avant de remplacer les médias du hero |
| [`wizard-i18n.md`](./wizard-i18n.md) | Préservation de `WizardDictionary` (CHA-231), mapping next-intl, audit RTL du tunnel | Avant migration wizard |
| [`tone-style-guide.md`](./tone-style-guide.md) | Voix par langue (FR intime, AR MSA + touches Darija, EN aspirationnel) | Avant briefer le traducteur |
| [`content-style-guide.csv`](./content-style-guide.csv) | Glossaire 30+ termes FemiGlow (term, contexte, do-not-translate) | Référence permanente du traducteur |

## Décisions cadres déjà actées (rappel)

Lire en cas de doute : ces décisions sont **fermées** par les sous-dossiers `00-context` à `02-design-conception`.

| Décision | Valeur figée | Source |
|---|---|---|
| Locales V1 | `fr` (default, LTR) + `ar` (RTL Maroc) + `en` (LTR) | `00-context/etat-actuel.md` |
| Library | `next-intl` | `01-options-techniques/recommendation.md` |
| Routing | path-based `/[locale]/page` | `02-design-conception/url-strategy.md` ADR-002 |
| RTL strategy | Tailwind logical properties + `dir="rtl"` global | `02-design-conception/architecture-cible.puml` |
| Wizard | `WizardDictionary` (CHA-231) **NE PAS régresser** | `00-context/etat-actuel.md` |
| Admin | FR uniquement V1, pas de switcher | `02-design-conception/url-strategy.md` |
| API | Pas de préfixe locale | `02-design-conception/url-strategy.md` |

## Principes UI/UX FemiGlow appliqués à l'i18n

Voix de marque rappelée pour ne pas dériver lors des choix design :

1. **Sobriété** — on ne décore pas le switcher avec un globe coloré ou un drapeau émoji. Un code à 2 lettres suffit.
2. **Éditorial** — la typographie compte plus que la couleur. Newsreader et Inter restent le fil rouge LTR ; Cairo prend le relais en RTL.
3. **Intime** — pas de "Welcome back!" jovial. La traduction respecte le "vous" sobre français, l'arabe MSA poli, l'anglais retenu.
4. **Pas commercial** — pas de pop-up "Switch language to AR!". L'utilisateur trouve le switcher s'il le cherche.
5. **Respect du marché marocain** — l'arabe n'est pas une langue secondaire. AR doit être traité à parité visuelle stricte avec FR.

## Métriques UX à surveiller (vers `10-monitoring`)

| Métrique | Cible | Source |
|---|---|---|
| Temps de switch de langue | < 300 ms perçu | Web Vitals + RUM |
| Taux d'utilisation du switcher | > 5 % sessions AR/EN | Analytics events |
| Coverage de traduction FR | 100 % | CI gate |
| Coverage de traduction AR | >= 95 % | CI gate |
| Coverage de traduction EN | >= 95 % | CI gate |
| Layout shifts en RTL (CLS) | < 0.05 | Web Vitals par locale |
| Erreurs de chargement fonts | 0 | Console / Sentry |
| Plaintes "écriture moche en AR" | 0 / sprint | Channel support |

## Hiérarchie d'approbation pour les choix UX

```
                  Fondatrice (GO/NO-GO esthétique)
                          |
                          v
                   Designer (Figma)
                          |
                          v
                Lead technique (faisabilité)
                          |
                          v
                    Dev frontend (impl)
                          |
                          v
                       QA + a11y
                          |
                          v
                  Traducteur (validation finale)
```

## Anti-patterns à bannir d'entrée

Tout choix qui violerait l'un de ces points doit être rejeté avant Figma :

- ❌ Drapeau émoji pour signaler une langue (`🇲🇦`, `🇫🇷`) — politique floue, rendu inégal cross-platform, exclut langues sans pays
- ❌ Texte traduit incrusté dans un PNG / JPG du hero — coûteux à mettre à jour, viole `images-localization.md`
- ❌ Switcher de langue dans un drawer profond (3+ clics) — doit être à 1 clic depuis le header
- ❌ Bascule de langue sans persistance — cookie `NEXT_LOCALE` obligatoire (cf. `02-design-conception/locale-detection.md`)
- ❌ Class Tailwind `ml-4` / `mr-4` dans un composant susceptible d'apparaitre en RTL — utiliser `ms-4` / `me-4`
- ❌ Police arabe par défaut (`sans-serif` système) — rendu pauvre, casse l'éditorial — charger Cairo ou IBM Plex Arabic
- ❌ Traduction littérale du copywriting marketing FR vers AR — passer par le `tone-style-guide.md`
- ❌ Wizard checkout réécrit dans next-intl — `WizardDictionary` existe et fonctionne (CHA-231)

## Checklist de sortie du dossier 05

Avant de passer au dossier `06-data-strategy`, l'équipe doit pouvoir cocher :

- [ ] Le design du locale switcher est figé (un des 3 candidats)
- [ ] La direction RTL est testée mentalement sur header + hero + wizard + footer
- [ ] Les fontes arabes ont été comparées (Cairo vs IBM Plex Arabic) et un choix est tranché
- [ ] La stratégie d'images (neutre / variantes / overlay) est décidée page par page
- [ ] Le wizard a son plan de migration documenté (zéro régression CHA-231)
- [ ] Le guide de ton est lu et accepté par la fondatrice
- [ ] Le glossaire CSV est exporté vers le futur TMS (Crowdin / Lokalise)

## Liens transverses utiles

- État actuel des composants FemiGlow : `00-context/etat-actuel.md`
- Schéma de clés de traduction : `02-design-conception/translation-keys-schema.json`
- Sample messages YAML : `02-design-conception/sample-messages-files.yaml`
- Architecture cible PlantUML : `02-design-conception/architecture-cible.puml`
- Frontend playbook (composants détaillés) : `04-frontend/` (à venir)
- Tests visuels Playwright RTL : `07-tests/` (à venir)
- Playbook Kolenda FemiGlow : `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md`

## Matrice résumée par surface FemiGlow

Vue synoptique pour la fondatrice et la designer. Chaque ligne décrit la combinaison de décisions UX qui s'applique à une surface.

| Surface | Switcher | RTL | Police AR | Images | Voix |
|---|---|---|---|---|---|
| Header | dropdown desktop, pills mobile | strict | Cairo | logo neutre | navigation neutre |
| Hero accueil | n/a | strict | Cairo | neutre + texte HTML | éditoriale, intime |
| Page Kit | n/a | strict | Cairo + diagramme variantes | mix neutre + variantes diagram | éditoriale produit |
| Page Rituel | n/a | strict | Cairo | overlay HTML sur photos | poétique narrative |
| Page Journal | n/a | strict | Newsreader (LTR) + Cairo (RTL) | neutre | éditoriale longue forme |
| Wizard checkout | masqué V1 | strict + phone LTR | Cairo | n/a | factuel sobre |
| Pages légales | n/a | strict | Cairo | n/a | strictement factuel |
| Footer | pills | strict | Cairo | neutre | navigation neutre |
| Emails transactionnels | n/a | strict (template) | Cairo + fallback web-safe | banner neutre + texte | factuel + chaleureux |
| OG / social images | n/a | n/a | n/a | variantes par locale obligatoires | éditorial impact |
| Page 404 / 500 | select natif fallback | strict | Cairo | neutre | sobre + invitant retour |
| Admin (back-office) | absent | n/a (FR only V1) | n/a | n/a | n/a |

## Phasage UX recommandé

Pour éviter de tout livrer en un seul gros incrément, l'équipe UX/Front avance par paliers :

| Phase | Livrable UX | Critères de sortie |
|---|---|---|
| UX-1 | Maquettes Figma du switcher (3 variantes) | Approbation fondatrice + designer |
| UX-2 | Audit Tailwind logical-properties sur composants partagés | Lint local passe |
| UX-3 | Polices `next/font` actives FR + AR (`dir="rtl"` working) | Smoke page `/ar/` lisible |
| UX-4 | Hero, Header, Footer migrés en logical | Tests visuels LTR inchangés |
| UX-5 | Pages marketing (Kit, Rituel, Maison) migrées | Audit a11y >= 95 par locale |
| UX-6 | Wizard checkout intégré multilingue (CHA-231 préservé) | E2E checkout FR/AR/EN green |
| UX-7 | Pages légales et journal multilingues | Reviewer juridique signé |
| UX-8 | OG images générées par locale | Validation partage social |
| UX-9 | Recettes utilisateurs natifs (3 par locale) | NPS positif, 0 critique majeure |

Chaque phase peut être livrée derrière feature flag `I18N_<phase>=true` pour rollback rapide en cas de régression visuelle.

## Risques UX identifiés

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Drift FR vs AR (FR splendide, AR négligé) | Haute | Critique | Validation parité visuelle en revue Figma + Playwright RTL screenshots |
| Switcher peu découvrable | Moyenne | Élevé | Tests utilisateurs T1-T3 (cf. `locale-switcher-ui.md`) |
| Wizard régressé en RTL (CHA-231) | Faible | Critique | Tests E2E checkout × 3 locales en CI bloquante |
| Polices arabes chargées en page FR (gaspillage) | Moyenne | Moyen | Chargement conditionnel `next/font` selon locale |
| Pluriels arabes mal implémentés | Haute | Moyen | ICU MessageFormat + validation native AR |
| Adresse masculine par défaut en AR | Haute | Élevé | Glossaire CSV strict + relecture native obligatoire |
| Image avec texte FR oubliée en AR | Moyenne | Élevé | OCR optionnel + checklist livraison images |
| Layout shift au swap font | Faible | Moyen | `adjustFontFallback` activé partout |
| Mauvais miroir d'icône directionnelle | Moyenne | Faible | Lint custom `no-unmirrored-arrow` (V2) |
| Confusion utilisateur entre locales (`/fr/` vs `/ar/` similaires visuellement) | Faible | Faible | Direction RTL crée signal visuel net |

## Ressources externes utiles

Pour les designers et devs débutant en RTL / multilingue :

| Resource | Type | Pourquoi |
|---|---|---|
| Material Design RTL guidelines | Article | Best practices Google pour layout RTL |
| Apple HIG — Right-to-left | Article | Pour cohérence iOS / macOS |
| Tailwind CSS Logical Properties | Doc officielle | Reference des classes `ms-*`, `me-*`, etc. |
| `next-intl` ICU MessageFormat | Doc | Pluralization arabe |
| Google Fonts subsets arabic | Tool | Choix Cairo / Tajawal / Amiri |
| W3C Internationalization Activity | Resource | Standards |
| Crowdin Best Practices | Article | TMS workflow |

## Statut de ce sous-dossier

| Fichier | Statut | Reviewer attendu |
|---|---|---|
| `README.md` | Draft | Fondatrice + Designer |
| `locale-switcher-ui.md` | Draft | Designer + Frontend |
| `rtl-support.md` | Draft | Frontend + QA |
| `typography.md` | Draft | Designer + Frontend |
| `images-localization.md` | Draft | Designer + CMS owner |
| `wizard-i18n.md` | Draft | Frontend + QA wizard |
| `tone-style-guide.md` | Draft | Fondatrice + Traducteur |
| `content-style-guide.csv` | Draft | Traducteur (validation finale) |
