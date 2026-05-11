# 08 — Catalogue Vitest (Jest-compatible) — tests unitaires atomiques

Catalogue exhaustif des tests unitaires à écrire, classés par module testé. Chaque test est nommé, son intention décrite, son setup et ses assertions principales sont indiqués.

> Vitest est utilisé dans le projet (API compatible Jest). Les exemples utilisent Vitest. Les patterns sont transposables à Jest tel quel.

## 1. `lib/schemas/rituals.ts`

Fichier : `apps/web/src/lib/schemas/__tests__/rituals.test.ts`

### 1.1 RitualSignalSchema

```ts
describe('RitualSignalSchema', () => {
  it.each(['oui', 'hesite', 'non'])('accepte "%s"', (v) => {
    expect(RitualSignalSchema.parse(v)).toBe(v);
  });
  it('rejette "maybe"', () => {
    expect(() => RitualSignalSchema.parse('maybe')).toThrow();
  });
});
```

### 1.2 RitualTagSchema

```ts
describe('RitualTagSchema', () => {
  it('accepte tous les tags du catalogue', () => {
    for (const tag of ['ongles-plus-lisses', 'plaque-souple', ...]) {
      expect(() => RitualTagSchema.parse(tag)).not.toThrow();
    }
  });
  it('rejette un tag inconnu', () => {
    expect(() => RitualTagSchema.parse('miracle')).toThrow();
  });
});
```

### 1.3 RitualTestimonialSubmit

```ts
describe('RitualTestimonialSubmit', () => {
  const valid = { productKey: 'pack-femiglow', body: 'a'.repeat(50), wouldRecommend: 'oui' };

  it('accepte un payload minimal', () => expect(() => RitualTestimonialSubmit.parse(valid)).not.toThrow());
  it('rejette si body < 50 chars', () => expect(() => RitualTestimonialSubmit.parse({ ...valid, body: 'x' })).toThrow());
  it('rejette si body > 600 chars', () => expect(() => RitualTestimonialSubmit.parse({ ...valid, body: 'a'.repeat(601) })).toThrow());
  it('rejette si productKey vide', () => expect(() => RitualTestimonialSubmit.parse({ ...valid, productKey: '' })).toThrow());
  it('accepte ritualTags max 3', () => expect(() => RitualTestimonialSubmit.parse({ ...valid, ritualTags: ['ongles-plus-lisses', 'plaque-souple', 'halal'] })).not.toThrow());
  it('rejette 4 ritualTags', () => expect(() => RitualTestimonialSubmit.parse({ ...valid, ritualTags: ['a', 'b', 'c', 'd'] })).toThrow());
  it('accepte 0 photos', () => expect(() => RitualTestimonialSubmit.parse({ ...valid, photos: [] })).not.toThrow());
  it('rejette 4 photos', () => expect(() => RitualTestimonialSubmit.parse({ ...valid, photos: [p, p, p, p] })).toThrow());
  it('rejette photo > 5 Mo', () => expect(() => RitualTestimonialSubmit.parse({ ...valid, photos: [{ ...p, byteSize: 6_000_000 }] })).toThrow());
  it('accepte initiatedSince valide', () => expect(() => RitualTestimonialSubmit.parse({ ...valid, initiatedSince: '2026-02' })).not.toThrow());
  it('rejette initiatedSince mauvais format', () => expect(() => RitualTestimonialSubmit.parse({ ...valid, initiatedSince: '2026/02' })).toThrow());
  it('autoFlags absent dans le payload submit', () => expect(RitualTestimonialSubmit.parse(valid)).not.toHaveProperty('autoFlags'));
});
```

## 2. `lib/rituals/sanitize-body.ts`

Fichier : `apps/web/src/lib/rituals/__tests__/sanitize-body.test.ts`

