# ADRs candidates — décisions à valider

> Architecture Decision Records à valider avant de démarrer l'implémentation.
> Chaque ADR liste options + pros/cons + recommandation.

---

## ADR-001 — Library i18n choisie

**Statut** : 🟡 À décider

**Contexte** : Le projet utilise Next.js 14 App Router avec RSC. Choix structurant.

**Options** :

| Option | Pros | Cons |
|---|---|---|
| **A. `next-intl`** | RSC-first, type-safe, routing intégré, populaire, doc impeccable | Format messages JSON (apprentissage), v3 récente |
| **B. `next-i18next`** | Très mature, large communauté | Pages Router-first, fork App Router non-officiel |
| **C. `paraglide-js`** | Bundle léger (~1kb), TypeScript compile-time | Moins mature, doc en mouvement |
| **D. `react-i18next` brut** | Standalone, flexible | Pas spécifique Next, plus de glue à écrire |
| **E. Maison (extension WizardDictionary)** | 0 dépendance, contrôle total | À maintenir tout (routing, SEO, RSC) |

**Recommandation** : **A — `next-intl`** (priorité 1) ou **C — `paraglide-js`** (si bundle critique).

→ Cf. [`../01-options-techniques/comparaison-libraries.md`](../01-options-techniques/comparaison-libraries.md).

---

## ADR-002 — Stratégie URL (path-based vs cookie vs subdomain)

**Statut** : 🟡 À décider

**Contexte** : Comment l'URL reflète-t-elle la locale active ?

**Options** :

| Option | Exemple | Pros | Cons |
|---|---|---|---|
| **A. Path-based** | `/fr/kit`, `/ar/kit`, `/en/kit` | ✅ SEO optimal, partageable, pas de flicker | URL plus longue |
| **B. Cookie + même URL** | `/kit` avec cookie `locale=ar` | ✅ URL propre | ❌ SEO faible, pas partageable |
| **C. Sub-domain** | `fr.femiglow.ma`, `ar.femiglow.ma` | ✅ SEO bon, séparation forte | ❌ Cert/DNS complexe, share-link friction |
| **D. Domain TLD** | `.fr`, `.ma`, `.com` | ✅ Best SEO local | ❌ Coût domaines, SOI |

**Recommandation** : **A — Path-based** (`/fr/`, `/ar/`, `/en/`).

**Justification** :
- SEO optimal (Google indexe chaque URL séparément)
- Partageable (lien Slack/Twitter conserve la langue)
- Cohérent avec `next-intl` middleware par défaut
- Pas de coût infra additionnel

**Conséquences** :
- Tous les internal links doivent passer par le helper `useLocale()` ou `<Link locale="fr">` pour éviter de perdre la locale au click
- Sitemap doit lister `/fr/`, `/ar/`, `/en/` pour chaque page
- 301 redirect `/` → `/fr/` (ou langue détectée)

---

## ADR-003 — Default locale fallback

**Statut** : 🟡 À décider

**Contexte** : Quelle locale servir si rien n'est détecté ?

**Options** :
- A. **`fr` (français standard)** — fallback global, voix FemiGlow
- B. **`fr-MA` (français Maroc)** — précis géographiquement
- C. **`x-default` (langue détectée navigateur)** — flexible

**Recommandation** : **A. `fr`** comme default lang, **A. `fr-MA`** comme locale par défaut pour `Intl.NumberFormat` (devise MAD), **détection navigateur** activée au first-visit avec cookie persistant.

**Pseudo-code** :

```ts
function resolveLocale(req: Request): Locale {
  // 1. Path /:locale/ → use that
  // 2. Cookie NEXT_LOCALE → use
  // 3. Accept-Language header → match
  // 4. Default → 'fr'
  return 'fr';
}
```

---

## ADR-004 — Storage des messages (où sont les strings ?)

**Statut** : 🟡 À décider

**Options** :

| Option | Exemple | Pros | Cons |
|---|---|---|---|
| **A. JSON files dans repo** | `messages/fr.json` + `messages/ar.json` | ✅ Git history, PR review, simple | ❌ Redéploy pour update |
| **B. DB (PostgreSQL)** | Table `translation` avec key+locale+value | ✅ Update sans redéploy, admin UI | ❌ Latence query, cache invalidation |
| **C. CDN (Crowdin Over-The-Air)** | Lokalise OTA, etc. | ✅ Hot reload | ❌ Coût, dépendance externe |
| **D. Hybride DB + cache + JSON fallback** | DB pour dynamic, JSON pour critical paths | ✅ Best of both | ❌ Complexité |

**Recommandation** :
- **A. JSON files** pour 90% (UI components, copy marketing) — version git, review PR.
- **B. DB** pour le contenu CMS dynamique (component_field_bindings.value déjà multilangue par locale).
- **Crowdin/Lokalise** optionnel comme TMS pour traducteurs externes (sync vers JSON via CLI).

**Justification** :
- Cohérent avec stack actuelle (CMS DB déjà multilangue ready)
- Performance maximale (JSON statique compilé dans le bundle)
- Coût zéro pour 1-3 langues
- Crowdin/Lokalise activable plus tard si volume traduction explose

---

## ADR-005 — RTL support (arabe)

**Statut** : 🟡 À décider

**Options** :

