# F53 — Multilingue (FR / AR / AR-MA) — cohérence cross-cutting

## 1. Description

### Cible
Garantir la cohérence multilingue sur **tout** le système : UI widget, UI admin, prompts
LLM, réponses canned, FAQ, copy emails, validations form, dates, devises.

### Locales supportées
- `fr-MA` (par défaut) — Français Maroc
- `ar` — Arabe classique (formel)
- `ar-MA` — Darija (arabe marocain dialectal)

### Détection
- `Accept-Language` header en SSR initial
- Cookie `chat_language`
- Heuristique mots-clés dans premier message (`apps/web/src/lib/chat/lang/detect.ts`)
- Override manuel via switcher

### Distinguishing AR vs AR-MA
Mots-clés darija : `khoubz, wakha, khoya, daba, ach, ki dayer, salam labas, drari, brit,
sma3i, hsab, kima, mzyan, bzaf, kanbghi, dyali, hatta`

## 2. Tests proposés (~22 cas)

### Unit — Détection langue
```typescript
describe('detectLanguage', () => {
  test.each([
    ['Bonjour, comment ça va ?', 'fr-MA'],
    ['كيف الحال', 'ar'],
    ['Salam labas, kim daba ?', 'ar-MA'],
    ['ash khabarek khoya', 'ar-MA'],
    ['', 'fr-MA'], // default
    ['Hello world', 'fr-MA'], // anglais → default
  ])('detects "%s" as %s', (text, expected) => {
    expect(detectLanguage(text)).toBe(expected);
  });

  it('respects user override over heuristic', () => {
    expect(detectLanguage('Bonjour', { override: 'ar' })).toBe('ar');
  });
});
```

### Unit — Dictionary FR/AR/AR-MA
```typescript
describe('chat dictionary', () => {
  it('has translation for every key in 3 languages', () => {
    const keysFr = Object.keys(DICTIONARY.fr);
    const keysAr = Object.keys(DICTIONARY.ar);
    const keysArMa = Object.keys(DICTIONARY['ar-MA']);
    expect(keysFr.sort()).toEqual(keysAr.sort());
    expect(keysFr.sort()).toEqual(keysArMa.sort());
  });

  it('logs warning + returns key when unknown', () => {
    const warn = vi.spyOn(console, 'warn');
    expect(t('unknown.key', 'fr-MA')).toBe('unknown.key');
    expect(warn).toHaveBeenCalled();
  });
});
```

### Integration — Instructions prompts
```typescript
describe('chat instructions by language', () => {
  it('loads active instruction matching session language', async () => {
    await seedInstructions([
      { id: 'i_fr', language: 'fr-MA', active: true },
      { id: 'i_ar', language: 'ar', active: true },
    ]);
    const session = chatSessionFactory.arabic();
    const instr = await pickInstructionByLang(session.language);
    expect(instr.id).toBe('i_ar');
  });

  it('falls back to fr-MA when no instruction for ar-MA', async () => {
    await seedInstructions([{ id: 'i_fr', language: 'fr-MA', active: true }]);
    const instr = await pickInstructionByLang('ar-MA');
    expect(instr.language).toBe('fr-MA'); // fallback
  });
});
```

### Integration — FAQ matching par langue
```typescript
it('FAQ matches embeddings filtered by language', async () => {
  await seedFaqEntries([
    faqEntryFactory.build({ language: 'fr-MA', questionCanonical: 'Combien ?' }),
    faqEntryFactory.build({ language: 'ar-MA', questionCanonical: 'بشحال ؟' }),
  ]);
  const r = await faqRepo.matchByEmbedding('بشحال هاد الكيت', 'ar-MA');
  expect(r?.language).toBe('ar-MA');
});
```

### Component — UI RTL
```typescript
it('renders panel with dir=rtl for ar-MA', () => {
  const { container } = render(
    <ChatPanel session={chatSessionFactory.darija()} />,
  );
  const panel = container.querySelector('[role="region"]');
  expect(panel?.getAttribute('dir')).toBe('rtl');
  expect(panel?.getAttribute('lang')).toBe('ar-MA');
});

it('renders panel with dir=ltr for fr-MA', () => {
  const { container } = render(
    <ChatPanel session={chatSessionFactory.build()} />,
  );
  expect(container.querySelector('[role="region"]')?.getAttribute('dir')).toBe('ltr');
});

it('icons mirror in RTL (chevron, arrow)', () => {
  const { container } = render(<ChatPanel session={chatSessionFactory.darija()} />);
  const chevron = container.querySelector('[data-icon="chevron"]');
  expect(chevron?.classList.toString()).toMatch(/rtl:flip|scale-x-[-]1/);
});
```

### E2E — Parcours multilingue
```typescript
test('@multilang @critical visitor in ar-MA sees darija reply', async ({ page }) => {
  await page.goto('/kit', { /* locale: ar-MA */ });
  const widget = new ChatWidgetPOM(page);
  await widget.open();
  await widget.sendMessage('Salam, bshhal had le kit ?');
  await widget.waitForAssistantReply();

  const reply = await widget.lastAssistantMessage().textContent();
  // Vérifie que la réponse contient des mots darija
  expect(reply).toMatch(/wakha|daba|kit|3afak|tfadli/i);
});

test('@multilang admin instructions FR/AR/AR-MA are independent versions', async ({ page }) => {
  await loginAsAdmin(page);
  const adminInstr = new AdminInstructionsListPOM(page);
  await adminInstr.goto();
  await expect(adminInstr.row({ language: 'fr-MA' })).toBeVisible();
  await expect(adminInstr.row({ language: 'ar' })).toBeVisible();
  await expect(adminInstr.row({ language: 'ar-MA' })).toBeVisible();
});
```

### Visual regression
```typescript
test('@visual chat panel rtl ar-MA', async ({ page }) => {
  await page.goto('/kit?lang=ar-MA');
  const widget = new ChatWidgetPOM(page);
  await widget.open();
  await expect(widget.panel()).toHaveScreenshot('panel-rtl-ar-ma.png');
});
```

## 3. Risques
- Faille i18n → mauvaise traduction visible
- Mix FR/AR dans un même message (vulgarité possible)
- RTL mal géré → layout cassé
- Embeddings AR mal calibrés → FAQ ne match jamais en AR

## 4. Coverage cible
- Dictionary key coverage : 100 % (3 langues)
- Heuristique darija : précision > 90 % sur dataset 100 phrases
- RTL layout : 0 regression visuelle
- Pipeline e2e par langue : OK

## Métadonnées
- Owner: Both (cross-cutting)
- Priorité: P0
- Bloquant release: yes (marché MA critique)
