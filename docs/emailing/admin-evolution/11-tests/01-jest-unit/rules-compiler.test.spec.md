# Test spec — rules-compiler

> Spec exhaustive du fichier de test
> `apps/web/src/lib/mail/audiences/rules-compiler.test.ts`.
> ≥ 95% branch coverage exigé.

## Structure

```typescript
describe('rules-compiler', () => {
  describe('compileRule (single)', () => {
    describe('email_pattern', () => { ... });
    describe('country', () => { ... });
    describe('order_count', () => { ... });
    // ... un describe par rule kind
  });
  describe('compileGroup (composition)', () => { ... });
  describe('applyExclusions', () => { ... });
  describe('integration with mock DB', () => { ... });
});
```

## Scénarios par rule kind

### email_pattern

- `operator: contains, value: '@example.com'` → ILIKE '%@example.com%'
- `operator: starts, value: 'admin'`           → ILIKE 'admin%'
- `operator: ends, value: '@bad.tld'`          → ILIKE '%@bad.tld'
- `operator: equals, value: 'foo@bar.c'`       → exact match
- empty value → throws ValidationError
- value with special chars (%, _) → escaped

### country

- `operator: eq, value: 'MA'` → eq(leads.country, 'MA')
- `operator: in, value: ['MA', 'FR']` → inArray
- empty array → throws

### consent_marketing

- `value: true` → eq(leads.consentMarketing, true)
- `value: false` → eq(false)

### created_at

- `operator: before, value: '2025-01-01'` → lt
- `operator: after, value: '2025-01-01'` → gt
- `operator: between, value: ['2025-01-01', '2025-12-31']` → between
- invalid date → throws

### order_count

- `operator: gte, value: 3` (no since) → subquery COUNT
- `operator: gte, value: 3, since: '2025-01-01'` → subquery COUNT WHERE created_at >= 2025-01-01
- `operator: eq, value: 0` → users sans commande (LEFT JOIN, COUNT=0)
- `operator: between, value: [3, 10]` → COUNT BETWEEN 3 AND 10
- negative value → throws

### order_total

- `operator: gte, value: 100000, currency: 'MAD'` → SUM(total_cents) >= 100000
- Same edge cases que order_count

### has_ordered_product

- `productId: 'XYZ'` → EXISTS subquery
- `productId: 'XYZ', since: '2025-01-01'` → with time filter

### last_order_at

- `operator: within, value: '7d'` → MAX(orders.created_at) >= now - 7d
- `operator: before, value: '2025-01-01'` → MAX(...) < date

### email_opened

- `templateSlug: undefined` → any opened
- `templateSlug: 'welcome', within: '7d'` → opened welcome in last 7d
- `minCount: 3` → COUNT(opened) >= 3

### email_clicked

- Similar à email_opened

### received_without_open

- `threshold: 5, within: '14d'` → received ≥ 5 in 14d AND opened = 0

### inactive_since

- `days: 30` → NOT EXISTS (user_event in last 30d)
- `days: 0` → all users inactive ever (edge)

### session_count

- `operator: gte, value: 3, within: '7d'` → distinct session_id count

### has_tag / not_has_tag

- `tag: 'vip'` → EXISTS / NOT EXISTS in lead_tag

## Composition (RulesGroup)

### Simple AND
```
{ kind: 'all', conditions: [ruleA, ruleB] }
→ A AND B
```

### Simple OR
```
{ kind: 'any', conditions: [ruleA, ruleB] }
→ A OR B
```

### Nested
```
{ kind: 'all', conditions: [
  ruleA,
  { kind: 'any', conditions: [ruleB, ruleC] }
]}
→ A AND (B OR C)
```

### Empty
- `{ kind: 'all', conditions: [] }` → matches ALL users (truthy)
- `{ kind: 'any', conditions: [] }` → matches NONE (falsy)

### Deep nesting
- Profondeur 3 supportée
- Profondeur > 3 → throws ValidationError

## Exclusions

| Config | Effet attendu |
|---|---|
| `hard_bounce: true` | AND email NOT IN suppressions WHERE reason='hard_bounce' |
| `unsubscribe: true` | + reason='unsubscribe' |
| `manual_suppression: true` | + reason='manual_admin' |
| `marketing_optout: true` | AND consentMarketing=true |
| all false | no AND clause |

## Integration tests (avec DB mockée)

Avec `makeFakeDrizzle` :

```typescript
it('returns 0 emails when no user matches', async () => {
  const drizzle = makeFakeDrizzle({ selectResult: [{ count: 0 }] });
  const result = await previewAudienceSize(
    { kind: 'all', conditions: [{ kind: 'order_count', operator: 'gte', value: 999 }]},
    defaultExclusions,
    drizzle,
  );
  expect(result.size).toBe(0);
});

it('handles VIP audience', async () => {
  const drizzle = makeFakeDrizzle({ selectResult: [{ count: 47 }] });
  const result = await previewAudienceSize(VIP_RULES, defaultExclusions, drizzle);
  expect(result.size).toBe(47);
  // assert sur drizzle.calls.select pour vérifier la query
});
```

## Edge cases globaux

- Rules avec champs manquants → Zod validation rejette
- Rules avec types invalides → Zod validation rejette
- Compilation produit du SQL parameterized (pas de string concat)
- Performance : compilation < 100ms pour 20 rules nested

## Anti-patterns à tester

- ✗ SQL injection via value : `'); DROP TABLE leads; --` → escaped
- ✗ XSS dans tag : `<script>` → traité comme string
- ✗ Date du futur en `inactive_since.days` négatif → throws