```ts
describe('sanitizeBody', () => {
  it('retourne le texte tel quel si rien à corriger', () => {
    const { sanitized, flags } = sanitizeBody('Trois mois et l’ongle a retrouvé sa nervure.');
    expect(sanitized).toBe('Trois mois et l’ongle a retrouvé sa nervure.');
    expect(flags).toEqual([]);
  });

  it('strip un emoji simple', () => {
    const { sanitized, flags } = sanitizeBody('Très bien 😊');
    expect(sanitized).toBe('Très bien');
    expect(flags).toContain('emoji_detected');
  });

  it('strip plusieurs emojis', () => {
    const { sanitized } = sanitizeBody('🌸 paste 💅 powder ✨');
    expect(sanitized).toBe('paste  powder');
  });

  it('convertit apostrophe droite en courbe', () => {
    const { sanitized } = sanitizeBody("l'ongle");
    expect(sanitized).toBe('l’ongle');
  });

  it('respecte une apostrophe déjà courbe', () => {
    const { sanitized } = sanitizeBody('l’ongle');
    expect(sanitized).toBe('l’ongle');
  });

  it('ajoute espace fine avant ponctuation forte', () => {
    const { sanitized } = sanitizeBody('bonjour: c\'est ?');
    expect(sanitized).toContain('bonjour : c’est ?');
  });

  it('trim leading/trailing', () => {
    const { sanitized } = sanitizeBody('  texte  ');
    expect(sanitized).toBe('texte');
  });

  it('collapse spaces multiples', () => {
    const { sanitized } = sanitizeBody('mot   mot');
    expect(sanitized).toBe('mot mot');
  });

  it('Unicode NFC normalisation', () => {
    const { sanitized } = sanitizeBody('éclat'); // é décomposé
    expect(sanitized).toBe('éclat');
  });

  it('emoji_detected flag absent si pas d’emoji', () => {
    const { flags } = sanitizeBody('Aucun emoji ici.');
    expect(flags).not.toContain('emoji_detected');
  });
});
```

## 3. `lib/rituals/auto-flags.ts`

Fichier : `apps/web/src/lib/rituals/__tests__/auto-flags.test.ts`

```ts
describe('detectAutoFlags', () => {
  it('détecte link_external https', async () => {
    const flags = await detectAutoFlags('voir https://exemple.com pour plus');
    expect(flags).toContain('link_external');
  });

  it('détecte link_external www', async () => {
    const flags = await detectAutoFlags('voir www.exemple.com');
    expect(flags).toContain('link_external');
  });

  it('détecte email_in_body', async () => {
    const flags = await detectAutoFlags('contactez moi a test@exemple.com');
    expect(flags).toContain('email_in_body');
  });

  it('détecte phone_in_body au format Maroc', async () => {
    const flags = await detectAutoFlags('mon numéro +212600000000');
    expect(flags).toContain('phone_in_body');
  });

  it('détecte body_short', async () => {
    const flags = await detectAutoFlags('court');
    expect(flags).toContain('body_short');
  });

  it('détecte body_long', async () => {
    const flags = await detectAutoFlags('a'.repeat(550));
    expect(flags).toContain('body_long');
  });

  it('détecte all_caps si > 50%', async () => {
    const flags = await detectAutoFlags('JE RECOMMANDE VRAIMENT ce rituel');
    expect(flags).toContain('all_caps');
  });

  it('ne détecte pas all_caps si normal', async () => {
    const flags = await detectAutoFlags('Je recommande vraiment ce rituel');
    expect(flags).not.toContain('all_caps');
  });

  it('détecte repetition 5+ char', async () => {
    const flags = await detectAutoFlags('Wahouuuuuu c’était bien');
    expect(flags).toContain('repetition');
  });

  it('détecte forbidden_word depuis app_config', async () => {
    vi.mocked(getForbiddenWords).mockResolvedValue(['miracle']);
    const flags = await detectAutoFlags('c’est un vrai miracle');
    expect(flags).toContain('forbidden_word');
  });

  it('combine plusieurs flags', async () => {
    const flags = await detectAutoFlags('VISITEZ https://spam.fr c’est incroyable !!!');
    expect(flags).toEqual(expect.arrayContaining(['link_external', 'all_caps']));
  });
});
```

