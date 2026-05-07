import { describe, it, expect } from 'vitest';
import { loginInputSchema } from './login';

describe('loginInputSchema', () => {
  it('normalise email en minuscule trimé', () => {
    const r = loginInputSchema.parse({ email: '  Admin@Femiglow.MA ', password: 'azerty12' });
    expect(r.email).toBe('admin@femiglow.ma');
  });

  it('rejette email invalide', () => {
    const r = loginInputSchema.safeParse({ email: 'pas-un-email', password: 'azerty12' });
    expect(r.success).toBe(false);
  });

  it('rejette mot de passe trop court', () => {
    const r = loginInputSchema.safeParse({ email: 'a@b.co', password: 'court' });
    expect(r.success).toBe(false);
  });
});
