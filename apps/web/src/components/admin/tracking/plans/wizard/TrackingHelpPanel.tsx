/**
 * Documentation embarquée du système de tracking centralisé.
 *
 * Composant `<details>` HTML natif → accessible clavier, pas de JS,
 * indexable par le SEO admin si besoin. Imbriqué pour ouvrir une
 * section à la fois sans encombrer la page.
 *
 * Couvre l'intégralité du système :
 *   1. Vue d'ensemble
 *   2. Configurer Google Ads
 *   3. Conversions FemiGlow × Google Ads (mapping)
 *   4. Export & import GTM
 *   5. Enhanced Conversions / Advanced Matching
 *   6. Validation & troubleshooting
 *   7. FAQ
 *
 * Usage :
 *   <TrackingHelpPanel />          // version compacte (1 ligne, replié)
 *   <TrackingHelpPanel defaultOpen /> // ouvre la section principale
 */
'use client';

import { listAdsConversions } from '@/lib/tracking/providers/event-mapping';

export function TrackingHelpPanel({
  defaultOpen = false,
}: {
  defaultOpen?: boolean;
}): JSX.Element {
  return (
    <details
      open={defaultOpen}
      className="group mb-6 overflow-hidden rounded-lg border border-sky-200 bg-sky-50/40"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-sky-900 hover:bg-sky-50">
        <span className="flex items-center gap-2">
          <span aria-hidden="true">📖</span>
          <span>Guide : comment configurer le tracking de bout en bout</span>
        </span>
        <Chevron />
      </summary>
      <div className="space-y-2 border-t border-sky-200 bg-white/60 p-4 text-sm text-stone-700">
        <SectionOverview />
        <SectionGoogleAds />
        <SectionMapping />
        <SectionExport />
        <SectionEnhanced />
        <SectionValidation />
        <SectionFaq />
      </div>
    </details>
  );
}

/* ─── Sub-sections ────────────────────────────────────────────── */

function Section({
  number,
  title,
  emoji,
  children,
}: {
  number: number;
  title: string;
  emoji: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <details className="group/section overflow-hidden rounded-md border border-stone-200 bg-white shadow-sm transition hover:border-stone-300">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium text-stone-900 hover:bg-stone-50">
        <span className="flex items-center gap-2">
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-stone-900 text-[10px] font-semibold text-white"
            aria-hidden
          >
            {number}
          </span>
          <span aria-hidden>{emoji}</span>
          <span>{title}</span>
        </span>
        <Chevron />
      </summary>
      <div className="space-y-3 border-t border-stone-200 px-4 py-4 text-sm leading-relaxed text-stone-700">
        {children}
      </div>
    </details>
  );
}

function SectionOverview(): JSX.Element {
  return (
    <Section number={1} title="Vue d'ensemble du système" emoji="🗺️">
      <p>
        FemiGlow centralise tout le tracking publicitaire dans un{' '}
        <strong>plan de tracking</strong> unique. Quand un événement métier
        survient côté site (achat, ajout panier, soumission lead…), il est
        poussé dans le <code className="rounded bg-stone-100 px-1 text-xs">dataLayer</code>{' '}
        et propagé à <strong>Google Tag Manager (GTM)</strong> qui dispatche
        vers les providers configurés (GA4, Google Ads, Meta, TikTok).
      </p>
      <CodeBlock>{`Site FemiGlow (event)
    ↓ dataLayer.push({ event: 'purchase', value: 199, user_data: {...} })
GTM container
    ├→ GA4 Event tag    (gaawe)  → Google Analytics
    ├→ Ads Conversion   (awct)   → Google Ads (avec Enhanced Conversions)
    ├→ Meta Pixel       (html)   → Meta Ads + CAPI
    └→ TikTok Pixel     (html)   → TikTok Ads`}</CodeBlock>
      <p>
        <strong>Le plan</strong> stocke : les events à tracker, les pixel-IDs,
        le mapping cross-provider (event → nom canonique de chaque provider),
        et les <strong>étiquettes de conversion Google Ads</strong> que tu
        renseignes ici. L'export GTM <em>compile</em> ces données en un fichier
        JSON importable dans GTM en 1 clic.
      </p>
    </Section>
  );
}

