# F27 — Moderation pipeline

## 1. Description

### Cible
Filtrer le contenu user (inbound, **bloquant**) et la réponse assistant (outbound, **doit
être bloquant aussi**, cf. C2 audit). Source : OpenAI Moderation API + heuristiques locales.

### Comportement attendu (cible POST-FIX C2)
1. **Inbound** : avant tout processing → moderation API → si flagged → STOP, émettre event
   `chunk` avec scripted refusal + event `end`, persister le message user avec status
   `blocked_input`, émettre event KPI `chat_moderation_inbound_flagged`.
2. **Outbound** : **AVANT** yield au client → buffer la réponse complète → moderation API →
   si flagged → émettre event `chunk` avec message générique + event `end`, marquer message
   assistant `blocked_output`, NE PAS yielder la réponse originale.

### État actuel (audit C2)
Outbound est **advisory** : réponse déjà streamée au client avant le check. Test régression
doit prouver le bug (FAIL avant fix, PASS après).

## 2. Tests proposés (~15 cas)

### Unit — Heuristiques locales
- Liste de mots blocklist FR (insultes, slurs)
- Liste de mots blocklist AR (darija + arabe classique)
- Whitelist (mots ambigus contextuels)
- Pas de faux positif sur termes médicaux courants ("règles", "période", etc.)

### Integration — Inbound bloquant
```typescript
it('blocks inbound flagged content immediately', async () => {
  server.use(http.post('https://api.openai.com/v1/moderations',
    () => HttpResponse.json({ results: [{ flagged: true, categories: { hate: true } }] })));

  const events: any[] = [];
  for await (const e of orchestrator.handle({ sessionId, content: 'awful text' })) {
    events.push(e);
  }

  expect(events.find((e) => e.event === 'chunk')?.data.text).toMatch(/désolée|refuse/i);
  expect(events.find((e) => e.event === 'end')).toBeDefined();
  expect(events.find((e) => e.event === 'message_complete')).toBeUndefined(); // C5
  expect(eventRepo.append).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'chat_moderation_inbound_flagged' }),
  );
});
```

### Integration — Outbound bloquant (POST-FIX C2)
```typescript
it('REGRESSION C2 — buffers LLM response before yielding, blocks if flagged', async () => {
  // Stub provider with toxic content
  server.use(http.post('https://api.openai.com/v1/chat/completions',
    () => new HttpResponse(makeSseStream(['Toxic content here']), {
      headers: { 'Content-Type': 'text/event-stream' },
    })));

  // Moderation flags outbound
  let modCalls = 0;
  server.use(http.post('https://api.openai.com/v1/moderations', () => {
    modCalls++;
    // 1st call = inbound (safe), 2nd call = outbound (flagged)
    const flagged = modCalls === 2;
    return HttpResponse.json({ results: [{ flagged }] });
  }));

  const events: any[] = [];
  for await (const e of orchestrator.handle({ sessionId, content: 'innocent question' })) {
    events.push(e);
  }

  // CRITICAL: the toxic content must NOT be in the yielded chunks
  const chunkEvents = events.filter((e) => e.event === 'chunk');
  const totalText = chunkEvents.map((e) => e.data.text).join('');
  expect(totalText).not.toContain('Toxic content here');
  expect(totalText).toMatch(/désolée|technique/i); // generic safe reply
});
```

### Integration — Async non-bloquant (état actuel C2)
**Test négatif documenté** : marque le bug actuel pour suivi.
```typescript
it.fails('CURRENT BUG — outbound moderation is post-stream (FIX C2 required)', async () => {
  // Test qui DOIT échouer pour signaler que C2 n'est pas fixé
  // À supprimer une fois C2 livré
});
```

### Integration — FAQ branch hors moderation (R2)
```typescript
it('REGRESSION R2 — FAQ gateway also runs inbound moderation', async () => {
  // Setup: FAQ entry that matches toxic + benign keywords
  await seedFaqEntry({ key: 'q1', questionCanonical: 'comment livraison?' });

  server.use(http.post('https://api.openai.com/v1/moderations',
    () => HttpResponse.json({ results: [{ flagged: true }] })));

  const events: any[] = [];
  for await (const e of orchestrator.handle({ sessionId, content: 'F***ing livraison?' })) {
    events.push(e);
  }

  // FAQ should NOT serve the canned reply if message is flagged
  expect(events.find((e) => e.event === 'chunk')?.data.text).toMatch(/désolée/i);
});
```

### E2E
```typescript
test('@critical visitor sending hate speech receives refusal', async ({ page }) => {
  await page.goto('/kit');
  const widget = new ChatWidgetPOM(page);
  await widget.open();
  await widget.sendMessage('I hate [slur]');
  await widget.waitForAssistantReply();

  const reply = await widget.lastAssistantMessage().textContent();
  expect(reply).toMatch(/désolée|refus|inappropriée/i);
});
```

## 3. Test matrix

15 cas (voir [test-matrix.csv](test-matrix.csv)).

## 4. Risques audit
- **C2** — outbound advisory → test régression
- **R2** — FAQ branch hors moderation → test régression

## Métadonnées
- Owner: Backend (sécurité éditoriale)
- Priorité: P0
- Bloquant release: yes
