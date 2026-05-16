import type { ChatLeadRow } from '@/lib/chat/db/schema';
import type { OutboundStatus } from '@/lib/db/types';

export type LeadJourneyStage = 'lead' | 'address' | 'payment' | 'purchased' | 'abandoned_step1';
export type LeadWebhookSummary =
  | 'none'
  | 'pending'
  | 'sent'
  | 'failed'
  | 'disabled'
  | 'skipped'
  | 'step2_sent'
  | 'step1_abandoned_sent';

export interface LeadJourneyView {
  stage: LeadJourneyStage;
  dataPct: number;
  webhookSummary: LeadWebhookSummary;
}

export interface LeadOutboundWebhookStatuses {
  step2?: OutboundStatus | null;
  step1Abandon?: OutboundStatus | null;
}

export function computeDataPct(row: Pick<
  ChatLeadRow,
  | 'firstName'
  | 'phoneE164'
  | 'email'
  | 'shippingCity'
  | 'shippingAddressLine1'
  | 'shippingNotes'
  | 'preferredPaymentMethod'
>): number {
  const fields = [
    row.firstName,
    row.phoneE164,
    row.email,
    row.shippingCity,
    row.shippingAddressLine1,
    row.shippingNotes,
    row.preferredPaymentMethod,
  ];
  const present = fields.filter((value) => typeof value === 'string' && value.trim().length > 0).length;
  return Math.round((present / fields.length) * 100);
}

function summaryFromOutboundStatus(
  status: OutboundStatus,
  sentSummary: Extract<LeadWebhookSummary, 'step2_sent' | 'step1_abandoned_sent'>,
): LeadWebhookSummary {
  switch (status) {
    case 'sent':
      return sentSummary;
    case 'failed':
    case 'disabled':
    case 'skipped':
    case 'pending':
      return status;
    default:
      return 'pending';
  }
}

export function computeLeadJourney(
  row: ChatLeadRow,
  outboundStatuses: LeadOutboundWebhookStatuses = {},
): LeadJourneyView {
  let stage: LeadJourneyStage = 'lead';
  if (row.purchasedAt) stage = 'purchased';
  else if (row.paymentSelectedAt) stage = 'payment';
  else if (row.addressCompletedAt) stage = 'address';
  else if (row.step1AbandonWebhookAt) stage = 'abandoned_step1';

  let webhookSummary: LeadWebhookSummary = row.webhookStatus ?? 'none';
  if (outboundStatuses.step2) {
    webhookSummary = summaryFromOutboundStatus(outboundStatuses.step2, 'step2_sent');
  } else if (outboundStatuses.step1Abandon) {
    webhookSummary = summaryFromOutboundStatus(
      outboundStatuses.step1Abandon,
      'step1_abandoned_sent',
    );
  } else if (row.step2WebhookAt) webhookSummary = 'step2_sent';
  else if (row.step1AbandonWebhookAt) webhookSummary = 'step1_abandoned_sent';

  return {
    stage,
    dataPct: computeDataPct(row),
    webhookSummary,
  };
}
