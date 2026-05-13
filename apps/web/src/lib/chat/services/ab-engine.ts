/**
 * CHAT-058 — Moteur A/B "cookie variant assigner".
 *
 * Pourquoi
 * ────────
 * On veut tester rapidement des variantes UX/copy (greeting darija par
 * défaut, pulse 30 s sur le launcher, etc.) sans dépendance externe
 * (GrowthBook arrive en S8, cf. CHAT-078). Le moteur :
 *
 *  - Assigne un variant **déterministe** par couple `(experimentKey, visitorId)`
 *    via un hash FNV-1a → [0, 1). C'est stable tant que le visitorId ne change
 *    pas (cookie 30 j côté `visitor-cookie`).
 *  - Permet une rampe progressive : `{ key: 'darija', weight: 0.2 }` →
 *    20 % des visiteurs. Le reste tombe sur `'default'`.
 *  - N'écrit RIEN tant qu'on ne s'en sert pas : c'est le caller qui décide
 *    où persister (cookie, session, evento).
 *
 * Sortie compacte
 * ───────────────
 * `assignChatVariants(visitorId)` renvoie un objet `{ expKey: variant }`
 * sérialisable. On le stocke dans `chat_session.experiment_variant_id` au
 * format URLSearchParams (`exp-greeting-darija=darija&exp-launcher=pulse-30s`)
 * pour rester lisible côté analytics SQL.
 *
 * cf. docs/dossier-chat-v2/09-plan-developpement/sprint-breakdown.csv (CHAT-058)
 */

export interface AbVariant<K extends string = string> {
  /** Identifiant du variant (ex: 'darija', 'pulse-30s'). 'default' réservé. */
  key: K;
  /** Probabilité 0..1. Somme des weights doit être ≤ 1. */
  weight: number;
}

export interface AbExperiment<K extends string = string> {
  /** Clé stable (ex: 'exp-greeting-darija'). N'altère JAMAIS après lancement. */
  key: string;
  /** Variants candidats (hors 'default'). */
  variants: ReadonlyArray<AbVariant<K>>;
  /** Si false, l'expérience est gelée et renvoie toujours 'default'. */
  enabled: boolean;
}

/**
 * Registre courant. Ajouter une expérience ici suffit pour qu'elle soit
 * assignée à tous les nouveaux visiteurs. Pour la désactiver sans casser
 * la cohérence des analytics, passer `enabled: false` plutôt que de la
 * retirer du tableau.
 */
export const CHAT_EXPERIMENTS: ReadonlyArray<AbExperiment> = [
  // CHAT-059 — greeting darija par défaut pour 50 % des visiteurs.
  {
    key: 'exp-greeting-darija',
    enabled: false,
    variants: [{ key: 'darija', weight: 0.5 }],
  },
  // CHAT-060 — pulse 30 s sur le launcher pour 50 % des visiteurs.
  {
    key: 'exp-launcher-pulse',
    enabled: false,
    variants: [{ key: 'pulse-30s', weight: 0.5 }],
  },
];

/**
 * FNV-1a 32 bits → ratio dans [0, 1).
 * Pourquoi pas crypto.createHash : on veut un hash léger, déterministe,
 * sans dépendance Node. FNV-1a suffit largement pour un bucket A/B.
 */
function hashToUnitInterval(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Force unsigned + normalise.
  return (h >>> 0) / 0x1_0000_0000;
}

/**
 * Assigne UN variant pour une expérience donnée, ou 'default' si :
 *  - l'expérience est désactivée,
 *  - aucun bucket ne couvre le ratio tiré.
 *
 * @param experimentKey clé de l'expérience (cf. `CHAT_EXPERIMENTS`)
 * @param visitorId    identifiant stable du visiteur (cookie)
 * @param variants     liste des variants candidats
 * @param enabled      true par défaut ; passer false pour court-circuiter
 */
export function assignVariant<K extends string>(
  experimentKey: string,
  visitorId: string,
  variants: ReadonlyArray<AbVariant<K>>,
  enabled = true,
): K | 'default' {
  if (!enabled || variants.length === 0 || !visitorId) return 'default';
  const ratio = hashToUnitInterval(`${experimentKey}|${visitorId}`);
  let acc = 0;
  for (const v of variants) {
    if (v.weight <= 0) continue;
    acc += v.weight;
    if (ratio < acc) return v.key;
  }
  return 'default';
}

/**
 * Assigne les variants de TOUTES les expériences chat actives. Le résultat
 * est un objet plat `{ [expKey]: variantKey }` ne contenant que les
 * expériences activées (les autres sont omises).
 */
export function assignChatVariants(visitorId: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const exp of CHAT_EXPERIMENTS) {
    if (!exp.enabled) continue;
    const v = assignVariant(exp.key, visitorId, exp.variants, exp.enabled);
    out[exp.key] = v;
  }
  return out;
}

/**
 * Encode les variants en un opaque ID stable pour `chat_session.experiment_variant_id`.
 * Format URLSearchParams pour rester lisible en SQL (`LIKE '%darija%'`).
 * Renvoie `'default'` si aucune expérience n'est active.
 */
export function encodeVariantsForSession(
  variants: Record<string, string>,
): string {
  const keys = Object.keys(variants).sort();
  if (keys.length === 0) return 'default';
  const params = new URLSearchParams();
  for (const k of keys) {
    params.set(k, variants[k]!);
  }
  return params.toString();
}

/**
 * Décode l'opaque ID stocké en DB. Utile pour les KPIs / dashboards.
 * Tolère les anciens IDs ('default', '') sans erreur.
 */
export function decodeVariantsFromSession(
  opaqueId: string | null | undefined,
): Record<string, string> {
  if (!opaqueId || opaqueId === 'default') return {};
  try {
    const out: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(opaqueId).entries()) {
      out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export const abEngine = {
  assignVariant,
  assignChatVariants,
  encodeVariantsForSession,
  decodeVariantsFromSession,
};
