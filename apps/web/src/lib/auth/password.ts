import { hash, verify } from '@node-rs/argon2';

const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) throw new Error('Mot de passe trop court');
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored.startsWith('$argon2')) return false;
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}
