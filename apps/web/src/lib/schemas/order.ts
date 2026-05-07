import { z } from 'zod';
import { emailSchema } from './common';

export const phoneMaroc9DigitsSchema = z
  .string()
  .regex(
    /^[5-7]\d{8}$/u,
    'Numéro à 9 chiffres après le préfixe +212.',
  );

export const checkoutContactSchema = z.object({
  firstName: z.string().min(2, 'Au moins 2 caractères.').max(60),
  lastName: z.string().min(2, 'Au moins 2 caractères.').max(60),
  email: emailSchema,
  phone: phoneMaroc9DigitsSchema,
  acceptNewsletter: z.boolean().default(false),
  createAccount: z.boolean().default(false),
});
export type CheckoutContact = z.infer<typeof checkoutContactSchema>;

export const villeMarocEnum = z.enum([
  'casablanca',
  'rabat',
  'marrakech',
  'fes',
  'tanger',
  'agadir',
  'meknes',
  'oujda',
  'tetouan',
  'sale',
  'autre',
]);
export type VilleMaroc = z.infer<typeof villeMarocEnum>;

export const shippingModeSchema = z.enum(['standard', 'express']);
export type ShippingMode = z.infer<typeof shippingModeSchema>;

export const checkoutAddressSchema = z
  .object({
    line1: z.string().min(4, 'Adresse trop courte.').max(120),
    line2: z.string().max(120).optional(),
    quartier: z.string().min(2, 'Quartier requis.').max(80),
    city: villeMarocEnum,
    cityOther: z.string().max(60).optional(),
    postalCode: z
      .string()
      .regex(/^[0-9]{5}$/u, 'Code postal à 5 chiffres.')
      .optional()
      .or(z.literal('')),
    country: z.literal('MA'),
    shippingMode: shippingModeSchema.default('standard'),
  })
  .superRefine((value, ctx) => {
    if (value.city === 'autre' && (!value.cityOther || value.cityOther.trim().length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cityOther'],
        message: 'Précisez la ville.',
      });
    }
  });
export type CheckoutAddress = z.infer<typeof checkoutAddressSchema>;

export const checkoutPaymentMethodSchema = z.enum(['card', 'cmi', 'cod']);
export type CheckoutPaymentMethod = z.infer<typeof checkoutPaymentMethodSchema>;

export const checkoutFormSchema = z.object({
  contact: checkoutContactSchema,
  address: checkoutAddressSchema,
  paymentMethod: checkoutPaymentMethodSchema,
  promoCode: z.string().max(40).optional(),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Acceptation requise.' }),
  }),
});
export type CheckoutForm = z.infer<typeof checkoutFormSchema>;

export const orderIdSchema = z
  .string()
  .regex(/^FG-\d{4}-[A-Z0-9]{5}$/u, 'Format de commande invalide.');
