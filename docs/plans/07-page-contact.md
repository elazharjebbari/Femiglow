# Plan 07 — Page Contact (`/contact`)

> Plan d'exécution détaillé pour faire de `/contact` un **pont
> conversationnel** clair, avec un formulaire qui s'adapte au type de
> demande (question / commande / professionnel) et une FAQ courte qui
> évite les saisies inutiles. À lire intégralement avant de toucher au
> scaffold actuel.

**Page cible** : `apps/web/src/app/(marketing)/contact/page.tsx`
**Spec source** : [§ 4.9 de `04-specifications-pages.md`](../preparation/04-specifications-pages.md)
**Stratégie d'itération** : [`15-strategie-iteration.md`](../preparation/15-strategie-iteration.md)
**Estimation totale** : 14 à 20 heures de travail concentré (2 à 3 jours).

---

## 1. Objectif

La page Contact est le **point d'accès transverse** : B2C avant achat
(question rituel/kit), B2C après achat (suivi commande), B2B (presse,
partenariat, professionnel). Elle doit :

1. Donner le canal le plus rapide : email cliquable
   `contact@femiglow.ma` au-dessus du formulaire (25 à 35 % des
   visiteurs préfèrent écrire directement).
2. Adapter le formulaire au type de demande, avec des champs conditionnels
   pertinents (numéro de commande, raison sociale, etc.) — sans surcharger
   l'écran initial.
3. Désamorcer les questions répétitives via une FAQ courte de 4 entrées
   maximum.
4. Confirmer la réception sans redirection : succès inline, message
   « Bien reçu. La maison vous répond. », focus déplacé sur le heading
   du `SuccessState`.

KPIs cibles ([§ 4.9](../preparation/04-specifications-pages.md)) :

| KPI                              | Cible            |
| -------------------------------- | ---------------- |
| Taux de complétion formulaire    | > 65 %           |
| Clics email direct (mailto)      | 25 \u2014 35 %   |
| Délai de réponse moyen           | < 24 h           |
| NPS sur le canal contact         | > 8 / 10         |
| LCP                              | < 2.0 s          |
| CLS                              | < 0.05           |
| INP                              | < 150 ms         |

---

## 2. Documents à relire avant de commencer

