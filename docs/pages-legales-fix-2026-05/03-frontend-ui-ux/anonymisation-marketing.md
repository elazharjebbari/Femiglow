# Anonymisation prénom fondatrice — diffs précis

## Inventaire

`grep -ri "souheila|souheïla" apps/web/src/` retourne 9 occurrences dans 6 fichiers :

| Fichier | Occurrences | Public ? |
|---|---|---|
| `(marketing)/maison/page.tsx` | 1 | ✅ Oui (meta description) |
| `(marketing)/contact/page.tsx` | 2 | ✅ Oui (FAQ items) |
| `(marketing)/kit/page.tsx` | 1 | ✅ Oui (meta description) |
| `(marketing)/rituel/page.tsx` | 1 | ✅ Oui (meta description) |
| `api/rituals/policy/route.ts` | 1 | ✅ Oui (réponse API publique) |
| `admin/rituals/best-practices/page.tsx` | 3 | ❌ Admin interne |

→ **Scope sprint** : 6 fichiers, 6 occurrences (admin interne laissé selon ADR-008).

## Diffs précis

### 1. `apps/web/src/app/(marketing)/maison/page.tsx`

```diff
   description:
-    'FemiGlow, maison de soin pour les ongles éditée à Rabat par Souheila, biologiste et formulatrice. L’origine, l’atelier au 25 bis avenue Patrice Lumumba, les matières, les engagements halal et locaux.',
+    'FemiGlow, maison de soin pour les ongles éditée à Rabat par notre fondatrice, biologiste et formulatrice. L’origine, l’atelier au 25 bis avenue Patrice Lumumba, les matières, les engagements halal et locaux.',
```

### 2. `apps/web/src/app/(marketing)/contact/page.tsx`

```diff
   {
-    id: 'formation-souheila',
-    question: 'Comment suivre une formation avec Souheila ?',
+    id: 'formation-fondatrice',
+    question: 'Comment suivre une formation avec notre équipe ?',
     answer:
-      'Souheila anime des formations à la manucure japonaise et à la fabrication cosmétique dans l’atelier de Rabat. Écrivez à info@femiglow-maroc.com en précisant votre profil (esthéticienne, formulatrice, école). Nous répondons sous trois jours.',
+      'Notre fondatrice anime des formations à la manucure japonaise et à la fabrication cosmétique dans l’atelier de Rabat. Écrivez à info@femiglow-maroc.com en précisant votre profil (esthéticienne, formulatrice, école). Nous répondons sous trois jours.',
   },
```

⚠️ Note : l'ID `formation-souheila` est aussi modifié → impact SEO si cette FAQ était linkée via ancre. À vérifier si `#formation-souheila` apparaît dans des liens internes (probablement non).

### 3. `apps/web/src/app/(marketing)/kit/page.tsx`

```diff
 'Pack FemiGlow — coffret de manucure japonaise en deux gestes. Paste verte sauge, powder rose poudré et polissoir Step 4 Polish & Shine. Pensé à Rabat par Souheila. Sans vernis, sans abrasion. Livraison offerte au Maroc.';
+'Pack FemiGlow — coffret de manucure japonaise en deux gestes. Paste verte sauge, powder rose poudré et polissoir Step 4 Polish & Shine. Pensé à Rabat par notre équipe. Sans vernis, sans abrasion. Livraison offerte au Maroc.';
```

### 4. `apps/web/src/app/(marketing)/rituel/page.tsx`

```diff
       description:
-        'Origine japonaise, sciences du soin, interview de Souheila à Rabat. Le rituel FemiGlow raconté sans précipitation.',
+        'Origine japonaise, sciences du soin, interview de notre fondatrice à Rabat. Le rituel FemiGlow raconté sans précipitation.',
```

### 5. `apps/web/src/app/api/rituals/policy/route.ts`

```diff
- Souheila · FemiGlow
+ L'équipe FemiGlow
```

### 6. `apps/web/src/app/admin/rituals/best-practices/page.tsx` — LAISSÉ

Page admin interne (cf. ADR-008). 3 occurrences inchangées dans ce sprint :
- `Public cible : Souheila + futures modératrices`
- `On peut aussi marquer manuellement après confirmation Souheila`
- `…faire valider Souheila + service juridique avant`

→ Si besoin d'anonymiser plus tard, sprint séparé.

## Vérification post-application

```bash
# Doit retourner 3 occurrences (toutes dans admin/rituals/best-practices/page.tsx)
grep -ri "souheila\|souheïla" apps/web/src/ 2>&1 | grep -v "admin/rituals" | head -10
```

Attendu : 0 résultat hors fichier admin.

## Test d'invariant

**Fichier nouveau** : `apps/web/src/app/(marketing)/__tests__/no-founder-name.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MARKETING_DIR = join(process.cwd(), 'src/app/(marketing)');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))
      out.push(p);
  }
  return out;
}

describe('marketing pages — anonymisation', () => {
  it('aucun nom propre fondatrice', () => {
    const files = walk(MARKETING_DIR);
    const violations: Array<{ file: string; line: number; content: string }> = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (/souhei[lï]a/i.test(lines[i]!)) {
          violations.push({ file, line: i + 1, content: lines[i]!.trim() });
        }
      }
    }
    if (violations.length > 0) {
      const detail = violations.map((v) => `${v.file}:${v.line}\n  ${v.content}`).join('\n\n');
      throw new Error(`\nNom fondatrice trouvé dans pages marketing :\n\n${detail}\n`);
    }
    expect(violations).toEqual([]);
  });
});
```

→ Empêche régression future si quelqu'un ajoute "Souheila" dans une page marketing.

## Sitemap/robots impact

`sitemap.xml` n'est pas affecté (URLs inchangées sauf #formation-souheila → #formation-fondatrice anchor, qui n'est probablement pas dans sitemap).

Aucun changement requis sur `robots.txt`.

## OG images / metadata

Vérifier que les `<meta property="og:description">` ne contiennent plus le prénom :

```bash
# Smoke local
curl -s http://localhost:3001/ | grep -i "souheila"
curl -s http://localhost:3001/contact | grep -i "souheila"
curl -s http://localhost:3001/maison | grep -i "souheila"
```

Attendu : 0 résultat.
