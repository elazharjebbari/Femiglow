/**
 * /admin/emails/campaigns/new — point d'entrée canonique de création (CAMP-08).
 *
 * La création vit dans le formulaire inline de la LISTE (nom interne → brouillon
 * → wizard /edit). Cette route existait dans la palette (« Nouvelle campagne »)
 * et dans les conventions des autres sections (/audiences/new, /templates/new,
 * /automation/new) mais répondait 404 — on redirige vers le flux réel avec un
 * focus sur le formulaire de création.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function NewCampaignRedirect(): never {
  redirect('/admin/emails/campaigns#nouvelle-campagne');
}
