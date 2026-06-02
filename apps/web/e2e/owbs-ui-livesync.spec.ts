/**
 * OWBS — garde-fou e2e du bug S1 (live-sync). Prouve, contre le VRAI serveur
 * (sans mock), que la capture optimiste POSTe réellement le lead en tâche de
 * fond : POST /api/checkout/lead → 201, avec le leadId client (cl_…).
 * Build flag-ON. cf. fix ce9fba0 (re-drain de la file).
 */
import { expect, test } from '@playwright/test';

import { addressStep, fillLead, leadSubmit, openLeadStep } from './_helpers/owbs';

test('le live-sync persiste réellement le lead (POST 201 + leadId client)', async ({ page }) => {
  const leadPosts: number[] = [];
  let sentLeadId = '';

  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/api\/checkout\/lead$/.test(r.url())) {
      try {
        const d = r.postDataJSON() as { leadId?: string } | null;
        if (d?.leadId) sentLeadId = d.leadId;
      } catch {
        /* corps non-JSON */
      }
    }
  });
  page.on('response', (r) => {
    if (r.request().method() === 'POST' && /\/api\/checkout\/lead$/.test(r.url())) {
      leadPosts.push(r.status());
    }
  });

  await openLeadStep(page);
  await fillLead(page);
  await leadSubmit(page).click();

  // UI optimiste : on a déjà avancé ...
  await expect(addressStep(page)).toBeVisible({ timeout: 3000 });

  // ... et en tâche de fond, le POST de création part RÉELLEMENT et réussit.
  await expect.poll(() => leadPosts.length, { timeout: 8000 }).toBeGreaterThanOrEqual(1);
  expect(leadPosts[0]).toBe(201);
  // Le serveur a reçu le leadId généré CLIENT (upsert-by-leadId).
  expect(sentLeadId).toMatch(/^cl_[0-9a-z]{20,}$/);
});
