import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('hash et vérifie un mot de passe correct', async () => {
    const hash = await hashPassword('correct horse battery');
    await expect(verifyPassword('correct horse battery', hash)).resolves.toBe(true);
  });

  it('rejette un mot de passe incorrect', async () => {
    const hash = await hashPassword('correct horse battery');
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });

  it('rejette un hash mal formé', async () => {
    await expect(verifyPassword('any', 'not-a-valid-hash')).resolves.toBe(false);
  });

  it('refuse un mot de passe trop court', async () => {
    await expect(hashPassword('short')).rejects.toThrow();
  });
});
