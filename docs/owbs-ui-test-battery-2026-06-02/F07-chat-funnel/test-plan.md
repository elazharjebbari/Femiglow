# F07 — Plan de tests concret

> Étend `LeadFormBubble.owbs.test.tsx` (déjà S01/S02) + nouveau `LeadFormBubble.tracking.test.tsx`.

## A. RTL/MSW (composant)
- **F07-S01/S02** : déjà couverts (success immédiat flag ON ; submitting flag OFF) — **vérifier verts**. Helpers : `openForm()` (setSession+receiveLeadOffer+openLeadForm), `fillAndSubmit()` (inputs par `id$="-firstName"/"-phone"`).
- **F07-S03 honeypot** : remplir `_phone_alt` → submit → succès silencieux, `fetch` non appelé.
- **F07-S04** validation : prénom 1 lettre → submit ne part pas.
- **F07-S05 tracking valorisé** (critique) : `server.use(chatLeadOk({value:289,currency:'MAD'}))` ; mock `useTracking().emit` ; flag ON ; submit ; **attendre** la résolution de fond → `expect(emit).toHaveBeenCalledWith('generate_lead', objectContaining({value:289, currency:'MAD'}))`. Garde-fou : la valeur n'est **pas** perdue en optimiste.
- **F07-S06** : `markLeadAsPurchaseCookie` appelé (spy).
- **F07-S07/S08** : `chatLeadError` ; flag ON → reste `success` ; flag OFF → `error`.
- **F07-S11/S12** : AR/RTL + axe.

## B. Playwright (optionnel, chat difficile à déclencher)
- **F07-S10** : si l'offre de lead peut être forcée (seed/flag), bridé `/api/chat/lead/contact` → confirmation < 1 s. Sinon documenté comme couvert RTL (l'offre chat est LLM-déclenchée, peu déterministe en e2e).

## C. Étapes
1. Vérifier S01/S02 verts ; ajouter honeypot + validation (S03/S04).
2. **Tracking valorisé S05** (le plus important : ROAS) + cookie S06.
3. Best-effort vs legacy (S07/S08) + a11y/i18n (S11/S12).
