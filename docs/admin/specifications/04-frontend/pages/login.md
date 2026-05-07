# Page — `/admin/login`

| Aspect | Valeur |
|---|---|
| Type | Server Component (page) + Client Component (form) |
| Auth | publique |
| Layout | minimal (centré, pas de sidebar) |
| Breadcrumb | aucun |

## Wireframe

Voir [`../../03-ux-navigation/wireframes-textuels.md`](../../03-ux-navigation/wireframes-textuels.md#adminlogin).

## Comportement

1. Si l'utilisatrice est déjà authentifiée (cookie valide), redirect
   vers `next` ou `/admin/dashboard`.
2. Sinon, affiche le formulaire.
3. Submit → POST `/api/admin/login`.
4. Sur succès, redirect vers `next` ou `/admin/dashboard`.
5. Sur 401, message "Identifiants incorrects."
6. Sur 429, message "Trop de tentatives. Réessayez dans quelques minutes."

## Éléments

| Élément | Composant |
|---|---|
| Logo | `<Logo />` (existant, Pinyon Script) |
| Surtitre | "ESPACE ADMINISTRATION" en kicker |
| Champ email | `<Field label="Adresse e-mail">` + input type=email autoComplete=username |
| Champ mot de passe | `<Field label="Mot de passe">` + input type=password autoComplete=current-password |
| Bouton submit | `<Button type="submit">` libellé "Se connecter" |
| Erreur globale | `<p role="alert">` sous bouton si auth échoue |

## Schéma Zod

```ts
// apps/web/src/lib/schemas/admin-auth.ts
import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().email('Adresse e-mail invalide.'),
  password: z.string().min(8, 'Mot de passe trop court.'),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
```

## Accessibilité

- `<form noValidate>` (validation côté JS).
- Chaque input lié au label via `htmlFor`/`id` (`Field` le fait).
- Erreurs annoncées via `aria-describedby`.
- Focus initial sur le champ email au load.
- Pressing Enter dans n'importe quel champ submit le formulaire.

## Tests

| Type | Fichier |
|---|---|
| Unit (Vitest+RTL) | `LoginForm.test.tsx` — valide, invalide, soumis, en cours |
| MSW | `scenario-login-success.md`, `scenario-login-failure.md`, `scenario-login-rate-limit.md` |
| a11y | `jest-axe` sur LoginForm |
| E2E | `e2e/login.spec.ts` |

## SEO / metadata

```tsx
export const metadata = {
  title: 'Connexion · FemiGlow',
  robots: { index: false, follow: false },
};
```
