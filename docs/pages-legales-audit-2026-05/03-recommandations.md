# Recommandations — fix module pages légales

> **Objectif** : déboquer la publication des 3 drafts (CGU, retours-remboursements, sécurité-produits), nettoyer les pages orphelines, anonymiser les infos sensibles, anonymiser le prénom de la fondatrice.
> **Contrainte** : aucune régression sur les 6 pages publiées (cgv, faq, mentions-legales, cookies, confidentialite, livraison).

## 1. Stratégie en 3 niveaux

| Niveau | Effort | Risque | Délai | Objet |
|---|---|---|---|---|
| **N1 — Quick fixes (drift + nettoyage)** | 0.5 j-h | Faible | 1 jour | Migration data renommant les vars + cleanup orphelins + anonymisation prénom marketing |
| **N2 — Refonte templates anonymisés** | 1.0 j-h | Moyen | 2 jours | Remplacer `{{ICE}}`, `{{COMPANY_ADDRESS}}`, etc. par blocs "info sur demande email" + revue juriste |
| **N3 — UI variables managé + script seed sync** | 1.5 j-h | Moyen | 3 jours | Permettre add/edit vars depuis admin, synchroniser seed avec DB, presets élargis (VERSION, etc.) |

## 2. N1 — Quick fixes (priorité immédiate)

### 2.1 Migration SQL : renommer les vars DB pour matcher les templates

**But** : aligner les `key` de `legal_template_vars` avec les noms utilisés dans `body_md`.

```sql
-- Migration 0075_legal_vars_rename.sql

-- 1. Renommer les vars qui ont un drift
UPDATE legal_template_vars SET key = 'CONTACT_EMAIL' WHERE key = 'COMPANY_EMAIL';
UPDATE legal_template_vars SET key = 'CONTACT_PHONE' WHERE key = 'COMPANY_PHONE';
UPDATE legal_template_vars SET key = 'HOST_ADDRESS' WHERE key = 'HOSTING_ADDRESS';
UPDATE legal_template_vars SET key = 'HOST_NAME' WHERE key = 'HOSTING_NAME';
UPDATE legal_template_vars SET key = 'HOST_CONTACT' WHERE key = 'HOSTING_PHONE';
UPDATE legal_template_vars SET key = 'CNDP_DECLARATION_REF' WHERE key = 'CNDP_DECLARATION';

-- 2. Ajouter les 7 vars manquantes
INSERT INTO legal_template_vars (key, label, description, value, is_required, sort_order)
VALUES
  ('COOLING_OFF_DAYS', 'Délai rétractation (jours)', 'Loi marocaine — par défaut 7', '7', false, 100),
  ('CURRENCY', 'Devise', 'Code ISO devise', 'MAD', false, 101),
  ('DATA_RETENTION_YEARS', 'Rétention données (années)', 'CNDP — durée conservation', '3', false, 102),
  ('DELIVERY_PARTNER', 'Partenaire livraison', 'Nom du transporteur', '', true, 103),
  ('PAYMENT_PROVIDERS', 'Prestataires paiement', 'CMI, Inwi Money, …', 'CMI', false, 104),
  ('SUPPORT_HOURS', 'Horaires support', 'Format libre', 'Lun-Ven 9h-18h', false, 105),
  ('VERSION', 'Version page (preset)', 'Auto-rempli depuis legal_pages.version', '', false, 106)
ON CONFLICT (key) DO NOTHING;

-- 3. Supprimer les vars jamais utilisées (optionnel — préférer is_required=false)
UPDATE legal_template_vars SET is_required = false
WHERE key IN ('COMPANY_PATENTE', 'COMPANY_TVA', 'DPO_EMAIL');
```

**Impact** : après cette migration, les 3 drafts deviennent publiables (les vars sont définies en DB) sauf si certaines sont vraiment vides.

### 2.2 Cleanup pages test E2E orphelines

```sql
-- Suppression sécurisée (status=draft + slug LIKE 'e2e-test-%' + créées il y a >7j)
DELETE FROM legal_pages
WHERE slug LIKE 'e2e-test-%'
  AND status = 'draft'
  AND created_at < NOW() - INTERVAL '7 days';
```

**Préventif** : ajouter un `afterAll` dans le test Playwright incriminé :

```ts
// e2e/admin-legal.spec.ts (à identifier via grep)
test.afterAll(async ({ request }) => {
  await request.delete(`/api/admin/legal/${createdSlug}`);
});
```

### 2.3 Anonymisation du prénom dans code marketing

**9 occurrences à remplacer** — diff suggéré :

