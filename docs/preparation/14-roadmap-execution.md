# 14 — Roadmap d'exécution

> *Du dossier au site live en 8 sprints. Phasé, mesurable, réversible.*

---

## 1. Vue d'ensemble

| Phase | Période | Livrable | Statut |
|---|---|---|---|
| **Préparation** | terminée | Dossier de préparation complet | ✅ ce dossier |
| **Phase 1 — Prototype B2C** | S1 → S8 | 9 pages en mock data, déployé production | 🟡 démarrage |
| **Phase 2 — CMS + B2B** | S9 → S14 | Connexion CMS, section partenaires, AR-RTL | ⏳ planifié |
| **Phase 3 — Optimisation** | S15+ | A/B tests, multi-produits, fidélité | ⏳ futur |

## 2. Phase 1 — sprint planning détaillé

Chaque sprint = 1 semaine. Estimation pour 1 dev frontend senior + 1 designer 50 % + 1 PO 25 %.

### Sprint 1 — Fondations (S1)

**Objectif** : repo configuré, design system installé, premier composant fonctionnel.

| Tâche | Estimé | Livrable |
|---|---|---|
| Init repo Next.js 14 + TypeScript strict + Tailwind + ESLint | 0.5 j | `pnpm dev` fonctionnel |
| Configuration Vitest + Playwright + Storybook 8 | 0.5 j | suites CI vertes |
| Self-hosting fonts (Cormorant, Inter, Pinyon) | 0.5 j | layout.tsx avec fonts loaded |
| Tokens CSS (`src/styles/tokens.css`) complet | 1 j | toutes les variables disponibles |
| Composant `<Button />` avec 4 variantes + states | 0.5 j | Storybook stories + tests |
| Composant `<Container />`, `<Stack />`, `<Inline />` | 0.5 j | primitives layout |
| Header + Footer (sans wordmark animé) | 1 j | layout commun |
| Page `/` minimale en mock | 0.5 j | site répond au load |

**DoD** : `pnpm build` passe, `pnpm test` passe, Lighthouse home > 90.

### Sprint 2 — Catalogue UI primitives (S2)

**Objectif** : la bibliothèque UI primitive complète.

| Tâche | Estimé | Livrable |
|---|---|---|
| `<Heading />` avec niveaux h1-h4 typographiques | 0.5 j | story + tests |
| `<Text />` (lead, body, small, kicker) | 0.5 j | story |
| `<Image />` wrapper sur next/image | 0.5 j | ratios, blur, lazy |
| `<Link />` (interne / externe / picto) | 0.5 j | story |
| `<Pictogram />` SVG library (40 picto) | 1 j | composant + svg files |
| `<Etiquette />` 4 variantes saison | 0.5 j | story |
| `<Motif />` vague + fleuron | 0.5 j | story |
| `<Card />` compound (Image, Body, Title, Excerpt) | 1 j | story compound |
| `<Reveal />` wrapper Framer Motion | 0.5 j | story avec variants |
| `<Tag />`, `<Badge />`, `<Divider />` | 0.5 j | stories |

**DoD** : Storybook publié avec ~25 composants, axe-core 0 violation.

### Sprint 3 — Pages éditoriales (S3)

**Objectif** : `/`, `/rituel`, `/maison` en navigation fluide.

| Tâche | Estimé | Livrable |
|---|---|---|
| Mock data : `homepage.ts`, `rituel.ts`, `maison.ts` | 0.5 j | `src/data/mock/` |
| Schemas Zod correspondants | 0.5 j | `src/lib/schemas/` |
| Adapter `mockAdapter` (read-only) | 0.5 j | API contractuelle |
| Section `<Hero />` avec animations | 1 j | composé |
| Sections `<Manifeste />`, `<GestesGrid />`, `<AvisStrip />` | 1.5 j | composées |
| Page `/` complète | 1 j | live |
| Page `/rituel` complète | 0.5 j | live |
| Page `/maison` complète | 1 j | live |

**DoD** : 3 pages naviguables, Lighthouse ≥ 95, axe-core 0 violation.

### Sprint 4 — Page produit + panier (S4)

**Objectif** : `/kit`, panier fonctionnel, drawer.

