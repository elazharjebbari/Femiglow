/**
 * GET /api/admin/emails/listmonk/lists
 *
 * Liste des listes Listmonk pour le combobox recherchable de l'étape Audience
 * du wizard campagne (UX-CAMP-007). Filtre optionnel `?q=` côté serveur (sur le
 * nom). Renvoie `{ lists: [{ id, name, type, optin, subscriberCount }] }` ou
 * `{ lists: [], error }` si Listmonk est indisponible (jamais de 500 dur pour
 * un combobox — le composant affiche son état « indisponible »).
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { fetchListmonkLists } from '@/lib/admin/emails/campaigns-queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  await requireAdmin('/api/admin/emails/listmonk/lists');

  const q = new URL(req.url).searchParams.get('q')?.trim().toLowerCase() ?? '';
  const res = await fetchListmonkLists();
  if (!res.ok) {
    // 200 + enveloppe d'erreur : le combobox doit pouvoir distinguer
    // « aucun résultat » d'une panne, sans casser sur un onUnhandledRequest.
    return NextResponse.json({ lists: [], error: res.error }, { status: 200 });
  }
  const lists = q
    ? res.lists.filter((l) => l.name.toLowerCase().includes(q))
    : res.lists;
  return NextResponse.json({ lists: lists.slice(0, 50) });
}
