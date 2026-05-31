# Conventions de tests — naming, structure, style

Règles uniformes pour que tous les tests soient **lisibles**, **maintenables**, **dignes
d'audit**. Inspiré de Cohn, Beck, et des standards Capgemini / Accenture.

## 1. Naming & emplacement

### 1.1 Emplacement par couche

```
apps/web/src/
├── lib/chat/services/
│   ├── intent.ts
│   └── intent.test.ts                    ← UNIT (colocalisé)
├── lib/chat/services/
│   ├── orchestrator.ts
│   └── orchestrator.integration.test.ts  ← INTEGRATION (suffix explicite)
├── components/chat/
│   ├── ChatPanel.tsx
│   └── ChatPanel.test.tsx                ← COMPONENT (colocalisé)
├── components/chat/
│   ├── ChatLauncher.mobile.test.tsx      ← COMPONENT variante (mobile)
└── test/
    ├── factories/
    ├── matchers/
    └── msw/

apps/web/e2e/
├── chat-visitor-conversation.spec.ts     ← E2E (toujours dans /e2e/)
├── chat-admin-leads.spec.ts
└── smoke-chat.spec.ts                    ← E2E smoke
```

### 1.2 Nommage des fichiers

| Type | Pattern | Exemple |
|------|---------|---------|
| Unit | `<sut>.test.ts` | `intent.test.ts` |
| Integration | `<sut>.integration.test.ts` | `orchestrator.integration.test.ts` |
| Component | `<Component>.test.tsx` | `ChatPanel.test.tsx` |
| Variante | `<Component>.<context>.test.tsx` | `ChatLauncher.mobile.test.tsx` |
| E2E | `<feature>-<persona>-<journey>.spec.ts` | `chat-visitor-conversation.spec.ts` |
| Smoke | `smoke-<area>.spec.ts` | `smoke-chat.spec.ts` |
| Visual | `visual-<feature>.spec.ts` | `visual-chat-panel.spec.ts` |

### 1.3 Nommage des describes et tests

**`describe`** : nom du SUT (System Under Test) — nom de fonction, classe ou composant.

**`it` / `test`** : commence par un verbe à l'infinitif, décrit le **comportement attendu**.

```typescript
// ✅ BON
describe('detectIntent', () => {
  it('returns "purchase-intent" when message contains "commander"', () => {});
  it('falls back to "misc" when no pattern matches', () => {});
  it('weights French synonyms higher than ambiguous keywords', () => {});
});

// ❌ MAUVAIS
describe('intent stuff', () => {
  it('test 1', () => {});       // pas explicite
  it('works', () => {});         // tautologique
  it('should return correctly', () => {}); // pas de cas concret
});
```

### 1.4 Tests table-driven

Pour valider plusieurs cas similaires, utiliser `describe.each` / `test.each`.

```typescript
describe('detectIntent — keyword cases', () => {
  test.each([
    ['commander un kit', 'purchase-intent'],
    ['c\'est combien le pack ?', 'pricing'],
    ['livraison à casablanca ?', 'shipping'],
    ['salam', 'greeting'],
    ['je ne sais pas quoi faire', 'misc'],
  ])('classifies "%s" as %s', (input, expected) => {
    expect(detectIntent(input).intent).toBe(expected);
  });
});
```

## 2. Pattern AAA (Arrange / Act / Assert)

Chaque test doit avoir **3 sections visibles**. Séparer par un saut de ligne.

```typescript
it('persists user message before moderation when configured', async () => {
  // Arrange
  const session = await sessionFactory.build();
  const moderationStub = vi.spyOn(moderation, 'check').mockResolvedValue({ flagged: false });

  // Act
  const result = await orchestrator.handle({
    sessionId: session.id,
    content: 'Hello',
  });

  // Assert
  expect(result.persistedAt).toBeDefined();
  expect(moderationStub).toHaveBeenCalledAfter(messageRepo.insert);
});
```

## 3. Données de test — factories & seeds