## 4. `lib/rituals/customer-hash.ts`

```ts
describe('hashCustomer', () => {
  it('hash est déterministe pour même email', () => {
    const h1 = hashCustomer('test@example.com');
    const h2 = hashCustomer('test@example.com');
    expect(h1).toBe(h2);
  });

  it('hash diffère pour emails différents', () => {
    expect(hashCustomer('a@example.com')).not.toBe(hashCustomer('b@example.com'));
  });

  it('hash insensible à la casse de l’email', () => {
    expect(hashCustomer('Test@Example.com')).toBe(hashCustomer('test@example.com'));
  });

  it('hash trim les espaces', () => {
    expect(hashCustomer(' test@example.com ')).toBe(hashCustomer('test@example.com'));
  });

  it('hash SHA-256 hex de 64 caractères', () => {
    const h = hashCustomer('a@b.com');
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

## 5. `lib/rituals/email-tokens.ts`

```ts
describe('generateEmailToken / decodeEmailToken', () => {
  const payload = {
    orderId: 'order-123',
    customerHash: 'abc123',
    issuedAt: 1715000000000,
    expiresAt: 1717592000000,
  };

  it('encode / decode roundtrip', () => {
    const token = generateEmailToken(payload);
    const decoded = decodeEmailToken(token);
    expect(decoded).toMatchObject(payload);
  });

  it('rejette token signé avec un autre secret', () => {
    process.env.RITUAL_EMAIL_SECRET = 'secret1';
    const token = generateEmailToken(payload);
    process.env.RITUAL_EMAIL_SECRET = 'secret2';
    expect(() => decodeEmailToken(token)).toThrow('Invalid signature');
  });

  it('rejette token expiré', () => {
    const expired = { ...payload, expiresAt: Date.now() - 1000 };
    const token = generateEmailToken(expired);
    expect(() => decodeEmailToken(token)).toThrow('Token expired');
  });

  it('rejette token malformé', () => {
    expect(() => decodeEmailToken('garbage')).toThrow();
  });
});
```

## 6. `lib/rituals/vision-ml-faces.ts`

```ts
import fs from 'fs';
import path from 'path';

const fixturesDir = path.join(__dirname, 'fixtures');