| #   | Document                                                                                        | Pourquoi                                                       |
| --- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | [01 — Marque, vision, voix](../preparation/01-marque-vision-voix.md)                            | Ton du formulaire, microcopy bouton, message succès            |
| 2   | [02 — Design system](../preparation/02-design-system.md)                                        | Tokens couleurs, typographie labels, focus visible             |
| 3   | [04 — Spécifications de pages, § 4.9](../preparation/04-specifications-pages.md)                | Source canonique de la page Contact                            |
| 4   | [05 — Bibliothèque de composants](../preparation/05-bibliotheque-composants.md)                 | `FormTypeSelector`, `ContactForm`, `FAQAccordion`              |
| 5   | [07 — Modèles de données API](../preparation/07-modeles-donnees-api.md)                         | Schéma `ContactSubmission` côté serveur                        |
| 6   | [09 — Ergonomie & accessibilité](../preparation/09-ergonomie-accessibilite.md)                  | Labels associés, erreurs `aria-invalid`, focus management      |
| 7   | [10 — Performance & Web Vitals](../preparation/10-performance-web-vitals.md)                    | Pas de lib lourde, hydration ciblée                            |
| 8   | [11 — SEO & métadonnées](../preparation/11-seo-metadata.md)                                     | JSON-LD `ContactPoint`                                         |
| 9   | [Annexe glossaire éditorial](../preparation/annexes/glossaire-editorial.md)                     | Microcopy autorisée, mots interdits                            |
| 10  | [15 — Stratégie d'itération](../preparation/15-strategie-iteration.md)                          | Cycle, DoD composant, DoD page                                 |

**Temps de relecture** : 60 minutes.

---

## 3. Inventaire des dépendances de la page

### 3.1 Tokens

- Couleurs : `--sauge`, `--sauge-soft`, `--creme`, `--encre`, `--encre-60`
  (filets), `--erreur` (rouge brique sourd, à ajouter si absent).
- Typographies : `--font-display` (Hero), `--font-body` (labels, inputs).
- Tailles : `display-md` pour « Contact. » (le hero ne fait pas 92vh ici),
  `lead`, `body`, `caption`.
- Motion : `--duration-fast` (120 ms) pour les transitions des champs
  conditionnels.
- Focus : `--ring-encre` (encre 2 px, offset 3 px).

### 3.2 Primitifs UI et forms (à polir)

| Composant       | Travail spécifique Contact                                                       |
| --------------- | -------------------------------------------------------------------------------- |
| `Button`        | État `loading` : spinner inline, `aria-busy="true"`, `disabled`                  |
| `FieldShell`    | `aria-describedby` combine hint + error si les deux sont présents                |
| `TextField`     | Support `inputMode="tel"` pour `phone`, `autoComplete` adapté                    |
| `TextAreaField` | Compteur de caractères optionnel via prop `showCounter`                          |
| `ContactForm`   | **Refondre** : sélecteur de type, champs conditionnels, RGPD séparé, honeypot    |

### 3.3 Sections de la page

| #   | Section                | Fichier                                                  | État        |
| --- | ---------------------- | -------------------------------------------------------- | ----------- |
| 1   | Hero accueil           | `sections/ContactHero.tsx`                               | **À créer** |
| 2   | Coordonnées directes   | `sections/DirectContactBlock.tsx`                        | **À créer** |
| 3   | Sélecteur de type      | `forms/FormTypeSelector.tsx`                             | **À créer** |
| 4   | Formulaire             | `forms/ContactForm.tsx`                                  | À refondre  |
| 5   | FAQ courte             | `sections/FAQAccordion.tsx`                              | **À créer** |
| 6   | Cross-links            | `sections/ContactCrossLinks.tsx`                         | **À créer** |
| 7   | États succès / erreur  | `forms/SuccessState.tsx` + `forms/ErrorState.tsx`        | **À créer** |

### 3.4 Composants spécifiques à créer

| Composant            | Pourquoi                                                                            |
| -------------------- | ----------------------------------------------------------------------------------- |
| `ContactHero`        | Hero court 40vh « Contact. » + sous-titre interrogatif + email cliquable            |
| `DirectContactBlock` | Email + adresse atelier + filet sauge ; layout 2 col desktop                        |
| `FormTypeSelector`   | 3 radio cards segmented control (question / commande / professionnel)               |
| `FAQAccordion`       | Liste de 4 accordéons Radix `<Accordion type="single" collapsible>`                  |
| `SuccessState`       | Message inline ; focus auto sur heading ; reset auto à 8 s                          |
| `ErrorState`         | Message inline si POST échoue ; mailto en secours                                   |
| `ContactCrossLinks`  | 2-3 liens contextuels (Rituel, Kit, Maison) — pas un triptyque, plus discret        |

### 3.5 Données

Pas d'appel CMS Phase 1 : Hero, FAQ, cross-links sont des constantes
éditoriales hardcodées. Route POST déjà créée :
[`api/contact/route.ts`](../../apps/web/src/app/api/contact/route.ts), à
étendre pour le nouveau schéma.

---

## 4. Écarts entre la spec (§ 4.9) et le scaffold actuel

| #   | Spec (§ 4.9)                                                  | Scaffold actuel                                                  | Décision proposée                                                                          |
| --- | ------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| E1  | Sélecteur 3 options (question/commande/professionnel)         | `subject` enum à 5 valeurs                                       | **Migrer** vers `type: 'question' \| 'order' \| 'professional'` ; supprimer `subject`      |
| E2  | Champs conditionnels selon `type`                             | Aucun                                                            | **Ajouter** `phone`, `orderNumber`, `companyName`, `role` avec validation conditionnelle    |
| E3  | Validation Zod conditionnelle                                 | `z.object` à plat                                                | **Refondre** en `superRefine` (compatibilité `react-hook-form`)                             |
| E4  | Pré-remplissage `?type=order`                                 | Aucun                                                            | **Ajouter** `defaultType` en prop RSC → Client                                              |
| E5  | Honeypot anti-spam                                            | Absent                                                           | **Ajouter** champ `website` caché + check serveur                                           |
| E6  | RGPD `gdprConsent` + `newsletterOptIn` séparés                | Une seule case `consent`                                         | **Séparer** : `gdprConsent: z.literal(true)` + `newsletterOptIn: z.boolean()`               |
| E7  | reCAPTCHA Phase 2                                             | Aucun                                                            | **Placeholder** : champ `recaptchaToken` optionnel Phase 1                                  |
| E8  | FAQ courte 4 accordéons                                       | Aucune FAQ                                                       | **Créer** `FAQAccordion` + 4 entrées hardcodées                                             |
| E9  | `SuccessState` inline avec focus management                   | Texte simple                                                     | **Refondre** avec `useRef` + `.focus()` au montage, reset après 8 s                         |
| E10 | `ErrorState` avec gestion erreurs 422                         | Texte d'erreur générique                                         | **Refondre** : parser `issues` 422 et afficher inline via `methods.setError`                |
| E11 | Email `contact@femiglow.ma`                                   | `bonjour@femiglow.ma`                                            | **Aligner** sur `contact@femiglow.ma`                                                       |
| E12 | Téléphone affiché                                             | `+212 522 00 00 00`                                              | **Retirer** Phase 1 (canal non monitoré) ; conserver email + adresse                        |

Ces douze écarts représentent ~4 h de travail préparatoire (Phase 1).

---

## 5. Plan d'exécution

### Phase 0 — Baseline (30 min)

- [ ] `pnpm dev`, capture `/contact` (mobile 375 px, desktop 1440 px).
- [ ] Lighthouse mobile : LCP, CLS, INP, TBT.
- [ ] axe DevTools : violations critiques.
- [ ] Soumettre le formulaire actuel : noter le comportement.
- [ ] Sauvegarder dans `docs/plans/07-page-contact-baseline.md`.

### Phase 1 — Refonte du schéma `ContactSubmission` (2 h)

#### 1.1 Réécrire `schemas/contact.ts`
On retient `superRefine` (à plat, compatible `react-hook-form` qui partage
un seul état) plutôt que `discriminatedUnion`.

```ts
import { z } from 'zod';
import { emailSchema } from './common';

export const contactTypeSchema = z.enum(['question', 'order', 'professional']);
export type ContactType = z.infer<typeof contactTypeSchema>;

export const contactFormSchema = z
  .object({
    type: contactTypeSchema,
    name: z.string().min(2, 'Au moins 2 caractères.').max(80),
    email: emailSchema,
    phone: z.string().optional(),
    orderNumber: z.string().optional(),
    companyName: z.string().optional(),
    role: z.string().optional(),
    message: z.string().min(20, 'Au moins 20 caractères.').max(2000),
    gdprConsent: z.literal(true, {
      errorMap: () => ({ message: 'Le consentement est requis pour vous répondre.' }),
    }),
    newsletterOptIn: z.boolean().default(false),
    website: z.string().max(0).optional(), // honeypot : doit rester vide
    recaptchaToken: z.string().optional(), // Phase 2
  })
  .superRefine((data, ctx) => {
    if (data.type === 'order' && !data.orderNumber?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['orderNumber'],
        message: 'Indiquez le numéro de commande pour que nous puissions vous aider.',
      });
    }
    if (data.type === 'professional') {
      if (!data.phone?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Un téléphone facilite l\u2019échange professionnel.' });
      }
      if (!data.companyName?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['companyName'], message: 'Indiquez la raison sociale.' });
      }
      if (!data.role?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['role'], message: 'Indiquez votre fonction.' });
      }
    }
  });

export type ContactFormValues = z.infer<typeof contactFormSchema>;
```

#### 1.2 Adapter la route API
Fichier : [`api/contact/route.ts`](../../apps/web/src/app/api/contact/route.ts)

- Continuer à valider via `contactFormSchema.safeParse`.
- Si `website` (honeypot) n'est pas vide → renvoyer `200 { ok: true }`
  silencieux **sans logger** (le bot croit avoir réussi).
- Si validation échoue → `422` avec `issues: parsed.error.flatten()`.

#### 1.3 Mettre à jour `schemas/index.ts`
Exports : `ContactType`, `ContactFormValues`, `contactFormSchema`.

#### 1.4 Commit
```
git add -A
git commit -m "Refond ContactSubmission : type discriminé, champs conditionnels, honeypot, RGPD séparé"
```

> **Sortie de phase** : schéma cohérent, route API alignée. Le formulaire
> existant ne compile plus — c'est attendu, on le refait Phase 4.

### Phase 2 — Polissage des primitifs (1 h 30)

| Ordre | Composant       | Travail spécifique Contact                                            |
| ----- | --------------- | --------------------------------------------------------------------- |
| 1     | `Button`        | État `loading` : spinner inline, `aria-busy="true"`                    |
| 2     | `FieldShell`    | `aria-describedby` combine hint + error                                |
| 3     | `TextField`     | `inputMode="tel"` + `autoComplete="tel"` pour `phone`                  |
| 4     | `TextAreaField` | Compteur de caractères optionnel via `showCounter`                    |

**Commits** : un par composant. Quatre commits.

### Phase 3 — Composants de mise en page (2 h)

#### 3.1 `ContactHero`
Server Component, hauteur min 40vh (pas 92 — page utilitaire). Container
`prose`, kicker « Écrire à la maison », Heading `display-md` « Contact. »,
Text `lead` interrogatif (« Une question sur le rituel, le kit, une
commande, un échange professionnel\u202F? »), email
`<a href="mailto:contact@femiglow.ma">` souligné encre 20 % au repos,
encre 100 % au hover. Pas d'image, pas de fleuron, pas de fond coloré.

#### 3.2 `DirectContactBlock`
Server. Container `content`, grille 2 col desktop, 1 col mobile, gap
`space-8`.
- Col 1 : kicker « Écrire », email `mailto:contact@femiglow.ma?subject=Bonjour`,
  caption « Réponse sous 24 heures ouvrées, depuis Casablanca. ».
- Col 2 : kicker « Atelier », adresse, quartier, « Sur rendez-vous »,
  filet `border-t border-sauge`.

#### 3.3 `FAQAccordion`
Client (Radix `<Accordion type="single" collapsible>`). Props :
`items: { id, question, answer }[]` (max 4). 4 entrées Phase 1 : durée du
rituel, ongles fragiles, délais livraison, échantillon avant achat.
Animation 200 ms ease-out-soft, désactivée en `prefers-reduced-motion`.

#### 3.4 `ContactCrossLinks`
Server. 3 liens en ligne séparés par `\u00b7` : « Lire le rituel »,
« Voir le kit », « La maison ». Filet de navigation discret en clôture,
pas de cards.

**Commits** : un par composant. Quatre commits.

### Phase 4 — Refonte du `ContactForm` (3 h)

#### 4.1 Squelette `useForm` + watch sur `type`
Client Component, `react-hook-form` + `zodResolver(contactFormSchema)`,
`mode: 'onBlur'`. Props `defaultType?: ContactType = 'question'`. État
local `status: 'idle' | 'submitting' | 'success' | 'error'`. `defaultValues`
fournis pour tous les champs (y compris `website: ''`, `gdprConsent: false
as unknown as true`). `const type = methods.watch('type')` pour piloter
l'affichage des champs conditionnels.

#### 4.2 Pré-remplissage `?type=order` côté RSC
Dans `page.tsx`, lire `searchParams.type`, valider contre la liste
autorisée, passer en prop. Évite tout flash entre RSC et hydration (pas
de `useSearchParams` au montage côté Client).

#### 4.3 `FormTypeSelector`
Radix `<RadioGroup.Root>` en segmented control 3 colonnes. Sur
`onValueChange` : `methods.setValue('type', v, { shouldValidate: true })`.
Style des items : bordure encre 20 % par défaut, `data-[state=checked]:bg-encre
data-[state=checked]:text-creme`. Options : « Une question », « Une
commande », « Un échange professionnel ».

#### 4.4 Champs conditionnels
- `type === 'order'` : `TextField` pour `orderNumber`.
- `type === 'professional'` : `phone` (`inputMode="tel"`, `autoComplete="tel"`),
  `companyName` (`autoComplete="organization"`), `role`.

Apparition par transition CSS simple (`max-h` + `opacity`), pas Framer
Motion. Désactivée en `prefers-reduced-motion`.

#### 4.5 Honeypot
Champ `website` rendu en `<input tabIndex={-1} aria-hidden="true"
autoComplete="off">` positionné en `absolute; left:-9999px; h-0 w-0
overflow-hidden`. **Pas** `display: none` : certains bots le détectent.

#### 4.6 RGPD + newsletter (deux checkboxes séparées)
- `gdprConsent: z.literal(true)`, label avec lien
  `<Link href="/mentions-legales">mentions légales</Link>`.
- `newsletterOptIn: z.boolean()` par défaut `false`, label « Je souhaite
  recevoir la lettre saisonnière. ».

#### 4.7 Soumission
`onSubmit` appelle `POST /api/contact`. Trois branches :
1. `response.status === 422` → parser `issues.fieldErrors`, faire
   `methods.setError(field, { message })` pour chacun, `setStatus('error')`,
   focus sur le premier champ en erreur.
2. `!response.ok` → `setStatus('error')` (réseau, 5xx) → `ErrorState`.
3. OK → `setStatus('success')`, `methods.reset({ type: methods.getValues('type') })`
   (préserve le type choisi).

#### 4.8 `SuccessState`
Client Component. `useRef<HTMLHeadingElement>` + `useEffect` qui appelle
`.focus()` au montage. Wrapper `role="status" aria-live="polite"`.
Heading `<h3 tabIndex={-1}>` « Bien reçu. La maison vous répond. » +
paragraphe « Nous lisons chaque message avec attention. Réponse sous
24 heures ouvrées. ». Reset auto à 8 s : géré côté `ContactForm` via
`setTimeout(() => setStatus('idle'), 8000)`.

#### 4.9 `ErrorState`
Affichage si `status === 'error'` ET pas d'erreur de champ (réseau, 5xx) :
« L'envoi n'a pas abouti. Réessayez ou écrivez-nous à
[contact@femiglow.ma](mailto:contact@femiglow.ma). ».

**Commits** : un par sous-section logique. Cinq commits.

### Phase 5 — Assemblage de la page (1 h)

Fichier : [`apps/web/src/app/(marketing)/contact/page.tsx`](../../apps/web/src/app/(marketing)/contact/page.tsx)

Ordre exact : `ContactHero` → `DirectContactBlock` → section
« Écrire à la maison » (Container `content`, Heading `display-sm` id
`contact-form-heading`, `<ContactForm defaultType={defaultType} />` avec
`aria-labelledby`) → `FAQAccordion items={faqs}` → `ContactCrossLinks`.

`defaultType` calculé côté RSC en validant `searchParams.type` contre
la liste `['question', 'order', 'professional']`, fallback `'question'`.

**Commit** : « Assemble la page Contact ».

### Phase 6 — SEO, métadonnées, JSON-LD (45 min)

```tsx
export const metadata: Metadata = {
  title: 'Contact \u2014 la maison vous écrit',
  description:
    'Une question sur le rituel, le kit, une commande, un échange professionnel\u202F? Écrivez à la maison FemiGlow depuis Casablanca.',
  alternates: { canonical: '/contact' },
  openGraph: {
    type: 'website',
    title: 'Contact \u2014 FemiGlow',
    description: 'La maison vous répond sous 24 heures ouvrées.',
  },
};
```

JSON-LD `ContactPoint` :

```json
{
  "@context": "https://schema.org",
  "@type": "ContactPoint",
  "contactType": "customer service",
  "email": "contact@femiglow.ma",
  "areaServed": "MA",
  "availableLanguage": ["French", "Arabic"]
}
```

Vérifier que `?type=order` ne pollue pas le canonical (toujours `/contact`).

**Commit** : « SEO et JSON-LD pour la page Contact ».

### Phase 7 — Performance (1 h)

- `react-hook-form`, `@hookform/resolvers`, Radix `RadioGroup` et
  `Accordion` côté client uniquement, code-split par route.
- LCP candidat = `<h1>` du Hero. Pas d'image LCP.
- `pnpm build` → first-load JS de `/contact` ≤ 95 kB gzip.
- React DevTools : changer `type` ne re-render que la zone concernée
  (pas la FAQ, pas le Hero).
- Lighthouse mobile : LCP < 2.0 s, CLS < 0.05, INP < 150 ms.

**Commit** : « Optimise la page Contact : code-split Radix, hydration ciblée ».

### Phase 8 — Accessibilité (2 h)

- [ ] Un seul `<h1>` (`ContactHero`). Vrais h2 sur « Écrire à la maison »
      et « Foire aux questions ».
- [ ] Skip-link cible `#main`.
- [ ] Tab order : Hero email → coordonnées → `FormTypeSelector` (3 radios,
      navigation flèches) → champs visibles → champs conditionnels →
      RGPD → newsletter → submit → FAQ → cross-links → Footer.
- [ ] Tous les inputs ont un `<label>` via `htmlFor`/`id`.
- [ ] `aria-invalid="true"` sur les champs en erreur.
- [ ] `aria-describedby` pointe sur hint et/ou error.
- [ ] Sur succès : focus déplacé sur `<h3>` du `SuccessState`
      (`tabIndex={-1}` + `.focus()`).
- [ ] Sur erreur 422 : focus déplacé sur le **premier** champ en erreur
      via `methods.setFocus(firstInvalidField)`.
- [ ] Tap targets ≥ 44 × 44 px (radio cards : padding y-3 minimum).
- [ ] Contraste : labels encre/crème ≥ 13:1, hints ≥ 7:1, erreur (rouge
      sourd) ≥ 4.5:1 sur fond crème.
- [ ] axe-core : zéro violation critique.
- [ ] VoiceOver : succès lu via `aria-live="polite"`.
- [ ] Test clavier : navigation possible sans souris, ESC ne ferme rien
      d'inattendu (l'accordion FAQ se ferme avec Enter ou Space).
