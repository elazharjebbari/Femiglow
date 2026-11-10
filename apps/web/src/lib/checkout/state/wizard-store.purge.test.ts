import { beforeEach, describe, expect, it } from 'vitest';

import { getOrCreateIdempotencyKey } from '@/lib/checkout/client/idempotency-key';
import { useWizardStore } from './wizard-store';

const keys = () =>
  Object.keys(window.sessionStorage).filter((k) => k.startsWith('femiglow.wizard.idem.'));

describe('store du formulaire — clés d’idempotence après une commande', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    useWizardStore.getState().reset();
  });

  it('« Nouvelle commande » (reset) purge toutes les clés : la fiche n’est plus rejouée', () => {
    const before = getOrCreateIdempotencyKey('lead_create', null);
    getOrCreateIdempotencyKey('address_update', 'cl_abc');
    expect(keys()).toHaveLength(2);
    useWizardStore.getState().reset();
    expect(keys()).toHaveLength(0);
    expect(getOrCreateIdempotencyKey('lead_create', null)).not.toBe(before);
  });

  it('restartAfterPurchase : étape 1, fiche et commande oubliées, saisies conservées', () => {
    const s = useWizardStore.getState();
    s.mergeLeadDraft({ firstName: 'Amal', phone: '612345678' });
    s.setLeadId('cl_old');
    s.setOrderId('o_old');
    s.goToStep('address');
    s.setCoupon('FG-CREDIT-1234', 2000);
    getOrCreateIdempotencyKey('lead_create', null);

    useWizardStore.getState().restartAfterPurchase();

    const after = useWizardStore.getState();
    expect(after.leadId).toBeNull();
    expect(after.orderId).toBeNull();
    expect(after.currentStep).toBe('lead');
    expect(after.leadDraft).toMatchObject({ firstName: 'Amal', phone: '612345678' });
    expect(keys()).toHaveLength(0);
    // Crédit possiblement consommé par la commande passée : retiré.
    expect(after.couponCode).toBeNull();
    expect(after.creditCents).toBe(0);
  });
});
