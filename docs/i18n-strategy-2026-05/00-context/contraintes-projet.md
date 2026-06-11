# Contraintes projet — limites stack et dette technique

## 1. Stack actuelle (versions fixées)

| Composant | Version | Impact i18n |
|---|---|---|
| Next.js | 14.x App Router | Doit utiliser library RSC-compatible (next-intl ✅) |
| React | 18.x | ✅ Compatible toutes options |
| TypeScript | 5.9 (strict) | Library doit fournir types ou générer codegen |
| Tailwind CSS | 3.x | ✅ Logical properties supportées depuis 3.0 |
| Zod | 3.x | Pour validation runtime des locales valides |
| Drizzle ORM | 0.45 | Pour DB-backed translations (CMS) |
| Vercel deployment | Edge + Serverless | Middleware locale doit être edge-compatible |
| Neon Postgres | Free tier (limit query/min) | Cache strategy pour translations dynamiques |

## 2. Dette technique existante

### 2.1 Tests E2E E2E orphelins
- ~5 specs Playwright créées dans des sprints précédents, jamais run
- Impact i18n : doivent être audités avant ajout de nouveaux specs

### 2.2 Type errors pré-existants (38 erreurs TS)
- CSv2 components (`lucide-react`, `sonner` non installés)
- Orchestrator chat (types `message_complete` non assignable)
- Tests attribution orphelins (modules taxonomy/request-signals/enrich-event références mortes)

→ **Implication** : i18n strict typing risque de masquer ces erreurs. Audit régulier requis.

### 2.3 Strings hardcoded dispersés (audité — 600-800)
- Pas d'inventaire centralisé
- ESLint pas configuré pour détection
- Risque de régression si on ne setup pas une règle lint

### 2.4 Pre-existing `.env.example` leak (OLLAMA_PROVIDER_KEY visible)
- À fixer indépendamment (hors scope i18n)

## 3. Contraintes performance

| KPI | Cible | Risque i18n |
|---|---|---|
| Lighthouse Performance | ≥ 90 | Bundle i18n size |
| First Contentful Paint | < 1.5s | Chunk i18n côté serveur RSC OK |
| Largest Contentful Paint | < 2.5s | Pas d'impact (texte) |
| Cumulative Layout Shift | < 0.1 | Risque si RTL change font + dimensions |
| Total Blocking Time | < 200ms | Pas d'impact (RSC) |

## 4. Contraintes infrastructure

### 4.1 Vercel
- Edge runtime middleware : 50ms timeout, 1MB limit code
- Limitation : pas accès filesystem (use `import` pour locales JSON)
- Edge cache : peut cacher par locale via header `Vary: Accept-Language` + `Cookie`

### 4.2 Neon (Postgres)
- Connection pooling via `pgbouncer`
- Limites free tier : 0.5 GB storage, queries soft-throttled
- Implication : éviter de query DB pour translations à chaque page render (utiliser cache Next.js `revalidate` ou `next/cache`)

### 4.3 GitHub Actions CI
- Runners standard Ubuntu, 7 GB RAM, 2 vCPU
- Limite : 6h timeout job, ~2 GB cache
- Implication : codegen i18n doit être < 30s

## 5. Contraintes humaines

### 5.1 Équipe
- 1 dev principal (full-stack)
- 1 fondatrice (PO + content)
- Pas de traducteur dédié
- Pas de QA dédié

→ Implication : workflow doit être self-serve, AI translation possible comme baseline + review humaine.

### 5.2 Budget
- Limite SaaS subscription : < 100 USD/mois cumulé
- Implication : éviter Crowdin Team Plan ($69+), favoriser self-hosted ou Free Plan

## 6. Contraintes juridiques / accessibilité

| Contrainte | Source | Impact i18n |
|---|---|---|
| **WCAG 2.1 AA** | Conformité a11y | RTL doit être accessible (screen reader directionality) |
| **GDPR / RGPD** | Cookie consent | Cookie `NEXT_LOCALE` est "fonctionnel" (pas besoin opt-in) |
| **Loi 09-08 Maroc** | CNDP protection données | Idem (cookie fonctionnel) |
| **Mentions légales obligatoires** | Code Commerce | Doivent être disponibles dans la langue du visiteur (cf. sprint LEGAL-V2) |

## 7. Dépendances projet récentes

- **CHA-LEAD-V2** (sprint chat-conversations-leads-fix) — branche existante avec feature flag `CHAT_ADMIN_FILTERS_V2`
- **LEGAL-V2** (sprint pages-legales-fix) — branche existante avec feature flag `LEGAL_VARS_V2`

→ Implication : nouvelles features doivent **cohabiter** avec ces flags (pas conflit).

## 8. Hypothèses non-validées (à clarifier avec fondatrice)

| # | Hypothèse | Si fausse ? |
|---|---|---|
| H1 | Marché EN = expat + export tier-1 (US, FR, EU) | Réorienter target |
| H2 | Devise reste MAD pour toutes langues V1 | Ajouter Stripe multi-currency |
| H3 | Pas de besoin Hebrew/Chinese pour V1 | Étendre RTL/CJK support |
| H4 | Admin reste FR (out of scope) | Doubler scope |
| H5 | Wizard CHA-231 (FR+AR existant) ne sera pas refondu | Reprendre WizardDictionary |
| H6 | Budget acceptable < 100 USD/mois | Restreindre options |

## 9. Risques techniques majeurs

| # | Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|---|
| R1 | RTL break composants admin existants | Moyenne | Élevé | Audit composants + tests visuels |
| R2 | Migration progressive crée des pages bilingues partielles | Élevée | Moyen | Feature flag + checklist par route |
| R3 | Performance dégradée par bundle i18n | Moyenne | Moyen | Code splitting par locale (next-intl) |
| R4 | SEO perdu pendant transition | Élevée | Élevé | Redirects 301 + sitemap multi-lang en parallèle |
| R5 | Traduction AR auto via IA = qualité médiocre | Élevée | Élevé | Review humain obligatoire avant publish |
| R6 | Bug RTL non détecté en CI (texte LTR dans contexte RTL) | Moyenne | Faible | Visual regression Playwright |
| R7 | Strings dynamiques (Intl plural) cassent en AR | Moyenne | Moyen | Tests dédiés `Intl.PluralRules` AR |

## 10. Décisions hors-scope (sprints futurs)

Pour V1, on EXCLUT :
- Multi-devise dynamique (USD/EUR conversion)
- Localisation des images produit
- Translation du `/admin`
- Mode RTL pour la console admin
- Geo-blocking par pays
- Subdomain `fr.femiglow.ma`

→ Tous reportés à V2+ si nécessité confirmée.
