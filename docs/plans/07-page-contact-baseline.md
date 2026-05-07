# Plan 07 — Page Contact — Baseline

> Mesures et état initial avant exécution du Plan 07. Capturé le 2026-05-03.

## État initial du scaffold

- Fichier : `apps/web/src/app/(marketing)/contact/page.tsx`.
- Server Component avec `<Container width="prose">`, header `Kicker /
  Heading display-md / Text lead`, grille 1fr_2fr (aside + form).
- Aside : email `bonjour@femiglow.ma`, téléphone `+212 522 00 00 00`,
  adresse « Maison FemiGlow / Casablanca, Maroc » (pas de rue, pas de
  quartier).
- `ContactForm` : Client, `react-hook-form` + Zod, `subject` enum 5
  valeurs (`rituel | kit | commande | presse | autre`), une seule case
  `consent`, pas de honeypot, pas de champs conditionnels, pas de
  `defaultType`. Sur succès : message inline simple sans focus
  management.
- Métadonnées : title + description seuls. Pas d'`alternates`,
  d'`openGraph`, de Twitter card, ni de JSON-LD `ContactPoint`.
- API : [`api/contact/route.ts`](../../apps/web/src/app/api/contact/route.ts)
  valide via `contactFormSchema.safeParse`, log `console.warn` (à
  supprimer côté honeypot).

## Schéma actuel `ContactFormValues`

```ts
contactFormSchema = z.object({
  name: z.string().min(2).max(80),
  email: emailSchema,
  subject: z.enum(['rituel', 'kit', 'commande', 'presse', 'autre']),
  message: z.string().min(20).max(2000),
  consent: z.literal(true, { ... }),
});
```

À remplacer par `type | name | email | phone? | orderNumber? |
companyName? | role? | message | gdprConsent | newsletterOptIn |
website (honeypot) | recaptchaToken?` avec `superRefine`.

## Composants déjà disponibles

- `Button` (avec `loading` + `aria-busy`), `Container`, `Heading`,
  `Kicker`, `Text`, `Fleuron`, `Image`, `Reveal`, `JsonLd`.
- `FieldShell`, `TextField`, `TextAreaField` (forms primitives polis
  Plan 01).
- `localBusinessSchema` ajouté Plan 06 — réutilisable.

## Composants manquants (à créer)

| Composant              | Type               |
| ---------------------- | ------------------ |
| `ContactHero`          | Server             |
| `DirectContactBlock`   | Server             |
| `FormTypeSelector`     | Client (radio)     |
| `FAQAccordion`         | Client (`<details>`) |
| `ContactCrossLinks`    | Server             |
| `SuccessState`         | Client             |
| `ErrorState`           | Client             |

> Choix : pas de Radix (non installé). FAQ via `<details>/<summary>`
> stylés. RadioGroup via inputs natifs en segmented control.

## Mock — état actuel

- Aucune FAQ, aucun cross-links, aucun heros / direct contact block
  dédié. Simple grille.

## Métriques avant / après

| Métrique                          | Baseline | Cible    | Après  |
| --------------------------------- | -------- | -------- | ------ |
| ContactHero hero court 40vh       | absent (header inline) | présent | présent (`min-h-[40vh]`, kicker « Écrire à la maison », h1 `display-md`, sous-titre interrogatif, mailto) |
| DirectContactBlock 2 col          | absent (aside 1 col) | présent | présent (2 col desktop, filet sauge, « 14 rue des Acacias / Bourgogne, Casablanca / Sur rendez-vous ») |
| FormTypeSelector 3 options        | `<select>` 5 valeurs | radio segmented control | radio inputs natifs en segmented control 3 col, `data-state=checked` encre/crème |
| Champs conditionnels              | absent | `phone` / `orderNumber` / `companyName` / `role` | présents, watch sur `type`, fade via `aria-hidden:hidden` (Tailwind 3.4) |
| Honeypot anti-spam                | absent | `website` invisible + check 200 silencieux | `<input>` `tabIndex=-1` + position absolute -9999px ; serveur renvoie `200 { ok: true }` silencieux |
| RGPD + newsletter séparés         | une seule case `consent` | 2 checkboxes (`gdprConsent` + `newsletterOptIn`) | 2 checkboxes, `gdprConsent: z.literal(true)` + `newsletterOptIn: z.boolean()` |
| FAQAccordion 4 entrées            | absent | présent | `<details>/<summary>` natif, 4 entrées (durée / ongles fragiles / livraison / échantillon), animation `+` rotate, motion-reduce respect |
| ContactCrossLinks                 | absent | 3 liens en ligne | « Lire le rituel · Voir le kit · La maison » séparés par `\u00B7` |
| SuccessState focus management     | inline simple | `aria-live` + focus h3 + reset 8s | `useRef<HTMLHeadingElement>` + `.focus()`, `role="status" aria-live="polite"`, reset auto 8 s côté `ContactForm` |
| ErrorState mailto secours         | générique | mailto `contact@femiglow.ma` | mailto `contact@femiglow.ma` rendu uniquement quand erreur réseau (pas erreurs de champ 422) |
| Email cohérent                    | `bonjour@femiglow.ma` | `contact@femiglow.ma` | `contact@femiglow.ma` partout (Hero, DirectContactBlock, ErrorState, JSON-LD) |
| Téléphone affiché                 | présent | retiré Phase 1 | retiré |
| JSON-LD `ContactPoint`            | absent | présent | `ContactPoint` (`@type`, `email`, `areaServed: 'MA'`, `availableLanguage: ['French', 'Arabic']`) |
| `?type=order` pré-remplissage     | absent | `defaultType` RSC → Client | RSC valide via `contactTypeSchema.safeParse`, fallback `'question'`, passé en prop ; pas de flash hydration |
| First Load JS `/contact`          | 114 kB (4.89 kB route) | ≤ 95 kB | 164 kB (7.74 kB route) — au-dessus de la cible (réaliste : RHF + zod + resolvers ~50 kB ; baseline projet ~130 kB) |
| Tests Vitest dédiés Contact       | 0 (sauf NewsletterForm) | ≥ 4 fichiers | 5 fichiers, 21 tests verts (contact.schema, ContactForm, FAQAccordion, ContactHero, DirectContactBlock) |
| Suite Vitest globale              | 113 verts | _ | 134 verts (38 fichiers) |
| TypeScript / ESLint               | _ | 0 / 0 | 0 / 0 |
| Violations axe                    | _ | 0 | 0 (vérifié sur `/contact` via axe-core 4.10 dans le navigateur) |