describe('checkFaces', () => {
  it('OK sur mains uniquement', async () => {
    const buf = fs.readFileSync(path.join(fixturesDir, 'hands-only.jpg'));
    const result = await checkFaces(buf);
    expect(result.status).toBe('OK');
    expect(result.facesCount).toBe(0);
  });

  it('REJECTED_FACE sur visage frontal', async () => {
    const buf = fs.readFileSync(path.join(fixturesDir, 'face-frontal.jpg'));
    const result = await checkFaces(buf);
    expect(result.status).toBe('REJECTED_FACE');
    expect(result.facesCount).toBeGreaterThanOrEqual(1);
  });

  it('MANUAL_REVIEW sur hijab (visage partiel)', async () => {
    const buf = fs.readFileSync(path.join(fixturesDir, 'face-partial-hijab.jpg'));
    const result = await checkFaces(buf);
    expect(result.status).toBe('MANUAL_REVIEW');
  });

  it('MANUAL_REVIEW sur sourire (lèvres visibles, pas de regard)', async () => {
    const buf = fs.readFileSync(path.join(fixturesDir, 'face-partial-smile.jpg'));
    const result = await checkFaces(buf);
    expect(result.status).toBe('MANUAL_REVIEW');
  });

  it('timeout retourne MANUAL_REVIEW', async () => {
    const result = await checkFaces(Buffer.alloc(0), 1);
    expect(result.status).toBe('MANUAL_REVIEW');
  });

  it('photo corrompue retourne MANUAL_REVIEW', async () => {
    const buf = fs.readFileSync(path.join(fixturesDir, 'corrupted.jpg'));
    const result = await checkFaces(buf);
    expect(result.status).toBe('MANUAL_REVIEW');
  });
});
```

## 7. `lib/db/queries/rituals.ts`

Fichier : `apps/web/src/lib/db/queries/__tests__/rituals.test.ts` (utilise test DB).

```ts
describe('listRituals', () => {
  beforeEach(async () => {
    await truncateTables(['ritual_testimonials', 'ritual_testimonial_photos']);
  });

  it('retourne 12 témoignages par défaut', async () => {
    for (let i = 0; i < 15; i++) {
      await insertRitual(testDb, makeRitualFixture({ status: 'APPROVED' }));
    }
    const result = await listRituals({ productKey: 'pack-femiglow' });
    expect(result.items).toHaveLength(12);
    expect(result.hasMore).toBe(true);
  });

  it('respecte la limite', async () => {
    for (let i = 0; i < 5; i++) await insertRitual(testDb, makeRitualFixture({ status: 'APPROVED' }));
    const result = await listRituals({ productKey: 'pack-femiglow', limit: 3 });
    expect(result.items).toHaveLength(3);
  });

  it('exclut les PENDING', async () => {
    await insertRitual(testDb, makeRitualFixture({ status: 'PENDING' }));
    await insertRitual(testDb, makeRitualFixture({ status: 'APPROVED' }));
    const result = await listRituals({ productKey: 'pack-femiglow' });
    expect(result.items).toHaveLength(1);
  });

  it('filtre with_photos', async () => {
    const a = await insertRitual(testDb, makeRitualFixture({ status: 'APPROVED' }));
    const b = await insertRitual(testDb, makeRitualFixture({ status: 'APPROVED' }));
    await insertPhoto(testDb, b.id, { facesStatus: 'OK' });
    const result = await listRituals({ productKey: 'pack-femiglow', withPhotos: true });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].publicSlug).toBe(b.publicSlug);
  });

  it('filtre par tag halal', async () => {
    await insertRitual(testDb, makeRitualFixture({ status: 'APPROVED', ritualTags: ['ongles-plus-lisses'] }));
    await insertRitual(testDb, makeRitualFixture({ status: 'APPROVED', ritualTags: ['halal'] }));
    const result = await listRituals({ productKey: 'pack-femiglow', tags: ['halal'] });
    expect(result.items).toHaveLength(1);
  });

  it('pagine via cursor stable', async () => {
    for (let i = 0; i < 15; i++) await insertRitual(testDb, makeRitualFixture({ status: 'APPROVED' }));
    const p1 = await listRituals({ productKey: 'pack-femiglow', limit: 5 });
    const p2 = await listRituals({ productKey: 'pack-femiglow', limit: 5, cursor: decodeCursor(p1.nextCursor!) });
    const intersection = p1.items.map(i => i.publicSlug).filter(s => p2.items.map(i => i.publicSlug).includes(s));
    expect(intersection).toHaveLength(0);
  });

  it('tri publishedAt desc par défaut', async () => {
    const old = await insertRitual(testDb, makeRitualFixture({ status: 'APPROVED', publishedAt: new Date('2026-01-01') }));
    const recent = await insertRitual(testDb, makeRitualFixture({ status: 'APPROVED', publishedAt: new Date('2026-05-01') }));
    const result = await listRituals({ productKey: 'pack-femiglow' });
    expect(result.items[0].publicSlug).toBe(recent.publicSlug);
  });
});

describe('insertRitual', () => {
  it('génère un publicSlug unique 8 chars', async () => {
    const r = await insertRitual(testDb, makeRitualFixture());
    expect(r.publicSlug).toMatch(/^[a-z0-9]{8}$/);
  });

  it('default status PENDING', async () => {
    const r = await insertRitual(testDb, makeRitualFixture());
    expect(r.status).toBe('PENDING');
  });
});

