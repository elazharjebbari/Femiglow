import { z } from 'zod';

export const loginInputSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email invalide'),
  password: z.string().min(8, 'Mot de passe trop court'),
});

export type LoginInput = z.infer<typeof loginInputSchema>;