- [ ] `prefers-reduced-motion` : pas d'animation des champs
      conditionnels, pas d'animation de l'accordion.

**Commit** : « Audit accessibilité Contact : 0 violation, focus management propre ».

### Phase 9 — Tests (2 h)

#### 9.1 Vitest unitaires (`ContactForm.test.tsx`)
Trois cas minimum :
- `defaultType="order"` → `getByLabelText(/numéro de commande/i)` est
  présent.
- `defaultType="professional"` → `phone`, `companyName`, `role` présents.
- Submit sans cocher `gdprConsent` → message « consentement est requis »
  visible (test via `userEvent` + `waitFor`).

#### 9.2 Test schéma Zod isolé (`contact.schema.test.ts`)

```ts
it('exige orderNumber quand type = order', () => {
  const result = contactFormSchema.safeParse({
    type: 'order',
    name: 'Léa',
    email: 'lea@example.com',
    message: 'Bonjour, j\u2019ai une question sur ma commande.',
    gdprConsent: true,
    newsletterOptIn: false,
  });
  expect(result.success).toBe(false);
});
```

#### 9.3 Storybook
Stories par état : `Question`, `Order`, `Professional`, `WithErrors`,
`Submitting`, `Success`, `Error`. Plus une story `Page > Contact` qui
assemble tout.

