# F01 — Plan de tests concret (RTL / MSW / Playwright)

> Fichiers cibles : `LeadCaptureStep.owbs.test.tsx` (RTL+MSW),
> `e2e/owbs-ui-wizard-lead.spec.ts` (PW). Conventions : [`../00-strategy/tooling-and-harness.md`](../00-strategy/tooling-and-harness.md).

## A. RTL (composant via DOM)

### Helper local
```ts
function renderLeadStep(flag: 'true'|'false') {
  process.env.NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED = flag;
  seedWizardStore(); // formContext wizard_cart + cartSnapshot kit + currentStep='lead'
  return render(<LeadCaptureStep .../>);
}
async function fill({firstName='Salma', phone='0600000000', consent=true} = {}) {
  await user.type(screen.getByRole('textbox', { name: /pr[ée]nom/i }) /* ou name=firstName */, firstName);
  await user.type(byName('phone'), phone);     // pressSequentially si masque
  if (consent) await user.click(byName('consent'));
}
```

### Cas
- **F01-S01** validité → submit enabled : `fill(); expect(byTestId('wizard-lead-submit')).toBeEnabled()`.
- **F01-S02/03/05** invalidité → `toBeDisabled()` + `aria-invalid`.
- **F01-S04/S20** honeypot : remplir `byName('website')` → submit → **aucun** appel (`enqueueMock`/`fetch` non appelés) ; le store passe quand même en "succès silencieux" (cf. handleSubmit honeypot).
- **F01-S14** flag ON : mock `getLeadSyncQueue` + `wizardClient` → `fill()` + submit → `expect(wizardClientCreateLead).not.toHaveBeenCalled()` ; `expect(enqueue).toHaveBeenCalledWith(objectContaining({scope:'lead_create'}))` ; `store.currentStep === 'address'`. (Réutilise/étend `use-lead-capture-mutation.owbs.test.tsx`.)
- **F01-S15** flag OFF : `expect(wizardClientCreateLead).toHaveBeenCalled()`.
- **F01-S08/09** masque tel : taper `0600000000` → valeur normalisée acceptée ; en AR (`dir=rtl`) la valeur reste latine.
- **F01-S23** a11y : `await expectNoAxeViolations(container)`.

## B. MSW (réaction réseau)
- **F01-S21** : `server.use(leadOk)` ; après enqueue+flush, la file se vide (observer via la queue ou un spy de requête `/api/checkout/lead`).
- Croisé F03/F06 pour latence/échec (réutiliser les handlers `leadSlow/leadFlaky/lead409`).

## C. Playwright (`e2e/owbs-ui-wizard-lead.spec.ts`, build flag-ON)
```ts
test('F01-S10 transition < 1.5s sous /lead bridé 6s', async ({page}) => {
  await page.route('**/api/checkout/lead', async r => { await wait(6000); await r.fulfill({status:201, body: JSON.stringify({leadId:'cl_e2e0000000000000000',status:'created',nextStep:'address'})}); });
  await openWizard(page); await fillLead(page);
  const t0 = Date.now();
  await page.getByTestId('wizard-lead-submit').click();
  await expect(page.getByTestId('wizard-step-address')).toBeVisible({timeout:1500});
  expect(Date.now()-t0).toBeLessThan(1500);
});
```
- **F01-S11** : `route.abort()` au lieu du delay → address visible + pas de message d'erreur ; (optionnel) observer une requête `/api/checkout/lead`.
- **F01-S12** double-tap : `await submit.click(); await submit.click();` → vérifier **une** étape address + (via admin ou /sync spy) **un** seul lead.
- **F01-S13** flag OFF (build legacy ou route forçant) : address visible **seulement** après la réponse (≥ 6s) → prouve la parité.
- **F01-S22** clavier : `page.keyboard.press('Tab')` séquence → focus ordonné.

## D. Étapes (avec test à chaque étape)
1. Écrire le helper `renderLeadStep`/`fill` + garde-fou honeypot (F01-S04/S06) → vert.
2. Brancher validité/submit (S01-S03,S05,S07) → vert.
3. Optimiste vs legacy (S14/S15) en RTL (mocks) → vert.
4. a11y (S23) + masque AR (S08/S09) → vert.
5. Playwright timing/abort/double-tap/legacy (S10-S13) sur build flag-ON → vert.
6. Non-régression : `LeadCaptureStep` existant + `use-wizard-mutations` verts.