### 3.1 Règles d'or

1. **Jamais de littéral dans le test** pour les données métier complexes. Utiliser une factory.
2. **Données déterministes** : seed Faker avec un `faker.seed(42)` au début de chaque suite.
3. **Builder pattern** : `chatSessionFactory.build({ override })`.
4. **Données minimales** : factories avec defaults sensés, override uniquement ce qui matter pour le test.

### 3.2 Catalogue factories (cf. [01-architecture-test/01-data-strategy.md](../01-architecture-test/01-data-strategy.md))

| Factory | Builds | Emplacement |
|---------|--------|-------------|
| `chatSessionFactory` | `ChatSession` row | `apps/web/src/test/factories/chat-session.factory.ts` |
| `chatMessageFactory` | `ChatMessage` row | `chat-message.factory.ts` |
| `chatLeadFactory` | `ChatLead` row | `chat-lead.factory.ts` |
| `chatInstructionFactory` | `ChatInstructionVersion` | `chat-instruction.factory.ts` |
| `chatProviderFactory` | `ChatProviderConfig` | `chat-provider.factory.ts` |
| `intentExampleFactory` | `ChatIntentExample` | `intent-example.factory.ts` |
| `cannedPairFactory` | `ChatCannedPair` | `canned-pair.factory.ts` |
| `faqEntryFactory` | `ChatFaqEntry` | `faq-entry.factory.ts` |
| `knowledgeChunkFactory` | `ChatKnowledgeChunk` | `knowledge-chunk.factory.ts` |
| `cartSnapshotFactory` | Order snapshot (cross-attribution) | `cart-snapshot.factory.ts` |
| `trackingEventFactory` | `chatConversationEvent` | `tracking-event.factory.ts` |

## 4. Mocks — règles strictes

### 4.1 Quand mocker ?

- **TOUJOURS** : appels réseau externes (LLM providers, Slack, webhooks) → MSW
- **PARFOIS** : services trop coûteux à instancier (LLM stream) → stub provider
- **JAMAIS** : domaine sous test, repos avec DB test container, helpers purs

### 4.2 Patterns acceptés

```typescript
// ✅ MSW pour HTTP (le standard)
server.use(
  http.post('https://api.openai.com/v1/chat/completions', () => HttpResponse.json(stub))
);

// ✅ Stub provider LLM via factory
const fakeProvider = createFakeProvider({ chunks: ['Bonjour ', 'visiteur'] });

// ✅ Spy pour observer (sans changer le comportement)
const spy = vi.spyOn(eventRepo, 'append');
```

### 4.3 Patterns interdits

```typescript
// ❌ Mock du SUT
vi.mock('./orchestrator'); // Si on teste l'orchestrator, on ne le mock pas

// ❌ Mock trop large (ex : tout @drizzle-orm)
vi.mock('drizzle-orm'); // Casse les tests intégration DB
```

## 5. Tests UI — règles user-centric

Privilégier `@testing-library` queries **sémantiques** :

| Préférer | Éviter |
|----------|--------|
| `getByRole('button', { name: /commander/i })` | `getByTestId('submit-btn')` |
| `getByLabelText('Numéro de téléphone')` | `getByClassName('phone-input')` |
| `findByText(/livraison gratuite/i)` | `container.querySelector('.disclaimer')` |

`getByTestId` autorisé **uniquement** pour : containers (no role), zones de virtualisation,
hooks de test perf.

### 5.1 Interactions

Utiliser `@testing-library/user-event` (et non `fireEvent`) :

```typescript
const user = userEvent.setup();
await user.click(screen.getByRole('button', { name: /envoyer/i }));
await user.type(screen.getByLabelText(/votre prénom/i), 'Leila');
```

### 5.2 Assertions async

Toujours `findBy*` (qui attend) plutôt que `getBy*` après une action async.