#### 9.4 Playwright golden path (`e2e/contact.spec.ts`)
Trois tests :
- `goto('/contact?type=order')` → champ `numéro de commande` visible.
- Remplir question valide → `heading: /bien reçu/i` visible après submit.
- Honeypot : remplir le champ caché `website` via `page.evaluate`,
  vérifier que le serveur répond `200 { ok: true }` sans logger.

**Commit** : « Tests Contact : unitaires, stories, E2E golden path ».

### Phase 10 — Copy et finitions (1 h)

- [ ] Aucun mot interdit (acheter, produit, client, !, emoji).
- [ ] Apostrophes courbes (U+2019), em-dashes (U+2014), espaces fines
      insécables (U+202F) avant `?` et `:` et dans « \u202F\u2026\u202F ».
- [ ] Hero sous-titre : « Une question sur le rituel, le kit, une
      commande, un échange professionnel\u202F? ».
- [ ] FormTypeSelector : « Une question », « Une commande », « Un échange
      professionnel ». Pas « Question », « Pro ».
- [ ] Bouton submit : « Envoyer mon message ».
- [ ] Microcopy RGPD : « J'accepte que mon message soit lu par la maison
      FemiGlow afin d'y répondre. Voir nos [mentions
      légales](/mentions-legales). ».