| Tâche | Estimé | Livrable |
|---|---|---|
| Mock data produit + composition + FAQ | 0.5 j | data |
| Page `/kit` — sections produit | 1.5 j | hero, composition, FAQ |
| Cart store Zustand + persist | 1 j | state + tests |
| `<CartDrawer />` overlay | 1 j | focus trap, animations |
| `<AddToCartButton />` | 0.5 j | loading, success |
| Page `/panier` minimal | 0.5 j | liste, qty, total |
| Compteur header dynamique | 0.5 j | live |
| Tests E2E ajout panier | 0.5 j | green |

**DoD** : ajout/retrait panier fonctionnel, persisté, tests E2E.

### Sprint 5 — Tunnel checkout (S5)

**Objectif** : `/commander` 3 étapes, validation, soumission mock.

| Tâche | Estimé | Livrable |
|---|---|---|
| Schemas Zod address + order + form | 0.5 j | validation runtime |
| `<Stepper />` composant | 0.5 j | 3 états visuels |
| Form Étape 1 (identité) avec RHF + Zod | 1 j | validation, focus |
| Form Étape 2 (livraison) | 1 j | adresse + mode |
| Form Étape 3 (paiement) | 1 j | choix mode + récap |
| Header simplifié checkout | 0.5 j | layout dédié |
| Soumission → mock order created | 0.5 j | response + redirect |
| Tests E2E parcours complet | 0.5 j | COD scénario |

**DoD** : tunnel COD complet en mock, page merci affichée.

### Sprint 6 — Journal + page merci (S6)

**Objectif** : journal éditorial, page merci avec lettre.

| Tâche | Estimé | Livrable |
|---|---|---|
| Mock data 8 articles + 1 featured | 0.5 j | data |
| Page `/journal` hub avec featured + grille | 1 j | live |
| Page `/journal/[slug]` avec MDX rendering | 1.5 j | typographie soignée |
| Newsletter form (mock) | 0.5 j | composant |
| Page `/merci` avec lettre éditoriale | 1 j | tracé signature animé |
| Page `/contact` avec form (mock) | 1 j | live |
| Cross-links inter-pages selon doc 03 | 0.5 j | linking maillé |

**DoD** : 9 pages navigables, Storybook complet ~50 composants.

### Sprint 7 — Polish, performance, accessibilité (S7)

**Objectif** : tout passer en mode haute qualité.

| Tâche | Estimé | Livrable |
|---|---|---|
| Audit Lighthouse + corrections | 1 j | ≥ 95 sur toutes pages |
| Audit axe + corrections | 1 j | 0 violation |
| Audit visual / Storybook visual review | 0.5 j | cohérence |
| Optimisation images (AVIF, blur, sizes) | 0.5 j | budget respecté |
| Code splitting + bundle analyzer | 0.5 j | budget ≤ 90 kB |
| Sitemap, robots, OG images, JSON-LD | 1 j | SEO complet |
| Tests E2E multi-browser | 0.5 j | green sur Chromium / Firefox / WebKit |
| Documentation interne (README + ADR) | 0.5 j | onboarding facile |

**DoD** : tous les KPIs verts, Lighthouse ≥ 95, axe 0.

### Sprint 8 — Déploiement et validation (S8)

**Objectif** : déploiement Vercel production, validation manuelle, monitoring.

| Tâche | Estimé | Livrable |
|---|---|---|
| Setup Vercel project + domaine `femiglow.ma` | 0.5 j | DNS configuré |
| Setup Sentry + source maps | 0.5 j | erreurs trackées |
| Setup Plausible Analytics | 0.5 j | dashboard live |
| Setup Vercel Speed Insights | 0.25 j | RUM actif |
| Setup Better Uptime | 0.25 j | ping health |
| Tests manuels lecteur écran (NVDA + VoiceOver) | 1 j | rapport |
| Tests manuels appareils réels (iPhone, Android) | 1 j | rapport |
| QA finale parcours complet par 3 testeurs | 1 j | checklist signée |
| Mise en ligne progressive (preview → production) | 0.5 j | live |
| Postmortem session 24h | 0.5 j | aucun incident bloquant |

**DoD** : site live sur `femiglow.ma`, monitoring vert 48h, KPIs validés.

## 3. Risques par sprint

