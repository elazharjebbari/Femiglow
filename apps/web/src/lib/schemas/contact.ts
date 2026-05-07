import { z } from 'zod';
import { emailSchema } from './common';

export const contactTypeSchema = z.enum(['question', 'order', 'professional']);
export type ContactType = z.infer<typeof contactTypeSchema>;

export const contactFormSchema = z
  .object({
    type: contactTypeSchema,
    name: z.string().min(2, 'Au moins 2 caractères.').max(80),
    email: emailSchema,
    phone: z.string().max(40).optional().or(z.literal('')),
    orderNumber: z.string().max(40).optional().or(z.literal('')),
    companyName: z.string().max(120).optional().or(z.literal('')),
    role: z.string().max(80).optional().or(z.literal('')),
    message: z.string().min(20, 'Au moins 20 caractères.').max(2000),
    gdprConsent: z.literal(true, {
      errorMap: () => ({ message: 'Le consentement est requis pour vous répondre.' }),
    }),
    newsletterOptIn: z.boolean().default(false),
    website: z.string().max(0).optional().or(z.literal('')),
    recaptchaToken: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'order' && !data.orderNumber?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['orderNumber'],
        message: 'Indiquez le numéro de commande pour que nous puissions vous aider.',
      });
    }
    if (data.type === 'professional') {
      if (!data.phone?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['phone'],
          message: 'Un téléphone facilite l\u2019échange professionnel.',
        });
      }
      if (!data.companyName?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['companyName'],
          message: 'Indiquez la raison sociale.',
        });
      }
      if (!data.role?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['role'],
          message: 'Indiquez votre fonction.',
        });
      }
    }
  });

export type ContactFormValues = z.infer<typeof contactFormSchema>;