```typescript
// ✅
await user.click(submitButton);
expect(await screen.findByText(/merci leila/i)).toBeVisible();

// ❌
await user.click(submitButton);
expect(screen.getByText(/merci leila/i)).toBeVisible(); // peut throw avant rendu
```

## 6. Tests E2E (Playwright) — règles

### 6.1 Page Object Model

Chaque page admin / vue widget = un POM. Voir [01-architecture-test/03-page-objects-pom.md](../01-architecture-test/03-page-objects-pom.md).

```typescript
// e2e/pom/chat-widget.pom.ts
export class ChatWidgetPOM {
  constructor(public page: Page) {}

  launcher = () => this.page.getByRole('button', { name: /ouvrir le chat/i });
  panel = () => this.page.getByRole('region', { name: /assistant femiglow/i });
  composer = () => this.page.getByRole('textbox', { name: /votre message/i });
  sendButton = () => this.page.getByRole('button', { name: /envoyer/i });

  async open() { await this.launcher().click(); }
  async sendMessage(text: string) {
    await this.composer().fill(text);
    await this.sendButton().click();
  }
}
```

### 6.2 Pas de `waitForTimeout`

Utiliser `waitFor`, `expect(...).toBeVisible()`, network interception, ou `page.waitForResponse`.

### 6.3 Données de test isolées

- Chaque spec crée son propre user/session via `beforeEach` (pas de fixture globale partagée).
- Cleanup via `afterEach` ou setup global de la DB de test.

### 6.4 Selectors stables

Privilégier `getByRole` / `getByLabel`. Si manquant, ajouter `aria-label` au composant
plutôt qu'un `data-testid`. `data-testid` autorisé pour : composants 3rd-party, vues admin
sans rôle naturel.

## 7. Assertions custom

Voir [01-architecture-test/04-matchers-custom.md](../01-architecture-test/04-matchers-custom.md)
pour la liste complète. Examples :

```typescript
expect(message).toBeFromLanguage('ar-MA');
expect(response).toBeStreamedEventOf('chunk');
expect(event).toHaveBeenEmittedToChannel('chat_lead_captured');
expect(latency).toRespectBudget('first-chunk');
```

## 8. Commentaires de tests

- **Pas de commentaire** quand le titre du test est explicite.
- **Commentaire obligatoire** si :
  - Le test couvre un bug spécifique → référence du ticket/PR : `// Regression test for CHA-AUD-07`
  - Comportement contre-intuitif → expliquer le pourquoi : `// FAQ short-circuits moderation — see R2 audit`
  - Workaround → expliquer le contexte : `// Wait 50ms because humanize jitter applies 30-50ms delay`

## 9. Skip / Only — règles strictes

| Directive | Quand l'utiliser | Hard rule |
|-----------|------------------|-----------|
| `.skip()` | Test pour feature non implémentée (référence ADR) | **Doit citer ticket** |
| `.todo()` | Test à écrire | **Linké au backlog** |
| `.only()` | **JAMAIS commit** | CI rejette PR avec `.only` |
| `.failing()` | Test qui DOIT échouer (tracking bug) | À fix dans même PR |

CI hook : `grep -RE "(test|it|describe)\.(only|focus)" src/` → fail si match.

## 10. Snapshots — règles

- Snapshots **petits** (< 50 lignes) — pour markup HTML simple
- Snapshots **inline** (`toMatchInlineSnapshot`) pour string / objet < 5 lignes
- **JAMAIS** snapshots multi-pages — préférer assertions ciblées
- Update snapshot **uniquement** via `vitest -u` après revue manuelle

## 11. Coverage — quoi ne PAS tester

- Types TypeScript purs (interfaces, type guards triviaux)
- Helpers re-export
- Constantes
- Code généré (drizzle migrations…)

Configurer `c8.exclude` en conséquence.

## 12. Performance des tests

- Suite unit complète : < 5 s
- Suite integration : < 30 s
- Suite component : < 1 min
- Suite E2E full : < 20 min

Si seuil dépassé, profiler avec `vitest --reporter verbose --logHeapUsage`.