```diff
# src/app/(marketing)/maison/page.tsx
- 'FemiGlow, maison de soin pour les ongles éditée à Rabat par Souheila, biologiste et formulatrice. …'
+ 'FemiGlow, maison de soin pour les ongles éditée à Rabat par notre fondatrice, biologiste et formulatrice. …'

# src/app/(marketing)/contact/page.tsx
- question: 'Comment suivre une formation avec Souheila ?',
+ question: 'Comment suivre une formation avec notre équipe ?',
- 'Souheila anime des formations à la manucure japonaise …'
+ 'Notre fondatrice anime des formations à la manucure japonaise …'

# src/app/(marketing)/kit/page.tsx
- '… Pensé à Rabat par Souheila. …'
+ '… Pensé à Rabat par notre équipe. …'

# src/app/(marketing)/rituel/page.tsx
- '… interview de Souheila à Rabat. …'
+ '… interview de notre fondatrice à Rabat. …'

# src/app/api/rituals/policy/route.ts
- Souheila · FemiGlow
+ L'équipe FemiGlow

# src/app/admin/rituals/best-practices/page.tsx — 3 occurrences (admin interne)
# Garder ou anonymiser selon préférence — c'est de la doc interne admin
```

### 2.4 Vérifier l'éditeur template-vars

`/admin/legal/template-vars` doit permettre :
1. Lister toutes les vars (déjà fait — 17 lignes visibles)
2. Saisir une valeur (déjà fait — input + bouton Save)
3. **Ajouter de nouvelles clés** — à vérifier (si non implémenté, blocker)
4. Marquer `is_required` toggle — à vérifier

Si l'ajout n'est pas possible, ajouter un bouton "+ Nouvelle variable" sur cette page.

### N1 — Acceptance criteria

- [ ] Migration 0075 appliquée local + staging + prod
- [ ] 5 pages test E2E supprimées
- [ ] Test Playwright fautif corrigé (cleanup hook)
- [ ] 9 occurrences `Souheila` remplacées dans code marketing
- [ ] Les 3 drafts (CGU, retours, sécurité) peuvent être publiés sans erreur "missing_required_vars"
- [ ] Aucune régression sur les 6 pages publiées (smoke `/legal/<slug>`)

---

## 3. N2 — Refonte templates anonymisés (priorité haute)

### 3.1 Stratégie d'anonymisation

**Variables à anonymiser** dans les body_md des pages publiées et templates seed :

| Variable | Action |
|---|---|
| `{{ICE}}` | Remplacer par : *"ICE disponible sur demande à legal@femiglow-maroc.com"* |
| `{{COMPANY_RC}}` | Remplacer par : *"RC disponible sur demande"* |
| `{{COMPANY_ADDRESS}}` | Remplacer par : *"Adresse siège disponible sur demande à legal@femiglow-maroc.com"* |
| `{{COMPANY_FORM}}` | Remplacer par : *"Forme juridique disponible sur demande"* |
| `{{COMPANY_CAPITAL}}` | Remplacer par : *"Capital disponible sur demande"* |
| `{{DIRECTOR_NAME}}` | Remplacer par : *"L'équipe éditoriale FemiGlow"* |
| `{{HOST_NAME}}` `{{HOST_ADDRESS}}` `{{HOST_CONTACT}}` | Garder (obligation transparence hébergement) |
| `{{CNDP_DECLARATION_REF}}` | Garder (numéro légalement requis si DPO) |

### 3.2 Refonte mentions-legales (exemple)

**Avant** :
```md
## Identité de l'éditeur

FemiGlow ({{COMPANY_NAME}})
Forme juridique : {{COMPANY_FORM}}
RC : {{COMPANY_RC}}
ICE : {{ICE}}
Capital : {{COMPANY_CAPITAL}}
Siège : {{COMPANY_ADDRESS}}
Directeur de la publication : {{DIRECTOR_NAME}}
```

**Après** :
```md
## Identité de l'éditeur

FemiGlow est une marque éditée par une entreprise immatriculée au Maroc.

Pour toute demande relative à notre identité juridique complète
(RC, ICE, forme juridique, capital, adresse de siège), merci de
nous contacter par email à **legal@femiglow-maroc.com**.

Directeur de la publication : l'équipe éditoriale FemiGlow.

> Conformément au droit marocain (Loi 04-99 + Code de Commerce),
> ces informations sont fournies sur demande motivée sous 5 jours
> ouvrés.
```

### 3.3 Validation juridique

**À VALIDER PAR UN JURISTE MAROCAIN** avant déploiement :

