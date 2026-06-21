/**
 * Merge-tags de campagne Listmonk (F05 P3.2-c3, assistance G11) — PUR.
 *
 * Les campagnes du wizard sont créées côté Listmonk en `content_type: 'html'`
 * (cf. finalizeCampaign) → la personnalisation suit la syntaxe des templates Go
 * de Listmonk : `{{ .Subscriber.Email }}`, `{{ UnsubscribeURL }}`, …
 *
 * HONNÊTETÉ (verrou assistance) : le push d'audience ne synchronise QUE l'email
 * (cf. listmonk-sync `/api/subscribers` : email/status/lists) — `Name` (et a
 * fortiori les attributs custom) restent VIDES pour les audiences FemiGlow. On
 * classe donc chaque tag par fiabilité pour ne JAMAIS suggérer un champ qui
 * rendrait vide sans le dire. On n'expose PAS les variables du moteur de
 * templates custom transactionnel (`{{ firstName }}`…) : syntaxe différente, qui
 * ne résoudrait pas dans une campagne Listmonk.
 *
 * NB : on ne propose que des tags Listmonk RÉELS (pas de `FirstName` — le
 * subscriber Listmonk n'a qu'un champ `name` plein).
 */

export type MergeTagReliability = 'always' | 'conditional';

export type MergeTag = {
  /** Jeton inséré tel quel (syntaxe Go Listmonk). */
  token: string;
  /** Libellé humain (menu). */
  label: string;
  /** Aide courte affichée sous le libellé. */
  description: string;
  reliability: MergeTagReliability;
};

export const CAMPAIGN_MERGE_TAGS: readonly MergeTag[] = [
  {
    token: '{{ .Subscriber.Email }}',
    label: 'E-mail du contact',
    description: 'Toujours disponible.',
    reliability: 'always',
  },
  {
    token: '{{ UnsubscribeURL }}',
    label: 'Lien de désabonnement',
    description: 'Obligatoire dans tout e-mail ; généré par Listmonk.',
    reliability: 'always',
  },
  {
    token: '{{ MessageURL }}',
    label: 'Voir dans le navigateur',
    description: 'Lien public vers la version web du message.',
    reliability: 'always',
  },
  {
    token: '{{ .Subscriber.Name }}',
    label: 'Nom du contact',
    description: 'Vide pour les audiences FemiGlow (non synchronisé) — fiable seulement sur des listes Listmonk renseignées.',
    reliability: 'conditional',
  },
] as const;

/** Tags toujours résolus (mis en avant dans le menu). */
export const ALWAYS_MERGE_TAGS = CAMPAIGN_MERGE_TAGS.filter((t) => t.reliability === 'always');
/** Tags dont la résolution dépend des données contact (souvent vides). */
export const CONDITIONAL_MERGE_TAGS = CAMPAIGN_MERGE_TAGS.filter(
  (t) => t.reliability === 'conditional',
);

/**
 * Insère `token` dans `value` à la position du curseur, en remplaçant la
 * sélection [start, end). Bornes clampées (curseur hors limites toléré). Renvoie
 * la nouvelle valeur + la position du curseur (après le jeton inséré).
 */
export function insertToken(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  token: string,
): { value: string; cursor: number } {
  const len = value.length;
  const rawStart = Number.isFinite(selectionStart) ? selectionStart : len;
  const rawEnd = Number.isFinite(selectionEnd) ? selectionEnd : rawStart;
  const start = Math.max(0, Math.min(rawStart, len));
  const end = Math.max(start, Math.min(rawEnd, len));
  return {
    value: value.slice(0, start) + token + value.slice(end),
    cursor: start + token.length,
  };
}