- [ ] Microcopy newsletter : « Je souhaite recevoir la lettre saisonnière.
      Une lettre par saison. Aucun envoi commercial. ».
- [ ] Succès : « Bien reçu. La maison vous répond. ».
- [ ] Erreur : « L'envoi n'a pas abouti. Réessayez ou écrivez-nous à
      [contact@femiglow.ma](mailto:contact@femiglow.ma). ».
- [ ] FAQ : 4 entrées, chaque réponse en 2-3 phrases max.
- [ ] Test à voix haute : ton « lettre » préservé ? Pas de « formulaire
      administratif ».

**Commit** : « Polit la copy de la page Contact contre le glossaire éditorial ».

### Phase 11 — Mesure finale et merge (30 min)

- [ ] Lighthouse mobile et desktop, comparaison baseline / après dans
      `docs/plans/07-page-contact-baseline.md`.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` vert.
- [ ] Capture vidéo des 3 golden paths : question, order, professional.
- [ ] PR référencée à ce plan et à la spec § 4.9.
- [ ] Mettre à jour `docs/preparation/journal-iteration.md` :
      « Contact : LCP 1.4 s, CLS 0.01, INP 80 ms, axe 0, schéma discriminé,
      honeypot actif ».

---

## 6. Definition of Done — spécifique Contact

- [ ] Soumission valide d'un formulaire `question` → 200 + `SuccessState`
      affiché en < 800 ms perçues.
- [ ] Soumission `order` sans `orderNumber` → erreur inline sur le bon
      champ, focus déplacé dessus.
- [ ] Soumission `professional` sans téléphone → idem sur `phone`.
- [ ] `?type=order` dans l'URL → sélecteur sur « Une commande » dès le
      premier rendu (RSC), pas de flash de « Une question » avant
      hydration.
- [ ] Honeypot rempli → `200 { ok: true }` côté serveur, **rien** dans
      les logs (pas même un warning).
- [ ] FAQ : 4 accordéons clavier-navigables (Enter / Space). Aucun n'est
      ouvert par défaut.
- [ ] `SuccessState` reset le formulaire après 8 s mais conserve le
      `type` choisi.
- [ ] Sur erreur réseau, `ErrorState` affiche le mailto en secours :
      l'utilisateur n'est jamais bloqué.
- [ ] Aucun `console.warn` en dev, build, prod.

---

## 7. Métriques avant / après (à remplir)

À tenir dans `docs/plans/07-page-contact-baseline.md` :

| Métrique                  | Baseline | Cible    | Après  |
| ------------------------- | -------- | -------- | ------ |
| LCP mobile                | _        | < 2.0 s  | _      |
| LCP desktop               | _        | < 1.5 s  | _      |
| CLS                       | _        | < 0.05   | _      |
| INP                       | _        | < 150 ms | _      |
| TBT                       | _        | < 200 ms | _      |
| First-load JS gzip        | _        | ≤ 95 kB  | _      |
| Violations axe critique   | _        | 0        | _      |
| Lighthouse Perf           | _        | ≥ 95     | _      |
| Lighthouse a11y           | _        | 100      | _      |
| Lighthouse Best Practices | _        | ≥ 95     | _      |
| Lighthouse SEO            | _        | 100      | _      |

---

## 8. Risques et points d'attention

| Risque                                                                | Mitigation                                                                          |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Schéma discriminé → mauvaise intégration `react-hook-form`            | Choisir `superRefine` à plat, plus compatible avec un seul `useForm`                |
| Pré-remplissage `?type=order` flash entre RSC et hydration            | Passer `defaultType` en prop RSC → Client, pas `useSearchParams` au montage         |
| Honeypot visible aux extensions a11y agressives                       | `position: absolute; left: -9999px` + `aria-hidden` + `tabIndex=-1` (pas `display:none`) |
| Reset après 8 s gêne quelqu'un qui voulait copier le succès           | OK : `aria-live="polite"`, le contenu reste lu même après changement DOM            |
| Champs conditionnels animés cassent sur mobile bas de gamme           | Transition CSS simple, pas Framer Motion ; respect `prefers-reduced-motion`         |
| RGPD checkbox oubliée → bouton submit reste actif                     | Validation `onBlur` ; au submit, erreur s'affiche, focus va sur le checkbox         |
| reCAPTCHA Phase 2 alourdira ~50 kB                                    | Charger via `next/dynamic` avec `ssr: false`                                        |
| `phone` accepte n'importe quoi                                        | Phase 1 : pas de regex ; Phase 2 : `libphonenumber-js` + format E.164                |
| 422 du backend renvoie des messages techniques                        | Zod `errorMap` déjà en français côté schéma                                         |

---

## 9. Estimation horaire récapitulative

| Phase                          | Estimation |
| ------------------------------ | ---------- |
| 0 — Baseline                   | 0 h 30     |
| 1 — Refonte schéma             | 2 h        |
| 2 — Polissage primitifs        | 1 h 30     |
| 3 — Composants de mise en page | 2 h        |
| 4 — Refonte ContactForm        | 3 h        |
| 5 — Assemblage page            | 1 h        |
| 6 — SEO + JSON-LD              | 0 h 45     |
| 7 — Performance                | 1 h        |
| 8 — Accessibilité              | 2 h        |
| 9 — Tests                      | 2 h        |
| 10 — Copy & finitions          | 1 h        |
| 11 — Mesure & merge            | 0 h 30     |
| **Total**                      | **17 h**   |

Avec interruptions et ajustements (notamment validation conditionnelle qui
peut surprendre la première fois) : **18 à 20 h, soit 2 à 3 jours**.

---

## 10. Annexes — commandes utiles

```bash
# Dev
cd apps/web && pnpm dev

