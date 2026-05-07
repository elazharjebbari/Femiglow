/**
 * Types Products-CMS — modèles partagés routes / queries / UI.
 * cf. docs/products-cms/architecture/02-data-model.md
 */

export type ProductStatus = 'draft' | 'published' | 'archived';
export type InventoryStatus =
  | 'available'
  | 'low_stock'
  | 'out_of_stock'
  | 'preorder';

export const PRODUCT_STATUSES: readonly ProductStatus[] = [
  'draft',
  'published',
  'archived',
] as const;

export const INVENTORY_STATUSES: readonly InventoryStatus[] = [
  'available',
  'low_stock',
  'out_of_stock',
  'preorder',
] as const;

export interface Product {
  id: string;
  slug: string;
  status: ProductStatus;
  title: string;
  tagline: string | null;
  description: string | null;
  category: string | null;
  tags: string[];
  position: number;
  featured: boolean;
  publishedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  label: string;
  priceCents: number;
  promoPriceCents: number | null;
  currency: string;
  inventoryStatus: InventoryStatus;
  weightG: number | null;
  attributes: Record<string, string>;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductSnapshot {
  id: string;
  productId: string;
  capturedAt: Date;
  payload: unknown;
  actorId: string | null;
  note: string | null;
}

export interface ProductWithVariants {
  product: Product;
  variants: ProductVariant[];
}

export interface ProductListItem {
  id: string;
  slug: string;
  title: string;
  status: ProductStatus;
  category: string | null;
  primaryPriceCents: number | null;
  variantCount: number;
  publishedAt: Date | null;
  updatedAt: Date;
}
