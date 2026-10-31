# 06 — Frontend

Chemins relatifs à `apps/web/src`.

## 1. Stratégie

La version actuelle reste intacte. La nouvelle vit à côté, derrière un drapeau, pour permettre l'A/B test et un retour arrière immédiat.

```text
WizardShell
└─ step === 'address'
   ├─ variante 'control' → AddressStep (inchangé)
   └─ variante 'v2'      → AddressStepV2 (nouveau)
```

Les corrections de bugs purs (faux CTA, prix erroné, traductions) s'appliquent aux deux variantes.

## 2. Fichiers

| Action | Fichier | Rôle |
|---|---|---|
| Créer | `components/checkout/wizard/steps/AddressStepV2.tsx` | Étape 2 progressive |
| Créer | `components/checkout/wizard/StepActionBar.tsx` | Barre fixe : total, CTA, assurance |
| Créer | `components/checkout/wizard/ConfirmOrderButton.tsx` | CTA, ses états, son icône |
| Créer | `components/checkout/wizard/StepProgressLine.tsx` | Ligne de progression |
| Créer | `lib/checkout/address/address-form-schema.ts` | Schéma à messages traduits |
| Créer | `lib/checkout/address/use-address-reveal.ts` | Règle de révélation, testable seule |
| Modifier | `components/commerce/StickyCartCTA.tsx` | Masquée dès l'étape 2 |
| Modifier | `components/ui/Button.tsx` | Prop `loadingLabel` |
| Modifier | `components/checkout/wizard/components/CityAutocomplete.tsx` | Mode compact, nom selon la langue |
| Modifier | `components/checkout/wizard/WizardShell.tsx` | Choix de variante, récapitulatif, traductions |
| Modifier | `components/sections/KitCommanderSection.tsx` | Assignation de la variante |
| Modifier | `lib/checkout/i18n/locales/{fr,ar,en}.ts`, `dictionary.ts` | Textes du 05 |
| Modifier | `styles/tokens.css`, `tailwind.config.ts` | Jetons `action`, `notice` |
| Modifier | `lib/tracking/schemas.ts` | Nouveaux événements |
| Réutiliser | `components/chat/hooks/use-visual-viewport.ts` | Hauteur du clavier |
| Réutiliser | `lib/checkout/state/use-wizard-mutations.ts` | `useAddressMutation` inchangé |

## 3. Machine d'états

```ts
type AddressPhase = 'city' | 'address' | 'ready' | 'submitting';

function deriveAddressPhase({ cityValid, addressRevealed, addressValid, submitting }) {
  if (submitting) return 'submitting';
  if (!cityValid) return 'city';
  if (addressRevealed && addressValid) return 'ready';
  return 'address';
}
```

Cette fonction pure pilote le libellé du CTA et l'action au tap. Elle se teste sans navigateur.

## 4. Révélation

```ts
export function useAddressReveal({ citySlug, cityText, addressDraft }) {
  const [revealed, setRevealed] = useState(
    () => cityText.trim().length >= 2 || addressDraft.trim().length > 0,
  );
  const reveal = useCallback(() => setRevealed(true), []);
  useEffect(() => { if (citySlug) reveal(); }, [citySlug, reveal]);
  const onCityBlur = () => { if (cityText.trim().length >= 2) reveal(); };
  return { revealed, reveal, onCityBlur };
}
```

Points de vigilance :

- `revealed` ne repasse jamais à `false`.
- Le champ reste enregistré dans `react-hook-form` : garder `shouldUnregister: false`.
- Ne pas masquer avec `hidden` pendant l'animation : utiliser `grid-rows-[0fr]` vers `grid-rows-[1fr]`, et `inert` tant que le champ est fermé.
- Le focus automatique se fait de façon synchrone dans le gestionnaire de choix de ville, pour conserver le clavier iOS.

## 5. Barre d'action

```tsx
<StepActionBar keyboardInset={inset} keyboardOpen={keyboardOpen}>
  {cityValid && <TotalLine cents={totalCents} />}
  <ConfirmOrderButton phase={phase} onPress={handlePress} />
  {!keyboardOpen && <Reassurance />}
</StepActionBar>
```

| Règle | Détail |
|---|---|
| Position mobile | `fixed bottom-0 inset-x-0`, `z` sous le chat et les modales |
| Encoche | `padding-bottom: max(12px, env(safe-area-inset-bottom))` |
| Clavier | `transform: translateY(-{inset}px)` |
| Desktop (`lg`) | `static`, dans le flux |
| Espace réservé | `padding-bottom` du formulaire égal à la hauteur de la barre, mesuré par `ResizeObserver` |
| Focus | `scroll-padding-bottom` pour que le champ actif ne passe pas sous la barre |
| Formulaire | Le CTA garde `type="submit"` avec `form={formId}` s'il sort du `<form>` |

