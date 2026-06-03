# F12 — `CouponWelcomeNote` (note « geste d'accueil » sur la landing — régression de charte)

## Rôle & surface
Re-scénariser la remise du coupon `welcome_auto` en invitation de la maison sur la landing (`/kit`).
Composant purement présentationnel (la gate treatment/holdout est décidée par l'appelant). Inclut une
porte discrète repliée vers `InvitationCodeField`.
Fichier cible : `apps/web/src/components/sections/CouponWelcomeNote.tsx`.
Fichier de test : `src/components/sections/CouponWelcomeNote.test.tsx` (**fichier existant — on étend**).

> **Régression majoritaire.** `CouponWelcomeNote.test.tsx` couvre déjà I001 (copie + prix final),
> I002 (charte sans emoji/!/countdown), I003 (disclosure repliée), I004 (AR RTL), I005 (« Hors cumul »).
> Ce dossier **verrouille ces acquis comme non-régression** et ajoute quelques angles manquants :
> `endsAtLabel` présent vs null (mention de validité civile), `savingsLabel` rendu tel quel,
> `aria-label === title`, accent sauge (filet) et absence de rouge retail. Les nouveaux ids F12
> complètent sans rejouer I001-I005 (qui restent la base de non-régression citée).

## Fonctionnement optimal (ce qui DOIT se passer)
- **Titre** : FR « Votre geste d'accueil est appliqué. » / AR « لقد تم تطبيق هدية الترحيب الخاصة بك. ».
  Utilisé aussi comme `aria-label` de l'`<aside data-testid="coupon-welcome-note">`.
- **Économie** : `savingsLabel` (ex. « 90 MAD offerts ») rendu tel quel sous le titre.
- **Prix final** : préfixe FR « Prix final aujourd'hui : » / AR « السعر النهائي اليوم: » + `finalPriceLabel`
  dans `coupon-welcome-final-price` en `font-display tabular-nums`.
- **Validité civile + non-cumul** : si `endsAtLabel` fourni → `{endsAtLabel} · {Hors cumul.}` ; sinon
  → juste « Hors cumul. » (FR) / « غير قابل للجمع. » (AR). Pas de countdown.
- **Disclosure** : `<details>` repliée par défaut, summary `coupon-invitation-disclosure`
  (« J'ai un code d'invitation » / « لدي رمز دعوة »), contenant `InvitationCodeField`.
- **Charte** : crème + encre + filet fin **sauge** (`border-sauge/40`), centré, coins discrets. PAS de
  rouge retail, PAS de countdown, PAS d'emoji, PAS de `%` ni `!`.
- **AR** : `dir="rtl"` sur l'aside, copies arabes.

## Contrat I/O
- **Props** : `finalPriceLabel` (string), `savingsLabel` (string), `endsAtLabel?` (string|null),
  `isArabic?`, `className?`.
- **Sortie** : `JSX` (toujours rendu — la gate est externe). Aucun événement, aucun endpoint propre
  (le champ interne appelle `/api/coupons/redeem` mais reste replié et inerte tant que non ouvert).

## Cas limites & non-happy-path
- **`endsAtLabel` null** → une seule ligne « Hors cumul. » (pas de date).
- **`endsAtLabel` présent** → « {date} · Hors cumul. ».
- **AR** → `dir="rtl"`, titre/préfixe/non-cumul/invitation en arabe.
- **Disclosure repliée** (régression I003) → le contenu du champ n'est pas visible au montage.
- **Charte** (régression I002) → aucun emoji/`!`/`%`/countdown ; filet sauge présent ; pas de classe
  rouge retail.
- **savingsLabel arbitraire** → rendu verbatim (le composant ne reformate pas).

## Invariants couverts
- **INV-NONCUMUL (affichage)** : mention « Hors cumul. » toujours présente (welcome non cumulable avec
  un autre coupon prix).
- Charte voix maison : filet sauge, pas de rouge/`%`/`!`/emoji/countdown.

## Critères d'acceptation (observables)
- `coupon-welcome-note` rendu ; `aria-label` === titre FR.
- `coupon-welcome-final-price` contient `finalPriceLabel` et a la classe `tabular-nums`.
- `savingsLabel` affiché verbatim.
- `endsAtLabel` null → textContent contient « Hors cumul. » sans date ; présent → contient « {date} · ».
- `coupon-invitation-disclosure` présent ; le champ interne replié (non visible).
- AR : `coupon-welcome-note` a `dir="rtl"` ; titre arabe ; non-cumul « غير قابل للجمع. ».
- Charte : textContent ne matche pas `/[%!]|🎉|⏰/` ; l'aside porte la bordure sauge (`border-sauge`).

## Points à vérifier — tous points de vue
- Backend : gate treatment/holdout décidée par l'appelant (hors composant).
- Frontend : rendu toujours présent ; disclosure repliée ; pas de logique réseau au montage.
- UI/UX/design : crème + encre + filet sauge, centré, pas de rouge retail.
- Data : labels rendus verbatim ; `endsAtLabel` optionnel.
- A11y : `aria-label` = titre ; `<summary>` focusable.
- i18n : copies FR/AR exactes ; `dir="rtl"` AR.