- ☐ La présentation "infos sur demande email" est-elle juridiquement suffisante au Maroc pour une e-commerce ?
- ☐ Quelles mentions DOIVENT rester publiquement visibles ? (probablement : SIRET équivalent, DPO contact, hébergeur)
- ☐ Faut-il un délai légal de réponse à la demande "legal@" ?
- ☐ Conformité GDPR / CNDP : la rétention email + traitement de la demande nécessite-elle un avis CNDP ?

**Risque** : si la loi exige ICE/RC en clair, on doit garder ces vars visibles → solution alternative : créer une page `/legal/contact-juridique` séparée et y déplacer ces données.

### 3.4 Mise à jour du seed source

**Fichier** : `docs/legal-pages/60-content/*.md`

Les templates sources doivent être mis à jour avec les nouvelles versions anonymisées, sinon un `seed défauts` réintroduira les vars sensibles.

```bash
# Identifier les fichiers source
ls docs/legal-pages/60-content/
# mentions-legales.md, cgv.md, confidentialite.md, etc.
```

Pour chaque fichier : remplacer les `{{ICE}}`, `{{COMPANY_RC}}`, etc. par les blocs "info sur demande".

### 3.5 Republier les pages

```sql
-- Lister les pages à republier après update
SELECT slug, status FROM legal_pages WHERE status = 'published';
```

Pour chaque page publiée :
1. Admin → Éditer
2. Sauver (status passe en `review` ou `draft`)
3. Tester `/legal/<slug>` en preview
4. Publier (`status='published'`)

### N2 — Acceptance criteria

- [ ] Juriste a validé l'approche "info sur demande email"
- [ ] Email `legal@femiglow-maroc.com` créé + monitoring boîte
- [ ] 4 pages templates mises à jour (mentions-legales, cgv, confidentialite, retours-remboursements)
- [ ] Fichiers source `docs/legal-pages/60-content/*.md` synchronisés
- [ ] 6 pages publiées republiées avec nouvelle version
- [ ] Smoke `/legal/mentions-legales` : ICE et RC ne sont plus visibles en clair
- [ ] Tests Playwright vérifient l'absence des vars sensibles dans le HTML rendu

---

## 4. N3 — UI variables + presets (priorité moyenne)

### 4.1 Ajouter VERSION en preset auto

**Fichier** : `src/lib/legal/vars.ts`

```diff
 export function presetVars(now: Date = new Date()): Map<string, string> {
   const m = new Map<string, string>();
   m.set('LAST_UPDATED', formatFrenchDate(now));
   m.set('CURRENT_YEAR', String(now.getFullYear()));
   m.set('SITE_URL', env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, ''));
   return m;
 }
+
+export function presetVarsForPage(
+  page: { version: number; updatedAt: Date },
+  now: Date = new Date(),
+): Map<string, string> {
+  const m = presetVars(now);
+  m.set('VERSION', `v${page.version}`);
+  m.set('LAST_UPDATED', formatFrenchDate(page.updatedAt));
+  return m;
+}
```

Et l'utiliser dans `repository.ts` / `render.ts` quand on substitue les vars d'une page spécifique.

### 4.2 UI : ajouter une variable depuis admin

**Page** : `/admin/legal/template-vars`

Ajouter en tête de page un formulaire :

```tsx
<form action="/api/admin/legal/template-vars/create" method="POST">
  <input name="key" placeholder="KEY_NAME" pattern="[A-Z][A-Z0-9_]*" required />
  <input name="label" placeholder="Label affiché" required />
  <input name="description" placeholder="Description / aide" />
  <input name="defaultValue" placeholder="Valeur par défaut" />
  <label>
    <input type="checkbox" name="isRequired" /> Requis
  </label>
  <button type="submit">+ Ajouter</button>
</form>
```

### 4.3 UI : suggestions auto pour vars manquantes

Quand `detectMissingVars` détecte une var inconnue dans un template, proposer un CTA "Créer cette variable" plutôt que d'afficher juste "manquante".

### 4.4 Cron de cleanup automatique

Job hebdo qui supprime les pages `e2e-test-*` âgées de plus de 7 jours :

```ts
// src/app/api/cron/legal/cleanup-e2e/route.ts (nouveau)
export async function GET() {
  const result = await db().delete(legalPages)
    .where(and(
      like(legalPages.slug, 'e2e-test-%'),
      eq(legalPages.status, 'draft'),
      lt(legalPages.createdAt, sql`NOW() - INTERVAL '7 days'`),
    ))
    .returning({ slug: legalPages.slug });
  return Response.json({ deleted: result.length, slugs: result.map(r => r.slug) });
}
```

Ajouter dans `vercel.json` :

```json
{
  "crons": [
    {
      "path": "/api/cron/legal/cleanup-e2e",
      "schedule": "0 3 * * 1"
    }
  ]
}
```

### N3 — Acceptance criteria