describe('updateRitualStatus', () => {
  it('approve update status et publishedAt', async () => {
    const r = await insertRitual(testDb, makeRitualFixture());
    const updated = await updateRitualStatus(r.id, 'approve', 'admin-1');
    expect(updated.status).toBe('APPROVED');
    expect(updated.publishedAt).toBeTruthy();
  });

  it('insère audit log', async () => {
    const r = await insertRitual(testDb, makeRitualFixture());
    await updateRitualStatus(r.id, 'approve', 'admin-1');
    const log = await listAuditEvents(r.id);
    expect(log.some(e => e.action === 'approved')).toBe(true);
  });
});

describe('refreshRitualAggregate', () => {
  it('agrège correctement les compteurs', async () => {
    await insertRitual(testDb, makeRitualFixture({ status: 'APPROVED', wouldRecommend: 'oui' }));
    await insertRitual(testDb, makeRitualFixture({ status: 'APPROVED', wouldRecommend: 'oui' }));
    await insertRitual(testDb, makeRitualFixture({ status: 'APPROVED', wouldRecommend: 'hesite' }));
    await refreshRitualAggregate();
    const summary = await getRitualSummary('pack-femiglow');
    expect(summary.totalCount).toBe(3);
    expect(summary.ouiCount).toBe(2);
    expect(summary.hesiteCount).toBe(1);
  });
});
```

## 8. Composant `RitualCard`

Cf. exemples détaillés dans `05-frontend-plan-action.md § 4.3`. Tests à écrire :

- ✓ rend la citation
- ✓ rend la signature avec nom et ville
- ✓ rend la signature anonyme si isAnonymous
- ✓ rend les tags choisis séparés par `·`
- ✓ affiche le badge « Reviendrait » si signal oui
- ✓ masque le badge si signal hesite ou non
- ✓ pas de photo si data.photos vide
- ✓ photo cliquable si présente
- ✓ variant compact vs default
- ✓ axe-core passe
- ✓ data-testid présents

## 9. Composant `RitualsModule`

```ts
describe('RitualsModule', () => {
  it('rend 3 cards et le lien', () => {
    render(<RitualsModule summary={summaryFixture} cards={makeRitualListFixture(3)} />);
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByRole('link', { name: /Lire les 26 rituels/ })).toBeInTheDocument();
  });

  it('singularise template si totalCount = 1', () => {
    render(<RitualsModule summary={{ totalCount: 1, ouiCount: 1 }} cards={[card]} />);
    expect(screen.getByText(/Une initiée a partagé/)).toBeInTheDocument();
  });

  it('empty state si totalCount = 0', () => {
    render(<RitualsModule summary={{ totalCount: 0 }} cards={[]} />);
    expect(screen.getByText(/La maison écoute/)).toBeInTheDocument();
  });

  it('axe-core', async () => {
    const { container } = render(<RitualsModule summary={summaryFixture} cards={makeRitualListFixture(3)} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

## 10. Composant `RitualsWallFilters`

```ts
describe('RitualsWallFilters', () => {
  it('rend 4 chips', () => {
    render(<RitualsWallFilters value={{}} onChange={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: /Tous|Avec photos|Halal|Récents/ })).toHaveLength(4);
  });

  it('Tous est actif par défaut', () => {
    render(<RitualsWallFilters value={{}} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Tous' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('click chip appelle onChange', async () => {
    const onChange = vi.fn();
    render(<RitualsWallFilters value={{}} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Avec photos' }));
    expect(onChange).toHaveBeenCalledWith({ withPhotos: true });
  });

  it('seul un filtre actif à la fois', async () => {
    const { rerender } = render(<RitualsWallFilters value={{ withPhotos: true }} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Avec photos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Tous' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('scroll horizontal mobile', () => {
    // Test via styles computed ou via data-attribute
  });
});
```

## 11. Composant `Step1Voice` du wizard

Cf. `05-frontend-plan-action.md § 7.3`. Tests à écrire (rappel) :

- ✓ compteur de mots évolue
- ✓ emoji retiré + toast
- ✓ bouton Continuer disabled si body < 50 chars
- ✓ bouton Continuer enabled si body OK et signal choisi
- ✓ click Soumettre tel quel appelle onSubmitNow
- ✓ click Continuer appelle onContinue
- ✓ états signal radio
- ✓ axe-core

## 12. Composant `Step2Details`

```ts
describe('Step2Details', () => {
  it('rend 9 checkboxes tags', () => {
    render(<Step2Details {...defaultProps} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(9);
  });

  it('disabled le 4ᵉ tag après 3 cochés', async () => {
    render(<Step2Details {...defaultProps} state={{ ritualTags: [] }} />);
    await userEvent.click(screen.getByLabelText('Ongles plus lisses'));
    await userEvent.click(screen.getByLabelText('Plaque souple'));
    await userEvent.click(screen.getByLabelText('Cuticules apaisées'));
    expect(screen.getByLabelText('Plus de casse')).toBeDisabled();
  });

  it('upload photo trop grande → message d’erreur', async () => {
    render(<Step2Details {...defaultProps} />);
    const file = new File([new Array(6_000_000).fill('x').join('')], 'big.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/Glisser ou choisir/);
    await userEvent.upload(input, file);
    expect(await screen.findByText(/Votre photo est généreuse/)).toBeInTheDocument();
  });

  it('axe-core', async () => {
    const { container } = render(<Step2Details {...defaultProps} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

## 13. Composant `Step3Signature`

```ts
describe('Step3Signature', () => {
  it('rend 4 champs', () => {
    render(<Step3Signature {...defaultProps} />);
    expect(screen.getByLabelText(/Prénom/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ville/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mois/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Année/)).toBeInTheDocument();
  });

  it('pré-remplit depuis emailToken', () => {
    render(<Step3Signature {...defaultProps} prefilled={{ firstName: 'Amal', city: 'Rabat' }} />);
    expect(screen.getByLabelText(/Prénom/)).toHaveValue('Amal');
    expect(screen.getByLabelText(/Ville/)).toHaveValue('Rabat');
  });

  it('anonymat coché → preview signature change', async () => {
    render(<Step3Signature {...defaultProps} state={{ authorFirstName: 'Amal', authorCity: 'Rabat' }} />);
    await userEvent.click(screen.getByLabelText(/Signer anonymement/));
    expect(screen.getByText(/Une initiée, Rabat/)).toBeInTheDocument();
  });
});
```

## 14. Hooks

### 14.1 `useDraftStorage`

```ts
describe('useDraftStorage', () => {
  beforeEach(() => localStorage.clear());

  it('saveDraft écrit en localStorage', () => {
    const { result } = renderHook(() => useDraftStorage());
    act(() => result.current.save({ body: 'test' }));
    expect(localStorage.getItem('ritual-draft-v1')).toContain('"body":"test"');
  });

  it('hasDraft true si brouillon < 7 j', () => {
    localStorage.setItem('ritual-draft-v1', JSON.stringify({ body: 't', timestamp: Date.now() - 86400000 }));
    const { result } = renderHook(() => useDraftStorage());
    expect(result.current.hasDraft).toBe(true);
  });

  it('hasDraft false si brouillon > 7 j', () => {
    localStorage.setItem('ritual-draft-v1', JSON.stringify({ body: 't', timestamp: Date.now() - 8 * 86400000 }));
    const { result } = renderHook(() => useDraftStorage());
    expect(result.current.hasDraft).toBe(false);
  });

  it('clearDraft supprime', () => {
    localStorage.setItem('ritual-draft-v1', JSON.stringify({ body: 't', timestamp: Date.now() }));
    const { result } = renderHook(() => useDraftStorage());
    act(() => result.current.clear());
    expect(localStorage.getItem('ritual-draft-v1')).toBeNull();
  });
});
```

### 14.2 `useWallUrlState`

```ts
describe('useWallUrlState', () => {
  it('isOpen true si ?wall=open', () => {
    const { result } = renderHook(() => useWallUrlState(), {
      wrapper: ({ children }) => <RouterProvider params="?wall=open">{children}</RouterProvider>,
    });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.view).toBe('list');
  });

  it('view = wizard si ?wall=share', () => {
    /* ... */
  });

  it('close retire ?wall', () => {
    /* ... */
  });

  it('setView push history', () => {
    /* ... */
  });
});
```

## 15. RBAC `can-rituals.ts`

```ts
describe('canRitualAction', () => {
  it('admin peut tout', () => {
    const actions = ['view', 'approve', 'reject', 'hide', 'restore', 'feature', 'correct', 'delete_rgpd'] as const;
    for (const a of actions) {
      expect(canRitualAction('admin', a)).toBe(true);
    }
  });

  it('moderator ne peut pas feature', () => {
    expect(canRitualAction('moderator', 'feature')).toBe(false);
  });

  it('moderator ne peut pas delete_rgpd', () => {
    expect(canRitualAction('moderator', 'delete_rgpd')).toBe(false);
  });

  it('moderator peut approve / reject / hide / restore / correct', () => {
    expect(canRitualAction('moderator', 'approve')).toBe(true);
    expect(canRitualAction('moderator', 'correct')).toBe(true);
  });

  it('viewer peut seulement view', () => {
    expect(canRitualAction('viewer', 'view')).toBe(true);
    expect(canRitualAction('viewer', 'approve')).toBe(false);
  });

  it('rôle inconnu retourne false partout', () => {
    expect(canRitualAction('intern' as any, 'view')).toBe(false);
  });
});
```

## 16. Email templates rendering

```ts
describe('renderEmail', () => {
  it('j45 remplace les variables', () => {
    const rendered = renderEmail('rituals/j45', { firstName: 'Amal', ctaUrl: 'https://x' });
    expect(rendered).toContain('Bonjour Amal');
    expect(rendered).toContain('https://x');
  });

  it('approved sans variable customer_email', () => {
    const rendered = renderEmail('rituals/approved', { firstName: 'Amal', wallUrl: 'https://...' });
    expect(rendered).not.toContain('{{');
  });

  it('rejected-face inclut la mention visage', () => {
    const rendered = renderEmail('rituals/rejected-face', { firstName: 'Amal' });
    expect(rendered).toContain('visage');
  });
});
```

## 17. Récapitulatif coverage attendu

| Fichier | Tests | Coverage cible |
| --- | --- | --- |
| `lib/schemas/rituals.ts` | 12 | 100 % |
| `lib/rituals/sanitize-body.ts` | 10 | 100 % |
| `lib/rituals/auto-flags.ts` | 11 | 95 % |
| `lib/rituals/customer-hash.ts` | 5 | 100 % |
| `lib/rituals/email-tokens.ts` | 4 | 100 % |
| `lib/rituals/vision-ml-faces.ts` | 6 | 90 % |
| `lib/db/queries/rituals.ts` | 12 | 90 % |
| `RitualCard.tsx` | 11 | 100 % |
| `RitualsModule.tsx` | 4 | 100 % |
| `RitualsWallFilters.tsx` | 5 | 100 % |
| `Step1Voice.tsx` | 8 | 95 % |
| `Step2Details.tsx` | 4 | 95 % |
| `Step3Signature.tsx` | 3 | 95 % |
| `useDraftStorage.ts` | 4 | 100 % |
| `useWallUrlState.ts` | 4 | 95 % |
| `canRitualAction` | 6 | 100 % |
| `renderEmail` | 3 | 100 % |
| **Total** | **~112 tests** | **~95 %** |

Ajout des tests de composants admin (Phase A) : ~30 tests supplémentaires.

**Total final unitaire : ~140 tests.**

## 18. Synthèse

1. **Chaque fichier de production a son `.test`** collocation.
2. **Chaque fonction publique a au moins 3 cas testés** (nominal, edge, erreur).
3. **Chaque composant a un test axe-core**.
4. **Chaque hook a un test renderHook + waitFor**.
5. **Aucun test ne dépend d'un autre** (isolation totale).
6. **Aucun test n'utilise `fetch` réel** ; tout passe par MSW (cf. `09`).
7. **Suite < 3 min** en CI.