**Attention iOS.** L'événement `visualViewport.resize` peut arriver en retard. Prévoir un `transition` nul et tester le navigateur intégré Instagram et Facebook, qui concerne la majorité du trafic Meta.

`interactive-widget` a été volontairement retiré de `app/layout.tsx` à cause d'un avertissement Safari. Ne pas le rétablir : `visualViewport` couvre iOS et Android.

## 6. Bouton

```tsx
const LABELS = {
  city: t.address.ctaChooseCity,
  address: t.address.ctaAddAddress,
  ready: t.address.ctaConfirm,
  submitting: t.address.ctaSaving,
};
```

- `aria-busy` pendant l'envoi.
- `disabled` uniquement à l'envoi, pour éviter le double envoi.
- Le changement de libellé n'est pas annoncé à chaque frappe : `aria-live` limité au passage à `ready`.
- Le reflet est un pseudo-élément CSS, compté par `animation-iteration-count: 3`.

```css
@media (prefers-reduced-motion: no-preference) {
  .cta-ready::after {
    animation: cta-sheen 5s ease-in-out 1s 3;
  }
}
```

Pas de `framer-motion` pour ce bouton : le CSS suffit et n'ajoute rien au poids de la page.

## 7. Faux CTA

```tsx
const currentStep = useWizardStore((s) => s.currentStep);
const dataVisible = chatOpen || sheetOpen || currentStep !== 'lead' ? false : visible;
```

À vérifier : `StickyCartCTA` est utilisé hors du wizard. Sur une page sans wizard, le store garde sa valeur par défaut ; une cliente revenue en cours de parcours pourrait perdre la barre. Le test de non-régression couvre ce cas.

## 8. Ville en arabe

`city` dans le formulaire reste la valeur envoyée. Le nom affiché devient un état séparé :

```ts
const displayCity = language === 'ar' && addressDraft.cityNameAr
  ? addressDraft.cityNameAr
  : addressDraft.city;
```

**Risque.** L'effet actuel invalide le prix si le texte diffère de `addressDraft.city`. En affichant le nom arabe, il effacerait à tort le tarif. Cette comparaison doit porter sur les deux noms. Le serveur reconnaît déjà le nom arabe (`matchesCityExactly`).

## 9. Traductions de validation

```ts
export const addressFormSchema = (e: AddressErrors) => z.object({
  city: z.string().trim().min(2, e.cityRequired).max(80, e.cityTooLong),
  addressLine1: z.string().trim().min(4, e.addressRequired).max(160, e.addressTooLong),
  notes: z.string().trim().max(500, e.noteTooLong).optional(),
});
```

Passer en mode `onTouched` : validation à la sortie du champ, puis à la frappe seulement après une première erreur.

## 10. Attributs de champs

| Champ | Attributs |
|---|---|
| Ville | `autoComplete="shipping address-level2"`, `enterKeyHint="next"`, `dir="auto"` |
| Adresse | `autoComplete="shipping street-address"`, `enterKeyHint="done"`, `dir="auto"` |

Le champ ville utilise aujourd'hui un `autoComplete` qui désactive l'autofill natif. Tester le comportement réel sur iOS et Android avant de le changer : un autofill peut remplir le champ sans ouvrir la liste. La condition de révélation au `blur` couvre ce cas, à confirmer.

## 11. Accessibilité

- Un seul `h2` par étape, et le focus revient dessus à l'arrivée sur l'étape.
- Erreurs liées par `aria-describedby`, `role="alert"` seulement au tap.
- Cible tactile de 44 px minimum, liens compris.
- `aria-hidden` sur l'icône.
- `WizardStepAnnouncer` conservé.

## 12. Performance

- `AddressStepV2` reste chargé en différé, comme `AddressStep`.
- Aucune dépendance nouvelle.
- Budget : moins de 3 Ko ajoutés au `First Load JS` de `/kit`.

## 13. Dette connue

- `wizard-address-submit`, `wizard-shipping-notice` et `wizard-address-line1` sont utilisés par `AddressStep.test.tsx`, `checkout-wizard-kit.spec.ts`, `loyalty-issuance.spec.ts` et `loyalty-redemption.spec.ts`. Garder les mêmes `data-testid` dans la V2 quand c'est possible.
- À la fin du test, si la V2 gagne : supprimer `AddressStep.tsx` et les clés orphelines.