| Sprint | Risque principal | Mitigation |
|---|---|---|
| S1 | Tooling instable | versions pinnées, lock file commit |
| S2 | Sur-ingénierie composants | review hebdo, principe « three before abstraction » |
| S3 | Mock data divergente du futur CMS | schemas Zod = source de vérité, validation Phase 2 facile |
| S4 | Bug persistance panier (localStorage) | tests cross-browser, fallback memory |
| S5 | Validation forms complexe (téléphone Maroc) | regex + tests exhaustifs, message clair |
| S6 | MDX typographie cassée | composants custom MDX, tests visuels |
| S7 | Régression performance en correctifs | bundle budget en CI, alerte |
| S8 | DNS / domaine retard | demande DNS S6, contingence sous-domaine `staging.femiglow.ma` |

## 4. Phase 2 — sprint planning haut niveau (S9-S14)

| Sprint | Focus |
|---|---|
| S9 | Connexion Sanity : adapter, schemas GROQ, ISR webhook |
| S10 | Migration mock → CMS sans changement UI (test contrats) |
| S11 | Section B2B (`/partenaires`, `/programme`) |
| S12 | Section B2B (`/echantillon`, `/espace-pro` minimal) |
| S13 | I18n arabe : routing, RTL, traductions partielles |
| S14 | Polish Phase 2 + déploiement |

## 5. Backlog Phase 3+ (priorités à confirmer)

- A/B tests via Vercel Edge Config (microcopy `/kit`)
- Multi-produits Catalogue
- Programme fidélité
- Reviews et notes produit
- Recherche journal full-text (Algolia ou serverless)
- PWA (offline lecture journal)
- Application mobile (réflexion ouverte)
- Marketplace partenaires salons

## 6. Critères de succès Phase 1

| KPI business | Cible 3 mois post-launch |
|---|---|
| Sessions / mois | 5 000 |
| Taux de conversion add-to-cart | > 8 % |
| Taux de complétion checkout | > 65 % |
| Sessions / commande | < 12 |
| Bounce rate `/` | < 55 % |
| Pages / session | ≥ 3 |
| NPS (post-J+15 email) | > 50 |
| Récurrence (J+90) | > 18 % |

| KPI technique | Cible |
|---|---|
| Lighthouse Performance moyen | ≥ 95 |
| LCP p75 | < 2.0 s |
| CLS p75 | < 0.05 |
| INP p75 | < 150 ms |
| Disponibilité | ≥ 99.9 % |
| Erreurs 5xx | < 0.5 % |
| Taux d'erreurs Sentry | < 0.1 sessions |

| KPI éditorial | Cible |
|---|---|
| Articles publiés | 8 au launch, +2/mois |
| Newsletter inscrits | 500 à M+3 |
| Taux ouverture newsletter | > 40 % |
| Taux de clic newsletter | > 8 % |

## 7. Gouvernance

### 7.1 Rôles

| Rôle | Responsabilité |
|---|---|
| **Product Owner (Elazhar)** | priorisation, validation produit, voix marque |
| **Designer** | tokens, design system, illustrations, photographie |
| **Dev frontend** | implémentation, tests, performance |
| **Dev backend (Phase 2)** | CMS, paiement, emails |
| **QA testeur (Phase 2)** | tests manuels, accessibilité externe |

### 7.2 Rituels

| Rituel | Fréquence | Objet |
|---|---|---|
| Daily async (Slack) | quotidien | blocages, focus jour |
| Sprint planning | hebdo | engagement sprint |
| Sprint demo | hebdo | livrables visibles |
| Retro | bi-hebdo | amélioration |
| Design review | hebdo | tokens, composants, pages |
| QA review | hebdo | tests, axe, perf |

### 7.3 Outils

| Outil | Usage |
|---|---|
| GitHub | repo, PRs, issues |
| Linear ou GitHub Projects | gestion sprint |
| Figma | design |
| Slack / Discord | comms async |
| Notion | documentation longue (preferable: ce dossier dans repo) |
| Loom | demos vidéo asynchrones |
| Vercel | preview deploys |

## 8. Budget temps Phase 1

| Profil | Volume |
|---|---|
| Dev frontend senior | 8 sprints × 5 j = 40 j |
| Designer | 8 sprints × 2.5 j = 20 j |
| PO | 8 sprints × 1.25 j = 10 j |
| QA | 1 sprint × 5 j = 5 j |
| **Total** | **~75 j-personne** |