function SectionGoogleAds(): JSX.Element {
  return (
    <Section number={2} title="Configurer Google Ads" emoji="🔧">
      <p>
        Google Ads identifie une conversion par <strong>2 valeurs</strong> :
      </p>
      <ul className="ml-5 list-disc space-y-1">
        <li>
          <strong>Conversion ID</strong> (<code>AW-XXXXXXXXX</code>) — unique
          pour ton compte Google Ads. Tu le tapes <strong>une seule fois</strong>{' '}
          dans le champ « Google Ads Conversion ID » ci-dessus.
        </li>
        <li>
          <strong>Conversion label</strong> (string ~20 chars) — propre à{' '}
          <em>chaque</em> conversion (Achat, Lead, Checkout…). Tu en saisis un
          par ligne dans la table « Conversions Google Ads » ci-dessous.
        </li>
      </ul>
      <p className="font-medium text-stone-900">Workflow recommandé :</p>
      <ol className="ml-5 list-decimal space-y-1">
        <li>
          Sur{' '}
          <a
            href="https://ads.google.com/aw/conversions"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-stone-400 underline-offset-2 hover:text-stone-900"
          >
            ads.google.com/aw/conversions
          </a>{' '}
          → <strong>+ Nouvelle action de conversion</strong> → <strong>Site web</strong>
        </li>
        <li>
          Choisis la <strong>catégorie</strong> qui correspond (Purchase /
          Submit lead form / Begin checkout / Sign-up / Contact / Add to cart /
          Other). Cf. tableau « Mapping FemiGlow × Google Ads » plus bas.
        </li>
        <li>
          Configure le <strong>nombre</strong> (Chaque pour transactions et
          engagement ; Une pour leads), la <strong>valeur</strong> (dynamique
          pour Purchase, estimée pour Lead, vide pour engagement), et la{' '}
          <strong>fenêtre</strong> (30j clic recommandé).
        </li>
        <li>
          Section <strong>Configuration de la balise</strong> →{' '}
          <strong>Utiliser Google Tag Manager</strong> → Google affiche un
          snippet du type <code>AW-18136327114/UGxLCMGJv6wcEMrHichD</code>.
        </li>
        <li>
          Copie <strong>uniquement</strong> la partie après le <code>/</code>{' '}
          (= le label) et colle-la dans la ligne FemiGlow correspondante
          (table ci-dessous, section « Conversions Google Ads »).
        </li>
        <li>
          Marque comme <strong>Conversion principale</strong> uniquement les
          conversions à fort impact business (Purchase, Lead). Les autres
          (Add to cart, Begin checkout, engagement) en <strong>Secondaire /
          observation</strong> pour ne pas polluer le Smart Bidding.
        </li>
      </ol>
      <Callout tone="warning">
        <strong>Piège fréquent</strong> : si tu colles le snippet complet
        (<code>AW-…/&lt;label&gt;</code>) dans le champ label, l'export GTM
        produira <code>AW-AW-…/&lt;label&gt;</code> (double préfixe). Colle
        uniquement la partie label.
      </Callout>
    </Section>
  );
}

