# Migration paths — basculer d'une option à une autre

Au cas où une décision serait revue plus tard, voici les paths de migration entre options.

## Path 1 — next-intl → paraglide-js

**Scénario** : on adopte next-intl V1, mais 12 mois plus tard paraglide est mature et on veut migrer pour gain bundle.

**Effort estimé** : 2-3 semaines

**Étapes** :
1. Installer `@inlang/paraglide-js` + `@inlang/paraglide-next`
2. Convertir `messages/*.json` au format paraglide (peu de diff, plain JSON)
3. Remplacer `useTranslations` par imports `* as m from '@/paraglide/messages'`
4. Remplacer middleware next-intl par paraglide middleware
5. Tests E2E pour valider non-régression
6. Suppression next-intl

**Risques** :
- Helpers `<Link locale>` paraglide différents
- `generateMetadata` syntaxe différente

**Compatible** : oui, JSON format proche.

---

## Path 2 — next-intl → next-i18next

**Scénario** : difficile à imaginer (régression), mais possible si Pages Router redevient strategy.

**Effort estimé** : 1-2 mois (downgrade complet stack Next)

**Recommandation** : **éviter**.

---

## Path 3 — Maison (WizardDictionary) → next-intl

**Scénario** : on étend l'architecture wizard à tout le site (pas recommandé selon recommendation.md).

**Effort estimé** : 4-6 semaines

**Compatible** : oui, on peut faire cohabiter les deux.

**Note** : la stratégie recommandée garde le WizardDictionary pour le wizard ET utilise next-intl pour le reste. Pas de migration nécessaire.

---

## Path 4 — JSON files → DB pour TOUS messages

**Scénario** : volume devient gigantesque (>10k messages), workflow Crowdin pas adapté.

**Effort estimé** : 2-3 semaines

**Étapes** :
1. Création table `translations` (key, locale, value, status)
2. Endpoint `GET /api/i18n/messages/[locale]` qui retourne le JSON
3. next-intl `getRequestConfig` chargé via fetch ce endpoint
4. Cache aggressive (Next `revalidate: 60`)
5. UI admin pour CRUD

**Risques** :
- Latence DB sur chaque page (mitigé par cache)
- Cache invalidation à gérer

**Compatible** : oui, transition douce (fallback JSON si DB down).

---

## Path 5 — Path-based → cookie-based

**Scénario** : SEO non critique, on simplifie URLs.

**Effort estimé** : 1 semaine

**Étapes** :
1. Désactiver `localePrefix` dans middleware next-intl
2. Faire passer locale via header request
3. Audit tous liens internes (plus de `/fr/` à insérer)
4. Garder `<link rel="alternate" hreflang>` malgré tout

**Risque** : ❌ perte SEO significative. **Non recommandé**.

---

## Path 6 — Path-based → subdomain

**Scénario** : besoin de géo-targeting Google Search Console séparé.

**Effort estimé** : 2-3 semaines

**Étapes** :
1. Acheter / configurer DNS (`ar.femiglow.ma`, `en.femiglow.ma`)
2. Certif SSL pour sous-domaines
3. Vercel project config (1 project ou 3 projects)
4. Middleware lit `Host` header pour extraire locale
5. Redirect `femiglow.ma` → `fr.femiglow.ma`
6. Update sitemap par subdomain
7. Update partage social (OG locale)

**Risques** :
- Cookies cross-subdomain (`.femiglow.ma` scope)
- Analytics fragmentés (Plausible/GA par subdomain)

**Compatible** : oui mais complexe.

---

## Path 7 — Ajout d'une nouvelle locale (process)

**Scénario** : ajouter ES (espagnol) à un système next-intl établi.

**Effort estimé** : 2-3 jours

**Étapes** :
1. Add `'es'` au tableau locales dans `i18n.ts`
2. Add `messages/es.json` (copie de en.json comme baseline)
3. Add `'es'` au middleware locales array
4. Traduire (manuel ou via Crowdin ou via AI + review)
5. UI: add ES dans le switcher
6. Test E2E ES locale
7. Sitemap auto inclut ES
8. Deploy

**Compatible** : ✅ trivial avec next-intl.

→ Cf. [`09-runbook/ajouter-nouvelle-langue.md`](../09-runbook/ajouter-nouvelle-langue.md) pour le runbook complet.

---

## Synthèse migration matrix

| Origin → Destination | Effort | Recommandation |
|---|---|---|
| next-intl → paraglide | 2-3 sem | ⚠️ Si vraiment besoin bundle |
| next-intl → next-i18next | 1-2 mois | ❌ Pas recommandé |
| Maison → next-intl | 4-6 sem | ✅ Si pas démarré encore (skip maison) |
| JSON → DB | 2-3 sem | ⚠️ Si volume > 10k |
| Path → cookie | 1 sem | ❌ Perte SEO |
| Path → subdomain | 2-3 sem | ⚠️ Si géo-targeting critique |
| Ajout nouvelle locale | 2-3 jours | ✅ Process bien défini |
