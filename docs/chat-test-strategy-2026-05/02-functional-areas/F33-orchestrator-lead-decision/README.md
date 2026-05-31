# F33 — Lead decision (10 règles)

## 1. Description

### Cible
Décider si le visiteur doit voir une `LeadFormBubble` dans la conversation, sur la base de
10 règles métier appliquées à l'état session + dernier message + réponse assistant.

### Règles (en ordre d'évaluation)

| # | Règle | Trigger reason |
|---|-------|----------------|
| 1 | Demande explicite "rappelez-moi" / "contactez-moi" | `explicit-request` |
| 2 | Téléphone détecté inline dans message user | `inline-contact` |
| 3 | Purchase intent + RAG hit produit pertinent | `purchase-intent` |
| 4 | 2 messages user "frustrés" consécutifs | `frustration` |
| 5 | Assistant émet "dontknow" 2 fois consécutif | `out-of-knowledge` |
| 6 | Engagement (3+ messages) sans achat | `engagement` |
| 7 | Long-no-progress (5+ messages sans intent fort) | `long-no-progress` |
| 8 | After-hours (heure hors 9-19 MA) | `after-hours` |
| 9 | Assistant flag dans reply (`<lead-trigger>` token) | `assistant-trigger` |
| 10 | Default fallback en fin de conversation (timeout) | `closure` |

### Anti-patterns
- Ne pas offrir 2 fois dans la même session (sauf si refus déclaré ?)
- Respecter `chat_runtime_setting.lead_form_enabled` toggle
- Ne pas offrir aux visiteurs déjà convertis (chat_lead.outcome=converted)

### Risque audit
- **M6** — `reason: 'long-no-progress'` ambigu vs `trigger: 'engagement'` (test doit
  vérifier la distinction propre via `LeadFormReason` enum)

## 2. Tests proposés (~18 cas)

### Unit — Chaque règle isolée
```typescript
describe('shouldOfferLeadForm — rule by rule', () => {
  test('rule 1: explicit request "rappelez-moi" returns explicit-request', () => {
    const r = shouldOfferLeadForm({
      lastUserMessage: 'Pouvez-vous me rappeler ?',
      session: chatSessionFactory.build(),
      messageHistory: [],
    });
    expect(r).toEqual({ offer: true, reason: 'explicit-request' });
  });

  test('rule 2: phone inline detected returns inline-contact', () => {
    const r = shouldOfferLeadForm({
      lastUserMessage: 'Mon numéro 0612345678',
      session: chatSessionFactory.build(),
      messageHistory: [],
    });
    expect(r).toEqual({ offer: true, reason: 'inline-contact', prefill: { phone: '0612345678' } });
  });

  test('rule 3: purchase intent + RAG hit returns purchase-intent', () => {
    const r = shouldOfferLeadForm({
      lastUserMessage: 'Je veux commander',
      ragSources: [{ score: 0.85, label: 'kit page' }],
      messageHistory: [],
      session: chatSessionFactory.build(),
    });
    expect(r).toEqual({ offer: true, reason: 'purchase-intent' });
  });

  test('rule 4: 2 frustration messages consecutive', () => {
    const r = shouldOfferLeadForm({
      lastUserMessage: 'Toujours pas !',
      messageHistory: [
        { role: 'user', content: 'ça ne marche pas', frustrationScore: 0.8 },
        { role: 'user', content: 'toujours pas', frustrationScore: 0.9 },
      ],
      session: chatSessionFactory.build(),
    });
    expect(r.offer).toBe(true);
    expect(r.reason).toBe('frustration');
  });

  test('rule 5: dontknow x2 → out-of-knowledge', () => { /* ... */ });
  test('rule 6: engagement >3 messages', () => { /* ... */ });
  test('rule 7: long-no-progress 5+ messages', () => { /* ... */ });
  test('rule 8: after-hours', () => { /* ... */ });
  test('rule 9: assistant trigger token', () => { /* ... */ });
  test('rule 10: closure timeout', () => { /* ... */ });
});

describe('shouldOfferLeadForm — anti-patterns', () => {
  test('does NOT offer twice in same session', () => {
    const session = chatSessionFactory.build();
    const r1 = shouldOfferLeadForm({ /* ... */ session });
    const r2 = shouldOfferLeadForm({ /* ... */ session: { ...session, leadFormOfferedAt: new Date() } });
    expect(r2.offer).toBe(false);
  });

  test('respects lead_form_enabled=false toggle', () => {
    const r = shouldOfferLeadForm({ /* ... */ runtimeSettings: { leadFormEnabled: false } });
    expect(r.offer).toBe(false);
  });

  test('does NOT offer to already-converted visitor', () => {
    const r = shouldOfferLeadForm({ /* ... */ session: chatSessionFactory.converted() });
    expect(r.offer).toBe(false);
  });

  test('REGRESSION M6 — reason="long-no-progress" distinguishable from "engagement"', () => {
    const r1 = shouldOfferLeadForm({ /* engagement criteria */ });
    const r2 = shouldOfferLeadForm({ /* long-no-progress criteria */ });
    expect(r1.reason).toBe('engagement');
    expect(r2.reason).toBe('long-no-progress');
    expect(r1.reason).not.toBe(r2.reason); // explicit distinct enum
  });
});
```

### Custom matcher usage
```typescript
expect(orchestratorResult).toHaveOfferedLeadFormWithReason('purchase-intent');
```

### Integration — Full pipeline
- Send purchase intent message → SSE includes `lead-form-offer` event
- Send frustration message twice → `lead-form-offer` with reason=frustration
- Send neutral message → no lead-form-offer

### E2E
- Visiteur exprime "je veux acheter" → bubble lead form apparaît
- Visiteur tape numéro inline → bubble pré-remplie avec ce numéro
- Visiteur exprime frustration 2× → bubble apparaît avec copy frustration

## 3. Test matrix
18 cas (voir [test-matrix.csv](test-matrix.csv)).

## 4. Risques audit
- M6 (regression test enum distinct)
- F33 ↔ F22 (lead capture endpoint), F11 (lead form UI)

## Métadonnées
- Owner: Backend (règles métier)
- Priorité: P0
