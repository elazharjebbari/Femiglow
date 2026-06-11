# F11 — Lead form bubble

> Pattern condensé : description + scenarios + plan tests dans un fichier. La matrice
> détaillée est dans [test-matrix.csv](test-matrix.csv).

## 1. Description fonctionnelle

### Cible
Capture des coordonnées visiteur (prénom + téléphone + consentement RGPD) directement dans
le flux de chat, sans rupture conversationnelle. Levier P4 du funnel (lead_capture_rate
45 % → 65 %).

### Happy path
1. Le hook `useChatSend` reçoit un event SSE `lead-form-offer` avec `reason` + `copyVariant`
2. Le store Zustand insère un message synthétique `type: 'lead-form'` dans la liste
3. `MessageList` rend `<LeadFormBubble />` à la place d'un message texte
4. Visiteur remplit firstName + phone + check consent
5. Submit → `POST /api/chat/lead/contact` avec sessionId + payload
6. Réponse 200 → form devient "merci" + state.leadCaptured=true
7. Webhook dispatché côté backend (cf. F55)
8. Slack alert si applicable (cf. F56)

### Edge cases
| Cas | Comportement |
|-----|--------------|
| Validation phone (format MA 06XXXXXXXX) | Erreur inline "Format attendu : 06..." |
| Phone déjà dans `chat_lead` (dedup identity_hash) | 200 OK silencieux (pas de spam DB) |
| Consent décoché | Bouton submit disabled |
| Honeypot field rempli | 422 silencieux côté serveur, succès factice côté client |
| Rate limit 5 lead/IP/min hit | 429 avec message "Trop de tentatives" |
| Réseau timeout | Bouton "Réessayer" |
| Plusieurs offers consécutifs | Une seule bubble visible (latest only) |

### Variantes copy (par reason)
- `purchase-intent` → "Souhaitez-vous être recontactée par notre conseillère ?"
- `frustration` → "Voulez-vous qu'une personne reprenne le fil ?"
- `out-of-knowledge` → "Je peux vous mettre en relation avec une experte"
- `inline-contact` → pré-rempli avec numéro détecté
- `after-hours` → "Nos conseillères vous rappelleront demain matin"
- `explicit-request` → "Bien sûr, laissez-moi vos coordonnées"

## 2. Risques
- Bug submit → perte directe lead (sécurité conversion)
- Format phone non-MA accepté → contact impossible
- Bubble doublonné → confusion UX
- Honeypot/CSRF mal configurés → spam

## 3. Stratégie test
- [x] Unit (validation phone MA, dedup logic, copy variants)
- [x] Integration (`POST /api/chat/lead/contact` + DB + webhook MSW)
- [x] Component (form interactif, validation, état success/error)
- [x] E2E (visiteur capture lead complet → admin voit le lead)
- [x] A11y (form labels, errors, focus management)

## 4. Test matrix (synthèse)

| Couche | Cas (clé) | P |
|--------|-----------|---|
| Unit | validate phone MA accepts 06XXXXXXXX | 0 |
| Unit | validate phone MA rejects 05XXXXXXXX | 0 |
| Unit | validate phone MA accepts +212 6XX | 1 |
| Unit | dedup identity_hash matches case-insensitive | 0 |
| Unit | copy variant for 'purchase-intent' is correct FR | 0 |
| Unit | copy variant for 'frustration' is correct AR-MA | 0 |
| Integration | POST lead inserts row in chat_lead | 0 |
| Integration | POST lead triggers webhook to test sink | 0 |
| Integration | POST lead with duplicate phone → idempotent 200 | 0 |
| Integration | POST lead missing consent → 422 | 0 |
| Integration | POST lead honeypot → 200 silent fail | 0 |
| Integration | POST lead rate limit IP → 429 | 0 |
| Component | renders with correct copy for each reason | 0 |
| Component | submit button disabled until valid + consent | 0 |
| Component | phone error shown inline on blur | 0 |
| Component | success state replaces form on 200 | 0 |
| Component | retry button shown on network error | 0 |
| Component | a11y form labels via aria-labelledby | 0 |
| Component | focus moves to firstName on bubble mount | 0 |
| Component | focus moves to error message on validation fail | 0 |
| E2E | visitor captures lead end-to-end | 0 |
| E2E | admin sees new lead in /admin/chat/leads | 0 |
| E2E | webhook test sink receives payload | 0 |

Voir [test-matrix.csv](test-matrix.csv) pour les ~25 cas complets.

## 5. Exemple de tests (extraits)

### Unit — validation phone MA
```typescript
describe('validatePhoneMA', () => {
  test.each([
    ['0612345678', true],
    ['06 12 34 56 78', true],   // with spaces
    ['+212612345678', true],
    ['+212 6 12 34 56 78', true],
    ['0512345678', false],      // landline
    ['0712345678', true],       // mobile alternate prefix
    ['12345', false],
    ['', false],
    ['phone', false],
  ])('phone "%s" → valid=%s', (input, expected) => {
    expect(validatePhoneMA(input)).toBe(expected);
  });
});
```

### Component
```typescript
it('submit disabled until firstName + phone + consent provided', async () => {
  const user = userEvent.setup();
  render(<LeadFormBubble reason="purchase-intent" copyVariant="default" />);

  const submit = screen.getByRole('button', { name: /me rappeler/i });
  expect(submit).toBeDisabled();

  await user.type(screen.getByLabelText(/prénom/i), 'Leila');
  expect(submit).toBeDisabled();

  await user.type(screen.getByLabelText(/téléphone/i), '0612345678');
  expect(submit).toBeDisabled();

  await user.click(screen.getByLabelText(/j'accepte/i));
  expect(submit).toBeEnabled();
});
```

### E2E
```typescript
test('@critical visitor captures lead end-to-end', async ({ page }) => {
  await page.goto('/kit');
  const widget = new ChatWidgetPOM(page);
  await widget.open();
  await widget.sendMessage('Je voudrais commander');
  await widget.waitForAssistantReply();

  await widget.fillLeadForm({
    firstName: 'Leila',
    phone: '0612345678',
    consent: true,
  });

  await expect(widget.leadFormBubble().getByText(/merci/i)).toBeVisible();

  // Vérif admin
  await loginAsAdmin(page);
  const leads = new AdminLeadsListPOM(page);
  await leads.goto();
  await expect(leads.row('0612345678')).toBeVisible();
});
```

## 6. Liens
- [test-matrix.csv](test-matrix.csv) (25 lignes)
- [scenarios.gherkin](scenarios.gherkin) (10+ scénarios)
- [a11y-checklist.md](a11y-checklist.md)

## Métadonnées
- Owner: Frontend + Backend
- Priorité: P0 (bloquant release)
- Risques audit: (aucun direct)