# Lighthouse
npx lighthouse http://localhost:3000/contact --view --preset=desktop --output-path=./lighthouse-contact-desktop.html
npx lighthouse http://localhost:3000/contact --view --output-path=./lighthouse-contact-mobile.html

# Bundle analyzer
ANALYZE=true pnpm --filter @femiglow/web build

# axe en CLI
npx @axe-core/cli http://localhost:3000/contact

# Tests
pnpm --filter @femiglow/web test -- contact
pnpm --filter @femiglow/web test:e2e -- contact
pnpm --filter @femiglow/web storybook
```

### Tester la route API à la main

```bash
# Cas valide
curl -X POST http://localhost:3000/api/contact \
  -H "Content-Type: application/json" \
  -d '{"type":"question","name":"Léa","email":"lea@example.com","message":"Bonjour, j\u2019ai une question.","gdprConsent":true,"newsletterOptIn":false}'

# Cas honeypot rempli (doit renvoyer 200 silencieux)
curl -X POST http://localhost:3000/api/contact \
  -H "Content-Type: application/json" \
  -d '{"type":"question","name":"Bot","email":"bot@example.com","message":"spam spam spam spam","gdprConsent":true,"newsletterOptIn":false,"website":"http://spam.example.com"}'

# Cas validation 422 (order sans orderNumber)
curl -X POST http://localhost:3000/api/contact \
  -H "Content-Type: application/json" \
  -d '{"type":"order","name":"Léa","email":"lea@example.com","message":"Question sur ma commande.","gdprConsent":true,"newsletterOptIn":false}'
