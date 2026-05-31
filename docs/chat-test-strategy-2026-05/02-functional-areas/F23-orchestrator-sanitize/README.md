# F23 — Sanitize PII (orchestrator)

## 1. Description

### Cible
Avant toute persistance, modération ou inclusion dans le prompt LLM, **rédiger** les
informations personnelles identifiables (PII) du visiteur. Garantie RGPD + ne pas leaker
des PII vers OpenAI/Anthropic.

### Patterns détectés (FR + MA)
| Type | Regex | Label remplacement |
|------|-------|---------------------|
| Téléphone MA (06/07) | `(?:\+?212|0)\s?[67]\s?(\d{2}\s?){4}` | `[téléphone]` |
| Téléphone FR | `(?:\+33|0)[1-9](\s?\d{2}){4}` | `[téléphone]` |
| Email | `[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}` | `[email]` |
| IBAN | `[A-Z]{2}\d{2}[A-Z0-9]{11,30}` | `[iban]` |
| CIN MA | `[A-Z]{1,2}\d{4,7}` | `[cni]` |
| CB Visa/Master | `\b(?:\d[ -]*?){13,19}\b` | `[carte]` |

### Comportement
- Application séquentielle (ordre matters → cf. I7 audit pour réordre nécessaire)
- Retourne `{ text, redactions: ['phone', 'email', ...] }`
- Idempotent (sanitize 2× → identique)
- Pure (pas de side-effect)

## 2. Risque audit
**I7** — La regex `phone` actuelle est trop gourmande, capture IBAN/CB/CNI **avant** que
leurs regex spécifiques ne s'exécutent. Le test régression doit prouver le bug, le test
fix doit valider la correction.

## 3. Tests proposés (~15 cas)

### Unit — Détection
```typescript
describe('sanitize', () => {
  test.each([
    // Téléphones MA
    ['Mon numéro : 0612345678', '[téléphone]', 'phone'],
    ['Appelez +212 6 12 34 56 78', '[téléphone]', 'phone'],
    // Email
    ['Contact : leila@example.com', '[email]', 'email'],
    // IBAN — doit être redacté COMME IBAN, pas phone (régression I7)
    ['IBAN FR7630006000011234567890189', '[iban]', 'iban'],
    // CB
    ['Ma carte : 4111 1111 1111 1111', '[carte]', 'carte'],
    // CIN MA
    ['CIN : BK123456', '[cni]', 'cni'],
  ])('redacts "%s" → contains "%s" labeled "%s"', (input, expectedToken, expectedLabel) => {
    const result = sanitize(input);
    expect(result.text).toContain(expectedToken);
    expect(result.redactions).toContain(expectedLabel);
  });

  it('is idempotent', () => {
    const once = sanitize('Tel : 0612345678 Mail : x@y.com');
    const twice = sanitize(once.text);
    expect(twice.text).toBe(once.text);
  });

  it('does NOT redact phone-like numbers in middle of words', () => {
    const result = sanitize('mot1234567890mot');
    expect(result.text).toBe('mot1234567890mot');
  });

  it('handles edge cases — empty/null/long', () => {
    expect(sanitize('').text).toBe('');
    expect(() => sanitize(null as any)).toThrow();
    const long = 'a'.repeat(100_000);
    expect(sanitize(long).text).toBe(long);
  });

  it('REGRESSION I7 — IBAN before phone in pattern order', () => {
    const result = sanitize('IBAN FR7630006000011234567890189');
    expect(result.redactions).toEqual(['iban']);  // NOT ['phone']
    expect(result.redactions).not.toContain('phone');
  });

  it('performance — 1000 sanitize calls in <100ms', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) sanitize('Tel 0612345678 mail x@y.com');
    expect(performance.now() - start).toBeLessThan(100);
  });
});
```

### Integration — En orchestrator
- Le user message persisted contains redacted text (not raw)
- Le prompt LLM contains redacted text
- Les events `chat_pii_redacted` sont émis avec labels (audit trail)

### E2E
- Visiteur tape "Mon tel 0612345678" → admin voit "[téléphone]" en conversation
- Visiteur tape email → admin voit "[email]"

## 4. Custom matcher

```typescript
expect(result.text).toBeRedacted('phone');
expect(result.text).toBeRedacted('iban');
```

## 5. Dataset de test

200 cas dans `test-data.json` :
- Faux positifs (numéros qui ne sont pas téléphones)
- Vrais négatifs (texte sans PII)
- Combinaisons (plusieurs PII dans un message)
- Cas exotiques (zéro-width chars, RTL, emoji)

## 6. Coverage cible

| Métrique | Cible |
|----------|-------|
| Statement | 98 % |
| Branch (chaque pattern) | 95 % |
| Function | 100 % |
| Performance 1000 calls | < 100 ms |

## Métadonnées
- Owner: Backend (sécurité)
- Priorité: P0
- Risques audit: I7
