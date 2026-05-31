# Rules compiler — cœur des audiences & conditions

> Le compilateur `RulesJson → Drizzle SelectQuery` est la pièce
> centrale de M5.3 et M5.5. Cette spec définit le contrat, l'algo et
> les tests requis.

## Contrat

```typescript
// signatures
import type { SQL } from 'drizzle-orm';

export function compileRulesToSql(
  rules: RulesGroup,
  exclusions: ExclusionFlags,
): { where: SQL; joins: SQL[] };

export async function evaluateRulesAgainstUser(
  rules: RulesGroup,
  user: { email: string; leadId?: string },
): Promise<boolean>;
```

## Architecture

```
RulesJson (jsonb)
   │
   ▼
┌─────────────────────────┐
│ Zod validate            │  ← refus si schéma invalide
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Walk AST (récursive)    │  ← traduit chaque Rule en SQL fragment
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Combine AND/OR          │  ← compose les fragments selon RulesGroup.kind
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Append exclusions       │  ← LEFT JOIN email_suppression / consent filter
└────────────┬────────────┘
             │
             ▼
   SQL WHERE + JOINS prêt
```

## Algorithme par type de Rule

### `email_pattern`
```typescript
case 'email_pattern':
  switch (operator) {
    case 'contains': return ilike(leads.email, `%${value}%`);
    case 'starts':   return ilike(leads.email, `${value}%`);
    case 'ends':     return ilike(leads.email, `%${value}`);
    case 'equals':   return eq(leads.email, value);
  }
```

### `order_count`
```typescript
case 'order_count': {
  // requires JOIN with orders aggregation
  // utilise une subquery COUNT
  const since = rule.since ? gte(orders.createdAt, rule.since) : undefined;
  const subq = db.select({
    email: leads.email,
    cnt: sql`COUNT(${orders.id})`.as('cnt'),
  })
  .from(leads)
  .leftJoin(orders, eq(orders.leadId, leads.id))
  .where(and(since))
  .groupBy(leads.email);
  
  return sql`${leads.email} IN (
    SELECT email FROM ${subq} WHERE cnt ${opToSql(rule.operator)} ${rule.value}
  )`;
}
```

### `email_opened`
```typescript
case 'email_opened': {
  // JOIN avec email_event WHERE type='opened'
  const withinFilter = rule.within ? gte(emailEvent.ts, withinToDate(rule.within)) : undefined;
  const templateFilter = rule.templateSlug 
    ? sql`${emailEvent.template} = ${rule.templateSlug}` 
    : undefined;
  return sql`EXISTS (
    SELECT 1 FROM ${emailEvent}
    WHERE ${emailEvent.email} = ${leads.email}
      AND ${emailEvent.type} = 'opened'
      ${withinFilter ? sql`AND ${withinFilter}` : sql``}
      ${templateFilter ? sql`AND ${templateFilter}` : sql``}
  )`;
}
```

### `inactive_since`
```typescript
case 'inactive_since': {
  // user_event GROUP BY email having MAX(ts) < now - N days
  const threshold = sql`now() - interval '${rule.days} days'`;
  return sql`NOT EXISTS (
    SELECT 1 FROM user_event
    WHERE email = ${leads.email}
      AND ts >= ${threshold}
  )`;
}
```

### `has_tag` / `not_has_tag`
```typescript
case 'has_tag':
  return sql`EXISTS (
    SELECT 1 FROM lead_tag
    WHERE lead_id = ${leads.id} AND tag = ${rule.tag}
  )`;
```

## Combinaison RulesGroup

```typescript
function compile(group: RulesGroup): SQL {
  const fragments = group.conditions.map(c => 
    'kind' in c && c.kind in ['all', 'any'] 
      ? compile(c as RulesGroup) 
      : compileRule(c as Rule)
  );
  
  return group.kind === 'all'
    ? and(...fragments)
    : or(...fragments);
}
```

## Exclusions

Toujours appliquées en `AND NOT (suppressed)` :

```typescript
function applyExclusions(base: SQL, flags: ExclusionFlags): SQL {
  const reasons: string[] = [];
  if (flags.hard_bounce) reasons.push('hard_bounce');
  if (flags.unsubscribe) reasons.push('unsubscribe');
  if (flags.manual_suppression) reasons.push('manual_admin');
  
  let result = base;
  if (reasons.length > 0) {
    result = and(result, sql`${leads.email} NOT IN (
      SELECT email FROM email_suppression WHERE reason IN (${sql.join(reasons)})
    )`);
  }
  if (flags.marketing_optout) {
    result = and(result, eq(leads.consentMarketing, true));
  }
  return result;
}
```

## Performance

| Type de rule | Coût relatif | Stratégie |
|---|---|---|
| email_pattern | low | ilike OK (index trigram optionnel) |
| order_count | medium | matview `lead_orders_agg` si volume |
| email_opened | medium-high | index email_event(email, type, ts) |
| inactive_since | medium | index user_event(email, ts) |
| has_tag | low | index lead_tag(tag) |

## Versionning

Chaque RulesJson stocke un champ `version` (default 1). Si la grammaire
évolue, on incrémente, et on supporte les anciennes versions au moins
6 mois (migration auto au save).

## Tests requis

[Tests Jest exhaustifs](../11-tests/01-jest-unit/rules-compiler.test.spec.md).
Branches couvertes ≥ 95%. Inclut :
- Chaque type de rule isolément
- Composition AND/OR
- Composition nested (group dans group)
- Exclusions toutes combinaisons
- Versionning compat
- Edge cases : rules vides, valeurs invalides, dates futures