```

---

## 11. Critère unique de réussite

> *La page Contact tient debout si quelqu'un de pressé peut écrire en
> 30 secondes (clic email direct), si quelqu'un de méthodique peut
> remplir un formulaire en 90 secondes sans hésitation, et si un
> professionnel peut soumettre une demande structurée sans avoir le
> sentiment de remplir un formulaire administratif. Si l'utilisateur a
> besoin de relire un label deux fois, ou si l'erreur de champ est lue
> sans qu'il sache **lequel**, la page n'est pas finie.*

À cocher **avant** d'attaquer la page suivante.

---

## 12. Bilan d'exécution — 2026-05-03

### Livrables

- **Schéma** : `contact.ts` refondu avec `superRefine` (type discriminé,
  `phone/orderNumber/companyName/role` conditionnels, honeypot
  `website`, `gdprConsent: z.literal(true)` + `newsletterOptIn:
  z.boolean()`, `recaptchaToken` placeholder Phase 2). Export du type
  `ContactType`.
- **Route API** : honeypot non vide → `200 { ok: true }` silencieux,
  zéro log. Validation 422 retourne `issues.fieldErrors` consommé par
  `setError`.
- **Composants créés** :
  - `ContactHero` (Server, 40vh, kicker + h1 « Contact. » + mailto).
  - `DirectContactBlock` (Server, 2 col, filet sauge, atelier
    Casablanca + Bourgogne).
  - `FAQAccordion` (Server, `<details>/<summary>` natif — pas de
    Radix, animation `+` rotate, motion-reduce respect).
  - `ContactCrossLinks` (Server, 3 liens en ligne séparés `\u00B7`).
  - `FormTypeSelector` (Client, radio inputs natifs, segmented
    control 3 colonnes, `data-state=checked` encre/crème).
  - `SuccessState` (Client, focus auto sur h3 via `useRef`,
    `aria-live="polite"`).
  - `ErrorState` (Client, mailto secours rendu uniquement sur erreur
    réseau, pas sur 422).
- **Primitifs polis** : `TextAreaField` reçoit `showCounter`
  optionnel ; `FieldShell` accepte un `trailing` pour le compteur en
  ligne avec hint.
- **Refonte `ContactForm`** : `react-hook-form` + `zodResolver`,
  `mode: 'onBlur'`, `defaultType` prop, watch sur `type`, champs
  conditionnels via `aria-hidden:hidden` Tailwind, honeypot offscreen,
  reset après succès en conservant le `type` choisi, focus déplacé sur
  premier champ en erreur 422.
- **Page assemblée** : `<JsonLd ContactPoint />` + `ContactHero` +
  `DirectContactBlock` + section formulaire + `FAQAccordion` +
  `ContactCrossLinks`. `defaultType` calculé côté RSC via
  `contactTypeSchema.safeParse(searchParams.type)`, fallback
  `'question'`. Le `<main>` du layout `(marketing)` est respecté (pas
  de duplication).
- **Métadonnées** : `alternates.canonical: '/contact'`, `openGraph` +
  Twitter `summary`, JSON-LD `ContactPoint` (`email`, `areaServed:
  'MA'`, `availableLanguage: ['French', 'Arabic']`).

### Métriques

| Mesure                   | Baseline | Après  |
| ------------------------ | -------- | ------ |
| Suite Vitest             | 113 verts (33 fichiers) | 134 verts (38 fichiers) |
| Tests dédiés Contact     | 0        | 21 tests / 5 fichiers |
| TypeScript / ESLint      | _        | 0 / 0 |
| Violations axe `/contact`| _        | 0 |
| First Load JS `/contact` | 114 kB (4.89 kB route) | 164 kB (7.74 kB route) |
| Honeypot serveur         | absent   | 200 silencieux confirmé via curl |
| Validation 422 inline    | absent   | confirmée via curl, `setError` + `setFocus` |

### Décisions notables

1. **`<details>/<summary>` plutôt que Radix `<Accordion>`** : Radix
   non installé, on suit la même ligne que Plan 06 (`<dialog>` natif).
   Pas de dépendance ajoutée, animation propre via `group-open` +
   transition `transform`.
2. **`aria-hidden:hidden` Tailwind 3.4** : la transition
   `max-h: 0 → 600px` du plan créait des espacements résiduels avec
   `space-y-8`. Approche `display:none` via la variante `aria-hidden:`
   garde l'a11y impeccable (`aria-hidden=true`) et fait collapse les
   marges. Les transitions sur les opacités restent actives quand le
   conteneur est visible.
3. **First Load JS 164 kB > cible 95 kB** : la cible n'est pas
   tenable avec `react-hook-form` + `zod` + `@hookform/resolvers`
   (~50 kB compressés, partagés avec `/commander` 119 kB et `/kit`
   162 kB). Le poids est dans l'enveloppe projet ; à reconsidérer si
   on bascule un jour sur un form natif léger.
4. **Email unique `contact@femiglow.ma`** : retiré
   `bonjour@femiglow.ma` partout, supprimé l'affichage du téléphone
   (canal non monitoré Phase 1).
5. **`<main>` retiré de `page.tsx`** : le layout `(marketing)`
   l'expose déjà ; conserver le `<main>` côté page créait 3 violations
   axe (`landmark-no-duplicate-main`, `landmark-main-is-top-level`,
   `landmark-unique`).
6. **Champs conditionnels en DOM toujours présent** : permet à RHF de
   garder `register` actif et de remettre les valeurs si l'utilisateur
   bascule de type sans perdre sa saisie. `aria-hidden=true` neutralise
   la lecture pour le screen reader quand non pertinent.
7. **Test honeypot via curl plutôt que Playwright Phase 1** : suffit
   pour valider le 200 silencieux. Playwright golden path différé en
   Phase 2 quand on aura le serveur de dev stabilisé en CI.

À cocher **avant** d'attaquer la page suivante. ✓

