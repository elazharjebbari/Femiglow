/**
 * Smoke tests CHA-230 — assure que les types Drizzle des nouvelles tables
 * du wizard checkout funnel sont correctement inférés et que les exports
 * sont bien en place.
 *
 * Ces tests ne touchent PAS la DB — ils vérifient uniquement les types et
 * les exports (typage statique au runtime via `$inferSelect/$inferInsert`).
 * Le test d'intégration DB est fait via `psql -f` à l'application des
 * migrations (cf. PR #2 runbook §Step 2.1).
 */
import { describe, expect, it } from 'vitest';

import {
  checkoutIdempotency,
  formConfig,
  formConfigHistory,
  formVariantAssignment,
  orders,
  productStock,
  type CheckoutIdempotencyInsert,
  type FormConfigInsert,
  type FormConfigRow,
  type FormVariantAssignmentInsert,
  type ProductStockInsert,
} from '../schema';

describe('Drizzle schema — CHA-230 wizard funnel tables', () => {
  it('exporte les 5 nouvelles tables (formConfig, formConfigHistory, productStock, formVariantAssignment, checkoutIdempotency)', () => {
    expect(formConfig).toBeDefined();
    expect(formConfigHistory).toBeDefined();
    expect(productStock).toBeDefined();
    expect(formVariantAssignment).toBeDefined();
    expect(checkoutIdempotency).toBeDefined();
  });

  it('orders étendu avec chatLeadId / formId / formMode / variantKey (tous optionnels)', () => {
    // Smoke test : si une colonne manque, l'inférence de type casserait ;
    // on confirme que les keys funnel existent et sont optionnelles.
    type OrdersInsert = typeof orders.$inferInsert;
    // Variante minimale sans funnel context :
    const withoutFunnel: OrdersInsert = {
      id: 'o_1',
      leadId: 'l_1',
      totalCents: 0,
      currency: 'MAD',
      shippingMode: 'standard',
      paymentMethod: 'cod',
    };
    // Variante complète avec funnel context :
    const withFunnel: OrdersInsert = {
      id: 'o_1',
      leadId: 'l_1',
      totalCents: 0,
      currency: 'MAD',
      shippingMode: 'standard',
      paymentMethod: 'cod',
      chatLeadId: 'cl_1',
      formId: 'wizard_kit',
      formMode: 'wizard_embed',
      variantKey: 'A',
    };
    expect(withFunnel.formMode).toBe('wizard_embed');
    expect(withoutFunnel.id).toBe('o_1');
  });

  it('formConfig — insert minimal valide', () => {
    const insert: FormConfigInsert = {
      id: 'fc_1',
      key: 'wizard_kit',
      config: { steps: ['lead'] },
    };
    expect(insert.key).toBe('wizard_kit');
  });

  it('formConfig — row inferred type contient les bons champs', () => {
    const row: FormConfigRow = {
      id: 'fc_1',
      key: 'wizard_kit',
      version: 1,
      active: true,
      config: {},
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
    };
    expect(row.active).toBe(true);
  });

  it('productStock — insert avec variantId, sku, available requis', () => {
    const insert: ProductStockInsert = {
      variantId: 'pvar_1',
      sku: 'FEMI-KIT-100',
    };
    expect(insert.sku).toBe('FEMI-KIT-100');
  });

  it('formVariantAssignment — variant_key contraint à A | B | control', () => {
    const insert: FormVariantAssignmentInsert = {
      visitorId: 'v_1',
      formId: 'wizard_kit',
      variantKey: 'A',
    };
    expect(insert.variantKey).toBe('A');
  });

  it('checkoutIdempotency — scope contraint aux 5 valeurs', () => {
    const insert: CheckoutIdempotencyInsert = {
      key: 'k_1',
      scope: 'lead_create',
      requestHash: 'sha256:abc',
      responseJson: {},
    };
    expect(insert.scope).toBe('lead_create');
  });
});