function SectionMapping(): JSX.Element {
  const conversions = listAdsConversions();
  return (
    <Section number={3} title="Mapping FemiGlow × Google Ads" emoji="🔀">
      <p>
        FemiGlow utilise des noms canoniques (<code>purchase</code>,{' '}
        <code>lead_capture</code>, <code>checkout_intent</code>…). Le mapping
        traduit ces noms vers les conventions de chaque provider :
      </p>
      <CodeBlock>{`event-mapping.ts (source de vérité, code-as-data)

purchase →
    GA4         : 'purchase'              (event std)
    Meta        : 'Purchase'              (event std)
    Google Ads  : conv PURCHASE → label   (à saisir)
    TikTok      : 'CompletePayment'

lead_capture →
    GA4         : 'lead_capture'
    Meta        : 'Lead'                  (event std)
    Google Ads  : conv SUBMIT_LEAD_FORM → label
    TikTok      : 'SubmitForm'`}</CodeBlock>
      <p>
        <strong>{conversions.length} conversions Google Ads</strong> sont
        définies dans le mapping FemiGlow, réparties en 3 groupes (miroir des
        groupes Google Ads UI) :
      </p>
      <div className="overflow-hidden rounded-md border border-stone-200 bg-white text-xs">
        <table className="w-full">
          <thead className="bg-stone-50 text-stone-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Groupe</th>
              <th className="px-3 py-2 text-left font-medium">Conversion key</th>
              <th className="px-3 py-2 text-left font-medium">Catégorie Ads</th>
              <th className="px-3 py-2 text-left font-medium">Rôle</th>
              <th className="px-3 py-2 text-left font-medium">Events déclencheurs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {conversions.map((c) => (
              <tr key={c.conversionLabelKey}>
                <td className="px-3 py-1.5 capitalize text-stone-600">{c.group}</td>
                <td className="px-3 py-1.5 font-mono font-medium text-stone-900">
                  {c.conversionLabelKey}
                </td>
                <td className="px-3 py-1.5 font-mono text-stone-700">{c.category}</td>
                <td className="px-3 py-1.5 text-stone-600">
                  {c.recommendedRole === 'primary' ? '★ Principale' : 'Secondaire'}
                </td>
                <td className="px-3 py-1.5 font-mono text-[11px] text-stone-500">
                  {c.events.join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Plusieurs events FemiGlow peuvent partager la même conversion (1 label
        → N events). Exemple : <code>lead_capture</code>,{' '}
        <code>generate_lead</code> et <code>chat_lead_form_submit</code>{' '}
        déclenchent tous la même conversion <strong>Lead</strong> côté Google Ads.
      </p>
    </Section>
  );
}

function SectionExport(): JSX.Element {
  return (
    <Section number={4} title="Exporter & importer dans GTM" emoji="📦">
      <p className="font-medium text-stone-900">Workflow :</p>
      <ol className="ml-5 list-decimal space-y-1">
        <li>
          Sauvegarde ton plan (bouton <strong>Enregistrer</strong> au bas du
          wizard).
        </li>
        <li>
          Sur la page détail du plan → bouton <strong>Exporter GTM</strong> →
          télécharge le <code>plan-XXX.gtm.json</code>.
        </li>
        <li>
          Dans GTM UI →{' '}
          <a
            href="https://tagmanager.google.com"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-stone-400 underline-offset-2"
          >
            tagmanager.google.com
          </a>{' '}
          → onglet <strong>Admin</strong> → <strong>Importer un conteneur</strong>.
        </li>
        <li>
          Choisis le fichier téléchargé. Mode « <strong>Fusionner</strong> » si
          tu as des tags non-FemiGlow à préserver, sinon « Écraser ».
        </li>
        <li>
          GTM affiche un récap (tags ajoutés / modifiés). Confirme.
        </li>
        <li>
          <strong>Submit & Publish</strong> dans GTM pour déployer.
        </li>
      </ol>
      <p>L'export contient :</p>
      <ul className="ml-5 list-disc space-y-1">
        <li>
          <strong>Variables CONST</strong> : Conversion ID, pixel IDs, et un{' '}
          <code>CONST - Ads Label - &lt;key&gt;</code> par conversion configurée.
        </li>
        <li>
          <strong>Variables DLV</strong> : <code>ecommerce.transaction_id</code>,{' '}
          <code>ecommerce.value</code>, <code>ecommerce.currency</code>, et toutes
          les <code>user_data.*</code> pour Enhanced Conversions.
        </li>
        <li>
          <strong>Triggers</strong> : 1 trigger PageView + 1 trigger CustomEvent
          par event_key du plan.
        </li>
        <li>
          <strong>Tags</strong> : GA4 Config + GA4 Event par event + Meta Init +
          Meta Event par event + <strong>Ads Conversion</strong> par event avec
          label configuré (paramètre <code>conversionCategory</code> = enum API,
          Enhanced Conversions automatic mode = ON).
        </li>
      </ul>
      <Callout tone="info">
        L'export est <strong>déterministe</strong> : même plan → même{' '}
        <code>bundleId</code>. Re-télécharger sans changer le plan produit un
        fichier identique (sauf <code>exportTime</code>, exclu du hash).
      </Callout>
    </Section>
  );
}

function SectionEnhanced(): JSX.Element {
  return (
    <Section number={5} title="Enhanced Conversions / Advanced Matching" emoji="🔐">
      <p>
        Pour améliorer le taux d'attribution des conversions (entre 5 % et
        30 % de gain typique), Google Ads et Meta acceptent des{' '}
        <strong>données client hashées</strong> (SHA-256) en plus du{' '}
        <code>transaction_id</code>. FemiGlow envoie automatiquement :
      </p>
      <CodeBlock>{`dataLayer.push({
  event: 'purchase',
  transaction_id: 'FG-XXXX',
  value: 199,
  currency: 'MAD',
  user_data: {
    sha256_email_address: '<hash>',     ← email du client
    sha256_phone_number:  '<hash>',     ← téléphone
    address: {
      sha256_first_name:  '<hash>',
      sha256_last_name:   '<hash>',
      city:               'casablanca',  (clear, spec Google)
      country:            'maroc'        (clear)
    }
  }
});`}</CodeBlock>
      <p>
        Le hashing est fait <strong>côté navigateur</strong> via
        SubtleCrypto avant tout envoi — aucune donnée client en clair ne
        quitte le visiteur. GTM lit ces DLV via les variables{' '}
        <code>DLV - user_data.*</code> incluses automatiquement dans l'export.
      </p>
      <Callout tone="info">
        Côté Google Ads, active{' '}
        <strong>Enhanced Conversions for Web</strong> dans chaque conversion
        (Outils → Conversions → ta conversion → onglet « Conversions
        améliorées » → activer). Sans ça, les <code>user_data</code> sont
        ignorés.
      </Callout>
    </Section>
  );
}

function SectionValidation(): JSX.Element {
  return (
    <Section number={6} title="Valider — Tag Assistant + Diagnostics" emoji="✅">
      <p className="font-medium text-stone-900">Validation côté GTM Preview :</p>
      <ol className="ml-5 list-decimal space-y-1">
        <li>
          Ouvre{' '}
          <a
            href="https://tagassistant.google.com"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-stone-400 underline-offset-2"
          >
            tagassistant.google.com
          </a>{' '}
          → ajoute <code>https://femiglow-maroc.com</code>.
        </li>
        <li>
          Simule un funnel complet : home → /kit → ajout panier → formulaire
          (tape ≥ 1 char) → submit → achat.
        </li>
        <li>
          Vérifie les <strong>tags fired</strong> à chaque étape (cf. mapping).
        </li>
        <li>
          Inspecte le <strong>dataLayer</strong> côté DevTools :{' '}
          <code>window.dataLayer.filter(e =&gt; e.event === 'purchase')</code>{' '}
          → doit contenir le bloc <code>user_data.*</code>.
        </li>
      </ol>
      <p className="mt-3 font-medium text-stone-900">Diagnostic Google Ads (24-48h) :</p>
      <ul className="ml-5 list-disc space-y-1">
        <li>
          Conversions → onglet <strong>Diagnostic</strong> → toutes les
          conversions actives doivent passer en « ✓ Receiving conversions ».
        </li>
        <li>
          Conversions améliorées → <strong>Diagnostic</strong> → taux de match
          ≥ 70 % attendu (proxy de la qualité du hashing).
        </li>
      </ul>
      <Callout tone="warning">
        Si un tag ne fire pas en preview, vérifie d'abord :{' '}
        <strong>consent</strong> (le bandeau cookies doit être accepté),{' '}
        <strong>trigger</strong> (CustomEvent dont l'arg1 matche le nom de
        l'event), <strong>label</strong> (vérifie qu'il est renseigné dans
        FemiGlow et qu'il correspond à une conversion <em>active</em> côté Ads).
      </Callout>
    </Section>
  );
}

function SectionFaq(): JSX.Element {
  const items: Array<{ q: string; a: React.ReactNode }> = [
    {
      q: 'Je ne vois pas le bouton Éditer sur mon plan actif.',
      a: (
        <>
          Le bouton est visible pour les plans <code>draft</code> et{' '}
          <code>active</code>. Si ton plan est <code>archived</code>, clique
          d'abord sur <strong>Restaurer en brouillon</strong>.
        </>
      ),
    },
    {
      q: 'L\'export GTM ne contient pas tous les events de mon catalogue.',
      a: (
        <>
          Va dans l'étape <strong>Événements</strong> du wizard. Si un bandeau
          bleu propose <strong>« Synchroniser depuis le catalogue »</strong>,
          clique. Les nouveaux events sont ajoutés au plan avec leurs providers
          par défaut.
        </>
      ),
    },
    {
      q: 'Faut-il créer toutes les conversions Google Ads listées ?',
      a: (
        <>
          Non. Les conversions sont <strong>toutes optionnelles</strong>. Une
          étiquette vide = pas de tag <code>awct</code> exporté. Commence par
          Purchase et Lead, ajoute les autres au fil du temps.
        </>
      ),
    },
    {
      q: 'Une conversion peut-elle être marquée principale et secondaire en même temps ?',
      a: (
        <>
          Non — c'est une propriété par-campagne côté Google Ads. FemiGlow
          indique seulement le rôle <em>recommandé</em>. Tu peux toujours
          override dans Google Ads.
        </>
      ),
    },
    {
      q: 'Pourquoi mes conversions Ads n\'apparaissent pas même après import GTM ?',
      a: (
        <>
          Causes typiques : (1) GTM workspace pas publié (<strong>Submit</strong>{' '}
          oublié), (2) Conversion Google Ads en statut « inactive »,
          (3) Bandeau consentement refusé côté visiteur, (4) Étiquette de
          conversion typo'd (recopier depuis Google Ads, ne pas saisir
          manuellement).
        </>
      ),
    },
    {
      q: 'Mes Smart Bidding réagissent bizarrement après ajout d\'une conversion.',
      a: (
        <>
          Tu as probablement marqué une conversion <em>secondaire</em> (ex.
          Add to cart, Begin checkout) comme <strong>principale</strong> côté
          Ads. L'algo sur-optimise alors un signal de mauvaise qualité.
          Re-classe en <strong>Secondaire/observation</strong> et patiente
          7-14 jours.
        </>
      ),
    },
  ];
  return (
    <Section number={7} title="FAQ rapide" emoji="❓">
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i}>
            <p className="font-medium text-stone-900">— {it.q}</p>
            <p className="mt-0.5 text-stone-700">{it.a}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ─── primitives ──────────────────────────────────────────────── */

function Chevron(): JSX.Element {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-current transition-transform group-open/section:rotate-90 group-open:rotate-90"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CodeBlock({ children }: { children: string }): JSX.Element {
  return (
    <pre className="overflow-auto rounded-md border border-stone-200 bg-stone-50 p-3 font-mono text-[11px] leading-relaxed text-stone-800">
      <code>{children}</code>
    </pre>
  );
}

function Callout({
  tone,
  children,
}: {
  tone: 'info' | 'warning';
  children: React.ReactNode;
}): JSX.Element {
  const styles =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-sky-200 bg-sky-50 text-sky-900';
  const icon = tone === 'warning' ? '⚠️' : 'ℹ️';
  return (
    <div className={`rounded-md border ${styles} px-3 py-2 text-xs`}>
      <span className="mr-1.5" aria-hidden>
        {icon}
      </span>
      {children}
    </div>
  );
}
