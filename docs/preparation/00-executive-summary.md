# 00 — Résumé exécutif

> *Synthèse condensée pour décideurs · 5 minutes de lecture*

---

## 1. Vision

FemiGlow est une **maison de soin pour les ongles**, fondée à Casablanca en 2024, qui propose un **kit rituel d'éclat** en quatre gestes (paste / powder / shine / polish) — sans vernis, sans abrasion. Elle s'adresse à une femme 28-45 ans urbaine marocaine, CSP B/B+, et à des partenaires professionnels (salons, instituts).

La marque revendique un positionnement de **luxe accessible**, fondé sur trois piliers :

1. **Le rituel comme grammaire** — la maison ne vend pas un produit, elle transmet un geste
2. **L'absence comme signature** — espace blanc, silence, refus du marketing intrusif
3. **Une maison, deux portes** — déclinaisons B2C (sensorielle) et B2B (factuelle) sans rupture identitaire

## 2. Périmètre du chantier

### Phase 1 — Prototype (objet du présent dossier)

Construction d'une **application Next.js prototype** comportant les 9 pages B2C documentées :

| Page | URL | Rôle | Funnel |
|---|---|---|---|
| Accueil | `/` | Landing éditorial, dual path | TOFU |
| Rituel | `/rituel` | Page narrative MOFU | MOFU |
| Kit | `/kit` | Fiche produit pivot | BOFU |
| Journal | `/journal` | Hub éditorial | Fidélisation |
| Maison | `/maison` | Récit fondateur | Considération |
| Panier | `/panier` | Vérification | Pre-checkout |
| Commander | `/commander` | Tunnel checkout 3 étapes | Conversion |
| Merci | `/merci` | Post-achat émotionnel | Activation |
| Contact | `/contact` | Pont conversationnel | Transverse |

**Objectif prototype** : valider l'expérience, le système de design, l'architecture des composants découplés des données *avant* de coupler au CMS.

### Phase 2 — Couplage CMS (post-prototype)

Branchement progressif des composants sur le CMS déjà en place. Tous les composants conçus en Phase 1 sont par construction *data-agnostic* et exposent des props/schemas Zod compatibles.

### Phases ultérieures (hors scope immédiat)

B2B (`/partenaires`, `/programme`, `/echantillon`, `/espace-pro`), pages légales, version arabe RTL, app mobile, fidélité.

## 3. Choix stratégiques engageants

| Sujet | Décision | Justification |
|---|---|---|
| **Framework** | Next.js 14+ (App Router, RSC) | SSR/SSG, image optimization, routing convention, écosystème mature |
| **Langage** | TypeScript strict | Contrats explicites entre composants et données, refactor sûr |
| **Styling** | Tailwind CSS + design tokens CSS variables | Productivité + alignement strict charte (pas de drift) |
| **Validation** | Zod | Schémas réutilisables : runtime + types + form + API contract |
| **State client** | Zustand (panier) + URL state (filtres) | Léger, persistable, pas d'overkill Redux |
| **Forms** | React Hook Form + Zod resolver | Validation cohérente, perf optimale |
| **Animations** | Framer Motion + CSS transitions | API déclarative, respect `prefers-reduced-motion` |
| **Test** | Vitest + Testing Library + Playwright | Unitaire/intégration/e2e cohérents |
| **CMS (Phase 2)** | Compatible Sanity / Contentful / Strapi | Schémas Zod portables ; choix final post-prototype |
| **Paiement** | Stripe + CMI Maroc + COD | COD = 35-40 % des commandes au Maroc |
| **Email transactionnel** | Resend ou Postmark | Simplicité, deliverability |
| **Analytics** | Plausible (vie privée) + GA4 (e-commerce) | Lecture côté maison + tracking funnel |
| **Hébergement** | Vercel | Edge runtime, image opt, analytics natifs |

## 4. KPIs de succès du prototype

| Critère | Cible | Mesure |
|---|---|---|
| Cohérence design system | 100 % des composants utilisent les tokens | Audit Storybook |
| Découplage data | 0 donnée codée en dur dans un composant page-spécifique | Revue de code |
| Web Vitals (Lighthouse) | LCP < 2.5 s · CLS < 0.1 · INP < 200 ms | Lighthouse CI |
| Accessibilité | WCAG 2.2 AA — score axe ≥ 95 | axe-core + revue clavier |
| Couverture tests unitaires | ≥ 70 % composants UI | Vitest |
| Couverture e2e | 100 % parcours achat (kit → merci) | Playwright |
| SEO technique | Score Lighthouse ≥ 90 | Lighthouse |
| Documentation | 1 README par module + Storybook par composant | Audit |

## 5. Risques identifiés et mitigations

| Risque | Sévérité | Mitigation |
|---|---|---|
| **Drift visuel CMS → site** | Élevée | Composants pilotés tokens uniquement, pas de styles ad-hoc ; schémas Zod en garde-fou |
| **Performance plombée par richesse visuelle** (vagues, vidéos lentes) | Moyenne | Vidéos lazy + autoplay scroll-trigger, vagues SVG inline, images WebP/AVIF |
| **Tunnel checkout abandons** | Élevée | 3 étapes max, autosave, guest checkout, COD visible dès étape 2 |
| **Fragmentation du code i18n FR/AR (V2)** | Moyenne | Architecture i18n posée dès Phase 1 (next-intl, RTL ready) sans contenu AR encore |
| **Régression accessibilité au fil des sprints** | Moyenne | axe-core en CI, story Storybook avec a11y addon obligatoire |
| **Couplage fort à un CMS spécifique** | Moyenne | Adapter pattern : `lib/cms/index.ts` ne dépend que de schémas Zod, jamais des SDK CMS |

## 6. Roadmap synthétique (cf. document 14 pour détail)

```
S1-S2 : Fondations (tokens, layout, header/footer, page Accueil, Storybook)
S3    : Pages éditoriales (Rituel, Maison, Journal)
S4    : Page Kit + Panier (logique panier Zustand)
S5    : Tunnel Commander (3 étapes, validation, paiement mock)
S6    : Merci + Contact + emails transactionnels mock
S7    : QA, Lighthouse, axe, Playwright e2e
S8    : Branchement CMS, prod, monitoring
```

## 7. Livrables finaux Phase 1

À l'issue du sprint S7, l'équipe livre :

- Application Next.js déployée en preview Vercel
- Storybook publié (composants documentés, contrôles, tests a11y)
- Suite de tests verte (unitaires + e2e)
- Rapports Lighthouse signés (4 pages clés ≥ 90 sur tous critères)
- Mock data JSON couvrant toutes les pages
- Schémas Zod portables vers CMS
- Documentation à jour de ce dossier

## 8. Ce qui n'est volontairement PAS dans le scope Phase 1

| Hors scope | Pourquoi |
|---|---|
| Branchement CMS réel | Sépare la validation expérience du choix CMS |
| Paiement réel (Stripe live) | Prototype mock — règles métier validées d'abord |
| Tunnel B2B | Phase 2 |
| Version arabe (contenu RTL) | Architecture posée mais contenu Phase 2 |
| Compte client / espace personnel | Guest checkout suffit en V1 |
| Avis & reviews UGC | Témoignages éditoriaux uniquement V1 |
| Push notifications / app mobile | N/A V1 |

> *Lecture suivante recommandée : [01 — Marque, vision et voix](./01-marque-vision-voix.md)*
