import { sql, type SQL } from 'drizzle-orm';

/** Pendant ce délai, un achat rend sans objet toute relance du même numéro. */
const RECENT_PURCHASE_MS = 24 * 60 * 60 * 1000;

/**
 * Condition des scanners d'abandon : aucun achat récent pour ce numéro, sur un
 * autre lead compris. La colonne est écrite en toutes lettres : dans une requête
 * à une seule table, Drizzle l'aurait rendue sans préfixe, et elle aurait alors
 * désigné `bought`.
 */
export function noRecentPurchaseForPhone(now: Date): SQL {
  const since = new Date(now.getTime() - RECENT_PURCHASE_MS).toISOString();
  return sql`NOT EXISTS (
    SELECT 1 FROM chat_lead bought
    WHERE bought.phone_e164 = "chat_lead"."phone_e164"
      AND bought.purchased_at > ${since}::timestamptz
  )`;
}
