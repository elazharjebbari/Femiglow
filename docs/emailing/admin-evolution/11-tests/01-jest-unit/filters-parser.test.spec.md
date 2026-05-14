# Test spec — filters-parser (Cmd-K syntax)

> File: `apps/web/src/lib/mail/transactional/filters-parser.test.ts`

## Scénarios

### Tokens isolés
- `'status:failed'` → `[{ key: 'status', value: 'failed' }]`
- `'to:user@x.y'` → `[{ key: 'to', value: 'user@x.y' }]`
- `'template:cart-*'` → `[{ key: 'template', value: 'cart-*' }]` (glob)
- `'after:2026-05-01'` → date ISO parsed
- `'after:yesterday'` → date relative parsed
- `'after:-7d'` → 7 days ago
- `'attempts:>3'` → `[{ key: 'attempts', operator: '>', value: 3 }]`
- `'has:error'` → `[{ key: 'hasError', value: true }]`

### Combinaisons
- `'status:failed template:cart-*'` → 2 filters AND
- `'status:failed status:bounced_hard'` → 2 filters (l'engine traite ça en OR pour le même key?)
  > Décision : `[failed, bounced_hard]` comme array dans le filter
- Liste séparée par virgule : `'status:failed,bounced_soft'` → array

### Freetext (fallback)
- `'user@example.com'` → freetext='user@example.com' (UI traite comme `to:user@example.com`)
- `'foo'` → freetext='foo'

### Erreurs
- `'status:unknown'` → parse OK mais retourne error `[{ key: 'status', error: 'unknown_value' }]`
- `'attempts:abc'` → error
- `'after:notadate'` → error
- `'malformed::value'` → error sur position du `::`
- vide → `[]`, no error

### Edge cases
- Espaces multiples → ignorés
- Caractères spéciaux dans value (quotes, escapes) :
  - `'to:"user@x.y"'` → quoted value
  - `'template:welcome\\:v2'` → escape `:`
- Casse de la value :
  - `'status:FAILED'` → matched (insensitive sur enum values)
  - `'template:Cart-*'` → kept literal (case-sensitive)

### Précédence
- `'status:failed status:sent'` → l'engine décide (recommandation : array → OR)

## Output type

```typescript
type ParseResult = {
  filters: ParsedFilter[];
  freetext?: string;
  errors?: { position: number; raw: string; message: string }[];
};
```

## Coverage

≥ 90% branches. Chaque type de filter a 3+ scénarios.

## Performance

- Parse < 1ms pour input typique (50 chars)
- Pas d'allocation excessive