| Option | Pros | Cons |
|---|---|---|
| **A. `dir="rtl"` + Tailwind logical properties** | ✅ Natif, perf | Refactor classes (mr→me) |
| **B. `dir="rtl"` + plugin `tailwindcss-rtl`** | ✅ Auto-swap LTR ↔ RTL | Dépendance plugin |
| **C. CSS-in-JS + isRTL helper** | ✅ Programmatique | Bundle ↑ |
| **D. Skip RTL pour V1, faire LTR avec text RTL** | ✅ Rapide | UX médiocre AR |

**Recommandation** : **A. Logical properties Tailwind** (depuis Tailwind 3.0 c'est natif).

**Action** :
- Audit code Tailwind : remplacer `mr-2 ml-4` par `me-2 ms-4` (margin-end / margin-start)
- Configurer `<html dir>` dynamique
- Audit composants admin pour cas hard-coded (ex: positioning absolute)

---

## ADR-006 — Workflow translateur

**Statut** : 🟡 À décider

**Options** :

| Option | Pros | Cons | Coût/mois |
|---|---|---|---|
| **A. Crowdin** | TMS pro, glossaire, TM, screenshots | Apprentissage | 39$ start |
| **B. Lokalise** | API rich, GitHub sync | UX moins fluide | 120$ start |
| **C. Phrase / Transifex** | Mature | Coûteux | 50-150$ |
| **D. PR GitHub avec template** | Gratuit, Git workflow | ❌ Pas friendly non-tech | 0$ |
| **E. Admin UI maison** | Sur mesure | Build cost | 0$ |

**Recommandation** : **D. PRs GitHub avec PR template + Crowdin Free Plan si admin demande**.

**Justification** :
- Phase 1-2 : 1-3 langues = peu de strings → PR template + relecture (gratuit)
- Si > 3 langues + > 1000 strings → Crowdin Free (unlimited public repos)
- Lokalise/Phrase = overkill pour scope V1

---

## ADR-007 — Pluralization library

**Statut** : 🟡 À décider

**Options** :
- A. **`Intl.PluralRules` natif** — gratuit, complet, supporte ICU implicitement
- B. **ICU MessageFormat via `messageformat-js`** — bibliothèque pour parser ICU plurals
- C. **Maison via switch case** — manuel

**Recommandation** : **A. Intl.PluralRules** (déjà disponible nav modernes).

```ts
const rules = new Intl.PluralRules('ar');
rules.select(2);  // → 'two'
rules.select(11); // → 'few' (arabe a 6 cas plurals !)
```

Combinée avec `next-intl` qui supporte ICU MessageFormat nativement.

---

## ADR-008 — Locale active pour l'admin

**Statut** : 🟢 Décidé

**Décision** : **Admin console reste 100% FR** (out of scope). On localise UNIQUEMENT le frontend public.

**Justification** :
- Fondatrice + équipe admin = bilingue FR/AR mais préfèrent FR pour outil admin
- Coût/valeur faible (~500 strings admin)
- Évite over-engineering

---

## ADR-009 — Migration progressive ou big-bang ?

**Statut** : 🟡 À décider

**Options** :

| Option | Pros | Cons |
|---|---|---|
| **A. Big-bang** : tout traduit en 1 release | ✅ Cohérent | ❌ Risque élevé, blocage long |
| **B. Progressive par route** | ✅ Faible risque, learnings au fur et à mesure | Vie temporaire avec mix FR/i18n |
| **C. Feature flag** : `I18N_ENABLED=true` toggle global | ✅ Rollback safe | Code à double maintenu un temps |

**Recommandation** : **B. Progressive par route** avec feature flag `I18N_ENABLED=true` (Option C combinée).

**Ordre suggéré** :
1. `/kit` (page commerciale critique) — déjà partiellement i18n via wizard
2. `/maison` + `/rituel` (pages contenu)
3. `/contact` + `/journal` (utilitaires)
4. `/legal/*` (templating)
5. Emails transactionnels

---

## ADR-010 — Tests strategy i18n

**Statut** : 🟡 À décider

**Niveaux** :

| Niveau | Outils | Coverage |
|---|---|---|
| **Unit** | Vitest | Helpers + dictionary integrity |
| **Integration** | Vitest + MSW | Locale detection, switcher |
| **E2E** | Playwright | User flows par locale |
| **Visual** | Playwright snapshots ou Chromatic | RTL + truncation |
| **A11y** | axe-playwright | Screen reader RTL |
| **Performance** | Lighthouse CI | Bundle size per locale |
| **Translation completeness** | Script CI | % keys traduites par locale |

**Recommandation** : **Tous les niveaux** (le scope demande robustesse).

→ Cf. [`../07-tests/`](../07-tests/) pour détail.

---

## Récap décisions

| ADR | Décision provisoire | Statut |
|---|---|---|
| 001 | `next-intl` | 🟡 À valider |
| 002 | Path-based `/[locale]/` | 🟡 À valider |
| 003 | Default `fr` + détection navigateur | 🟡 À valider |
| 004 | JSON files + DB pour CMS dynamique | 🟡 À valider |
| 005 | Tailwind logical properties + `dir="rtl"` | 🟡 À valider |
| 006 | PR GitHub workflow (+ Crowdin Free si besoin) | 🟡 À valider |
| 007 | `Intl.PluralRules` natif | 🟢 Évident |
| 008 | Admin reste FR | 🟢 Décidé |
| 009 | Progressive par route + feature flag | 🟡 À valider |
| 010 | Tests tous niveaux (vitest+MSW+Playwright+a11y+visual+perf) | 🟡 À valider |

→ Une réunion fondatrice + lead technique pour valider les 🟡.