## 9. Critères Go / No-Go

### 9.1 Go-live Phase 1

| Critère | Statut requis |
|---|---|
| 9 pages fonctionnelles | ✅ |
| Tests E2E parcours d'achat verts | ✅ |
| Lighthouse ≥ 95 sur toutes pages | ✅ |
| axe 0 violation | ✅ |
| Tests manuels lecteurs écran | ✅ |
| Stripe + COD configurés | ✅ |
| Resend / email transactionnels | ✅ |
| Sentry + Speed Insights actifs | ✅ |
| Domaine + HTTPS | ✅ |
| Mentions légales + CGV | ✅ |
| RGPD : politique cookies + consentement | ✅ |

### 9.2 No-Go : reporter le launch

- Tests E2E rouges
- Lighthouse < 90
- Bugs critiques connus
- Indisponibilité 5xx récurrente
- Problème conformité RGPD

## 10. Mesures post-launch (M+1 à M+3)

| Période | Action |
|---|---|
| **J+1 à J+7** | watch monitoring 24/7, daily tests prod |
| **J+7 à J+30** | analyse trafic, ajustements microcopy, premiers articles bonus |
| **M+1** | bilan KPI, premières optimisations CRO |
| **M+2** | premier A/B test (page `/kit` micro-variantes) |
| **M+3** | bilan complet → décision démarrage Phase 2 |

## 11. Plan de communication

| Canal | Phase | Message |
|---|---|---|
| Soft launch (privé) | S8 | famille, amis, pre-orders |
| Instagram FemiGlow | S8 + 1 j | annonce maison, photo manifeste |
| Newsletter J+0 | S8 + 0 | « La maison ouvre ses portes » |
| Press release (si pertinent) | S8 + 7 j | médias beauté Maroc |
| Influenceurs niche | S8 + 14 j | 3 contacts ciblés cohérents marque |

## 12. Plan de continuité Phase 1 → Phase 2

| Étape | Détail |
|---|---|
| Stabiliser Phase 1 | 4 semaines minimum sans incident majeur |
| Choix CMS définitif | RFC + ADR |
| Setup environnement Phase 2 | branche `feature/sanity` |
| Migration progressive | adapter par adapter, page par page |
| Bascule production | feature flag CMS_PROVIDER |
| Validation 7 jours | rollback possible (mock toujours dispo) |

## 13. Tableau de suivi sprint (template)

```md
## Sprint X — YYYY-MM-DD à YYYY-MM-DD

### Engagement
- [ ] Tâche 1
- [ ] Tâche 2

### Réalisé
- ...

### Reporté
- ...

### Démo
- Lien Vercel preview : ...

### Métriques
- Lighthouse : ...
- Bundle : ...
- Coverage : ...

### Retro
- Bien : ...
- À améliorer : ...
- Action : ...
```

## 14. Décisions à prendre avant S1

| Décision | Échéance |
|---|---|
| Choix package manager (pnpm recommandé) | avant S1 |
| Choix style des illustrations / photographie | avant S2 |
| Banque de photos contextuelles (mains, ongles) | avant S3 |
| Choix CMS Phase 2 (Sanity vs Contentful) | avant S6 |
| Statuts juridiques (raison sociale, SIRET marocain) | avant S8 |
| Compte Stripe + CMI Maroc activés | avant S5 |
| Resend / Postmark choisi + DNS SPF/DKIM | avant S5 |
| Compte Vercel équipe | avant S1 |
| Domaine `femiglow.ma` réservé | avant S1 ✅ supposé |

## 15. Engagements de fin de Phase 1

À la fin de Phase 1, FemiGlow dispose de :

- ✅ Site live `femiglow.ma` avec 9 pages B2C
- ✅ Tunnel d'achat COD + Stripe fonctionnel
- ✅ Storybook publié avec >50 composants
- ✅ Suite de tests automatisés (unit + E2E)
- ✅ Monitoring complet (Sentry, Speed Insights, Plausible)
- ✅ Documentation prête pour Phase 2 (ce dossier + ADRs + Storybook)
- ✅ Architecture découplée prête à recevoir CMS sans réécriture
- ✅ Score Lighthouse ≥ 95, accessibilité WCAG 2.2 AA validée

> *Documents annexes : voir [`./annexes/`](./annexes/)*