- [ ] `VERSION` rendu automatiquement depuis `legal_pages.version`
- [ ] UI ajout/édition complète des variables depuis admin
- [ ] Cron weekly cleanup des e2e-test orphelins opérationnel
- [ ] Test Playwright valide le flow create-var → use-in-template → publish

---

## 5. Plan d'action complet sur 1 semaine

| Jour | Phase | Owner | Livrable |
|---|---|---|---|
| J+0 | Réunion juriste sur N2 | Lead + juriste | Validation approche "info sur demande" |
| J+1 | N1.1 — Migration 0075 (rename vars) | Dev | SQL + tests |
| J+1 | N1.2 — Cleanup E2E orphelins | Dev | SQL + script Playwright |
| J+1 | N1.3 — Anonymisation prénom code marketing | Dev | Diff 9 fichiers |
| J+2 | N2.1 — Refonte templates (4 pages) | Dev + Lead | Markdown updates |
| J+2 | N2.2 — Sync fichiers seed source | Dev | docs/legal-pages/60-content/ |
| J+3 | N3.1 — VERSION preset + UI create var | Dev | Code + tests vitest |
| J+3 | N3.2 — Cron cleanup auto | Dev | Vercel cron + handler |
| J+4 | Tests E2E `@legal-purity` (5 scenarios) | Dev | Playwright specs |
| J+4 | Republier les 6 pages avec nouvelles versions | Lead | Admin manuel + smoke |
| J+5 | Deploy staging + observation | DevOps | Smoke + manual checks |
| J+6 | Deploy prod + monitoring 48h | DevOps + Lead | Live |

**Effort total** : **3 j-h dev** + 0.5 j-h Lead + 1h juriste.

## 6. Tests à ajouter

### 6.1 Vitest unit

- `vars.test.ts` : nouvelle suite "presetVarsForPage" — vérifie que VERSION + LAST_UPDATED sont remplis automatiquement
- `publish.test.ts` : test "publish ok si toutes les vars utilisées sont définies (mêmes optionnelles vides)"
- `migration-rename.test.ts` : valider que la migration ne perd aucune valeur

### 6.2 Playwright

```ts
test.describe('@legal-purity', () => {
  test('mentions-legales rendu publique masque ICE et RC', async ({ page }) => {
    await page.goto('/legal/mentions-legales');
    const html = await page.content();
    // Aucune chaîne ICE de 15 chiffres
    expect(html).not.toMatch(/\b\d{15}\b/);
    // Aucune chaîne RC type "Casablanca-123456"
    expect(html).not.toMatch(/RC\s*:\s*\w+-?\d{5,}/);
    // Contient bien le contact email
    expect(html).toContain('legal@femiglow-maroc.com');
  });

  test('publish CGU draft sans drift vars', async ({ page, request }) => {
    // Login admin, naviguer édit CGU, cliquer publier → 200
  });

  test('création nouvelle variable depuis admin', async ({ page }) => {
    // /admin/legal/template-vars → +Nouvelle → vérifier apparition
  });
});
```

### 6.3 Smoke staging

```ts
// scripts/smoke-legal.ts
// 1. GET /legal/mentions-legales → 200, no ICE, no RC
// 2. GET /legal/cgv → 200, no DIRECTOR_NAME en clair
// 3. GET /legal/cgu → 200 (publié post-fix)
// 4. GET /admin/legal/template-vars (sans auth) → 307 redirect login
```

## 7. Risques résiduels

| # | Risque | Probabilité | Mitigation |
|---|---|---|---|
| R1 | Migration rename casse une referrence non détectée | Moyenne | Tester avec un dump complet avant prod |
| R2 | Juriste rejette l'approche "info sur demande" | Faible | Plan B : page dédiée `/legal/contact-juridique` |
| R3 | Page `cgu` republiée perd du contenu | Faible | Diff version courante vs nouvelle avant publish |
| R4 | Cron cleanup supprime une vraie page E2E utile | Très faible | Soft delete via `status='archived'` plutôt que DELETE direct |
| R5 | Le prénom apparaît ailleurs (asset, og:image alt) | Faible | Grep large incluant `public/`, alt-texts, metadata builders |

## 8. Mesure du succès post-fix

- ✅ Aucune page draft bloquée par "missing_required_vars"
- ✅ `/legal/mentions-legales` HTML ne contient ni ICE, ni RC, ni adresse en clair
- ✅ `grep -ri "souheila" src/` retourne 0 résultat (sauf docs internes opt-in)
- ✅ `/admin/legal` affiche 9 pages métier (sans les 5 orphelins)
- ✅ Fondatrice peut publier une page en cliquant simplement "Publier" sans erreur
