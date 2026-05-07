import { z } from 'zod';

export const cartItemSchema = z.object({
  productId: z.string(),
  productSlug: z.string(),
  productName: z.string(),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().positive(),
  imageSrc: z.string().optional(),
  imageAlt: z.string().optional(),
});
export type CartItem = z.infer<typeof cartItemSchema>;

export const shippingCitySchema = z.string().min(1).max(80).optional();
export type ShippingCity = z.infer<typeof shippingCitySchema>;

export const cartSchema = z.object({
  items: z.array(cartItemSchema),
  subTotalCents: z.number().int().nonnegative(),
});
export type Cart = z.infer<typeof cartSchema>;
