# Form handling

## Pile

| Couche | Outil |
|---|---|
| Schéma | Zod (existant côté repo) |
| State formulaire | react-hook-form 7 |
| Resolver | `@hookform/resolvers/zod` |
| Wrapper UI | `<Field>` (existant `forms/Field.tsx`) |

## Pattern type

```tsx
// apps/web/src/components/admin/login/LoginForm.tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/forms/Field';
import { adminLoginSchema, type AdminLoginInput } from '@/lib/schemas/admin-auth';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/admin/dashboard';

  const form = useForm<AdminLoginInput>({
    resolver: zodResolver(adminLoginSchema),
    mode: 'onBlur',
  });

  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(values: AdminLoginInput) {
    setServerError(null);
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      router.push(next);
      return;
    }
    if (res.status === 429) {
      setServerError('Trop de tentatives. Réessayez dans quelques minutes.');
      return;
    }
    setServerError('Identifiants incorrects.');
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Field label="Adresse e-mail" error={form.formState.errors.email?.message}>
        <input
          type="email"
          autoComplete="username"
          {...form.register('email')}
        />
      </Field>
      <Field label="Mot de passe" error={form.formState.errors.password?.message}>
        <input
          type="password"
          autoComplete="current-password"
          {...form.register('password')}
        />
      </Field>
      {serverError && <p role="alert" className="text-sm text-[#A33A3A]">{serverError}</p>}
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Connexion…' : 'Se connecter'}
      </Button>
    </form>
  );
}
```

## Règles de validation

1. **Toujours côté client ET côté serveur** — Zod schémas partagés
   entre route handler et form.
2. **Mode `onBlur`** par défaut (validation au quit du champ).
3. **Mode `onChange` après première tentative invalide** (UX itérative).
4. **Pas de validation submit-only** sauf cas exceptionnels.

## Auto-complétion

| Champ | autoComplete |
|---|---|
| Email login | `username` |
| Mot de passe login | `current-password` |
| Nom (lead) | `name` |
| Email (lead) | `email` |
| Téléphone (lead) | `tel` |
| Nouveau secret webhook | `off` (généré, jamais saisi) |

## Erreurs serveur

| Code HTTP | Message UI |
|---|---|
| 400 (validation) | inline sous le champ concerné (issues Zod) |
| 401 (session expirée) | toast "Session expirée." + redirect login |
| 403 (interdit) | toast "Action non autorisée." |
| 409 (conflit) | inline "Cette ressource existe déjà." |
| 429 (rate limit) | inline "Trop de tentatives." |
| 500 / 503 | toast "Une erreur est survenue. Réessayez." |
| timeout (network) | toast "La connexion semble interrompue." |

## Champs spéciaux

### Génération de secret webhook

```tsx
'use client';
function WebhookSecretInput() {
  const [secret, setSecret] = useState('');
  const [revealed, setRevealed] = useState(false);

  async function generate() {
    // Côté serveur via /api/admin/webhooks?action=generate-secret
    // OU côté client via crypto.getRandomValues + base64
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    setSecret(btoa(String.fromCharCode(...bytes)));
    setRevealed(true);
  }

  // ... input avec type=text/password selon revealed, bouton Copier
}
```

### Filtre webhook (jsonb)

UI builder visuel (cf. wireframe webhook form). Sortie sérialisée :

```json
{ "type": ["order"] }       // tous les types order
{ "type": ["order", "contact"] }  // order ou contact
{}                           // tous les leads
```

## Tests formulaires

Chaque formulaire a au minimum :

1. Test unitaire RTL : remplit valide → submit → assert fetch appelé.
2. Test unitaire RTL : remplit invalide → assert message d'erreur.
3. Scénario MSW : succès, 400, 500, network error.
4. Test a11y `jest-axe`.
5. E2E Playwright : formulaire critique (login, création webhook).
