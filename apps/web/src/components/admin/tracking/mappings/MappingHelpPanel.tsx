'use client';

import { useState } from 'react';

/**
 * MappingHelpPanel — Panneau pédagogique collapsible.
 *
 * Affiche un bandeau compact toujours visible. Au click "Voir la démarche
 * complète", expand pour révéler l'explication détaillée du module et de
 * son intégration avec GTM Web (ordre des imports, traduction technique).
 *
 * Design choice : `<details>`/`<summary>` natif n'est pas utilisé ici pour
 * garder le contrôle sur le styling et l'animation. État local React.
 *
 * Cf. discussion conversation 2026-05-14 sur la clarification des 2 imports.
 */
export function MappingHelpPanel() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      aria-labelledby="mapping-help-title"
      className="rounded-md border border-stone-200 bg-stone-50 text-stone-700"
      data-testid="mapping-help-panel"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="mapping-help-content"
        data-testid="btn-toggle-help"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-100"
      >
        <div className="flex items-center gap-2 text-sm">
          <span aria-hidden="true">💡</span>
          <span id="mapping-help-title" className="font-medium text-stone-900">
            Comprendre les mappings et leur intégration avec GTM
          </span>
          <span className="hidden text-xs text-stone-500 sm:inline">
            — séparation configs / mappings, ordre d'import, traduction en tags GTM
          </span>
        </div>
        <span className="text-xs text-stone-500" aria-hidden="true">
          {expanded ? '▴ Replier' : '▾ Voir la démarche complète'}
        </span>
      </button>

      {expanded ? (
        <div
          id="mapping-help-content"
          className="space-y-6 border-t border-stone-200 px-4 py-5 text-sm"
        >
          {/* 1. Vue d'ensemble */}
          <div className="space-y-2">
            <h3 className="font-semibold text-stone-900">1. À quoi sert ce module ?</h3>
            <p>
              Ce module pilote <strong>le nom d'event envoyé à chaque vendor</strong> (Meta,
              GA4, Google Ads, TikTok, Snap, Pinterest) quand le visiteur déclenche un event
              canonique FemiGlow (<code className="rounded bg-white px-1 py-0.5 font-mono text-xs">purchase</code>,{' '}
              <code className="rounded bg-white px-1 py-0.5 font-mono text-xs">lead_capture</code>, etc.).
            </p>
            <p>
              Une modification ici a <strong>2 effets distincts</strong> :
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>
                <strong>Côté serveur (CAPI)</strong> — effet <span className="text-emerald-700">immédiat</span>{' '}
                (cache 30s) : le dispatcher utilise le nouveau nom dès l'activation de la version.
              </li>
              <li>
                <strong>Côté client (GTM Web)</strong> — effet <span className="text-amber-700">manuel</span> :
                il faut exporter le fichier ici puis l'importer dans GTM Web et publier.
              </li>
            </ul>
          </div>

          {/* 2. Schéma simplifié */}
          <div className="space-y-2">
            <h3 className="font-semibold text-stone-900">2. Architecture en un schéma</h3>
            <pre className="overflow-x-auto rounded-md border border-stone-200 bg-white p-3 font-mono text-[11px] leading-tight text-stone-700">
{`     Console admin FemiGlow                       Container GTM Web (Google)
  ┌─────────────────────────┐                   ┌──────────────────────────┐
  │ /admin/tracking/plans   │── export ⓵ ─────►│ Variables constantes :    │
  │   envProfiles           │  (Pixel IDs)      │  {{Meta Pixel ID}}        │
  │   Pixel IDs, Conv labels│                   │  {{GA4 Measurement ID}}  │
  └─────────────────────────┘                   │  {{Ads Customer ID}}      │
                                                 └──────────────────────────┘
                                                              │
  ┌─────────────────────────┐                                 │ (référencées par)
  │ /admin/tracking/events  │── export ⓶ ─────►              ▼
  │   /mappings             │  (Tags+Triggers)  ┌──────────────────────────┐
  │   Cette page ici        │                   │ Tags GTM :                │
  │   Noms event→vendor     │                   │  "FemiGlow: meta —        │
  └─────────────────────────┘                   │   purchase"                │
                                                 │  eventName="Purchase"      │
                                                 │  pixelId={{Meta Pixel ID}}│
                                                 │                            │
                                                 │ Triggers :                 │
                                                 │  customEvent "purchase"    │
                                                 │                            │
                                                 │ Variables DLV :            │
                                                 │  {{DLV - event_id}}        │
                                                 │  {{DLV - currency}}        │
                                                 └──────────────────────────┘
                                                              │
                                                              ▼
                                                  gtm.js servi aux visiteurs`}
            </pre>
          </div>

          {/* 3. Démarche complète */}
          <div className="space-y-2">
            <h3 className="font-semibold text-stone-900">3. Démarche complète à suivre</h3>
            <ol className="space-y-3 list-none">
              <li className="rounded-md border border-stone-200 bg-white px-3 py-2">
                <span className="font-medium text-stone-900">⓵ Configurer d'abord les envProfiles du plan</span>
                <p className="mt-1 text-xs text-stone-600">
                  Va sur{' '}
                  <a href="/admin/tracking/plans" className="font-mono underline">/admin/tracking/plans</a>{' '}
                  pour saisir les Pixel IDs et Conv labels par environnement
                  (production/staging/local) via les envProfiles du plan unifié. Active le plan, puis utilise le bouton « Exporter GTM ».
                  <strong> C'est l'import #1.</strong>
                </p>
              </li>
              <li className="rounded-md border border-stone-200 bg-white px-3 py-2">
                <span className="font-medium text-stone-900">⓶ Importer Configs dans GTM Web</span>
                <p className="mt-1 text-xs text-stone-600">
                  Va sur{' '}
                  <a
                    href="https://tagmanager.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    tagmanager.google.com
                  </a>
                  . Sélectionne ton container Web FemiGlow. <strong>Admin {'>'} Importer un
                  container</strong> {'>'} drag-drop le JSON Configs. Mode <strong>Merge</strong>{' '}
                  + renommer les conflits. Confirme. Les <em>Variables Constantes</em>{' '}
                  <code className="rounded bg-stone-100 px-1 font-mono text-[11px]">{'{{Meta Pixel ID}}'}</code>{' '}
                  etc. sont créées.
                </p>
              </li>
              <li className="rounded-md border border-stone-200 bg-white px-3 py-2">
                <span className="font-medium text-stone-900">⓷ Configurer les mappings (ici)</span>
                <p className="mt-1 text-xs text-stone-600">
                  Sur cette page <strong>/admin/tracking/events/mappings</strong>, crée ou édite
                  une version. Configure le nom d'event pour chaque cellule
                  Event × Vendor (l'autocomplete propose les noms standards reconnus par chaque
                  plateforme). Active la version.
                </p>
              </li>
              <li className="rounded-md border border-stone-200 bg-white px-3 py-2">
                <span className="font-medium text-stone-900">⓸ Exporter les mappings (JSON #2)</span>
                <p className="mt-1 text-xs text-stone-600">
                  Click le bouton <strong>📥 Exporter GTM</strong> sur la page détail de la
                  version active. Choisis l'environnement (production). Télécharge le JSON.
                  <strong> C'est l'import #2.</strong>
                </p>
              </li>
              <li className="rounded-md border border-stone-200 bg-white px-3 py-2">
                <span className="font-medium text-stone-900">⓹ Importer Mappings dans GTM Web</span>
                <p className="mt-1 text-xs text-stone-600">
                  Retour sur GTM Web. <strong>Admin {'>'} Importer un container</strong> {'>'}{' '}
                  drag-drop ce 2ème JSON. Mode <strong>Merge</strong>. Preview : tu vois
                  apparaître les <em>Tags</em> (1 par cellule active), les <em>Triggers</em>{' '}
                  custom event (1 par event canonique) et les <em>Variables DLV</em>.
                </p>
              </li>
              <li className="rounded-md border border-stone-200 bg-white px-3 py-2">
                <span className="font-medium text-stone-900">⓺ Publier le workspace GTM</span>
                <p className="mt-1 text-xs text-stone-600">
                  En haut à droite dans GTM Web, click <strong>Submit</strong> {'>'}{' '}
                  <strong>Publish</strong>. À partir de là, le nouveau <code>gtm.js</code> est
                  servi aux visiteurs et le client envoie les nouveaux events_name.
                </p>
              </li>
              <li className="rounded-md border border-stone-200 bg-white px-3 py-2">
                <span className="font-medium text-stone-900">⓻ Vérifier (smoke test)</span>
                <p className="mt-1 text-xs text-stone-600">
                  Dans GTM Web {'>'} <em>Preview mode</em>, fais un parcours d'achat test sur
                  le site. Vérifie que les tags fire avec le bon{' '}
                  <code className="rounded bg-stone-100 px-1 font-mono text-[11px]">eventName</code>.
                  Côté Meta Events Manager, regarde le test event apparaître avec le bon{' '}
                  <code className="rounded bg-stone-100 px-1 font-mono text-[11px]">event_name</code>{' '}
                  côté Pixel ET côté CAPI (dédupliqués par <code>event_id</code>).
                </p>
              </li>
            </ol>
          </div>

          {/* 4. Comment GTM interprète notre fichier */}
          <div className="space-y-2">
            <h3 className="font-semibold text-stone-900">4. Comment GTM interprète le fichier ?</h3>
            <p>
              GTM ne connaît pas le concept de "mapping". Notre exporter <strong>traduit</strong> chaque
              cellule du tableau en 3 types d'artefacts natifs GTM :
            </p>
            <ul className="ml-5 list-disc space-y-1 text-xs">
              <li>
                <strong>1 Trigger</strong> custom event par event canonique :{' '}
                <code className="rounded bg-white px-1 font-mono">FemiGlow: purchase</code> fire
                quand <code className="font-mono">dataLayer.push{'{'}event:'purchase'{'}'}</code>{' '}
                est appelé côté client.
              </li>
              <li>
                <strong>1 Tag</strong> par cellule active (event × provider). Le tag a un{' '}
                <code className="font-mono">type</code> spécifique au provider (
                <code className="font-mono">cvt_meta_pixel</code>, <code className="font-mono">googtag</code>
                , etc.), un paramètre <code className="font-mono">eventName="Purchase"</code>, et
                pointe vers le trigger correspondant.
              </li>
              <li>
                <strong>Variables DLV</strong> (Data Layer Variables) pour les paramètres utiles
                (<code className="font-mono">event_id</code>, <code className="font-mono">currency</code>,{' '}
                <code className="font-mono">value</code>, etc.). Les <em>Variables constantes</em>{' '}
                comme <code className="font-mono">{'{{Meta Pixel ID}}'}</code> sont référencées
                mais doivent venir de l'<strong>import #1</strong> (Configs GTM).
              </li>
            </ul>
            <p className="text-xs">
              Quand le visiteur déclenche <code className="font-mono">purchase</code>, GTM
              voit le trigger fire, exécute tous les tags reliés en parallèle
              (Meta Pixel, GA4, TikTok, etc.) — chacun fait son call API vendor avec son{' '}
              <code className="font-mono">eventName</code> à lui.
            </p>
          </div>

          {/* 5. Encadré important */}
          <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <strong>⚠ Important — cohérence client/serveur</strong>
            <p className="mt-1">
              Si tu modifies un mapping ici sans exporter+importer dans GTM, le canal serveur (CAPI)
              utilise le nouveau nom mais le canal client (gtag.js/fbq) reste sur l'ancien.
              Résultat : 2 events avec le même <code className="font-mono">event_id</code> mais des{' '}
              <code className="font-mono">event_name</code> différents → pas dédupliqué → conversions
              comptées en double côté Meta/Ads. <strong>Toujours faire le tandem : édit → activate
              → export → import GTM → publish.</strong>
            </p>
          </div>

          {/* 6. FAQ rapide */}
          <div className="space-y-2">
            <h3 className="font-semibold text-stone-900">5. FAQ rapide</h3>
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="font-medium text-stone-800">
                  Q : Pourquoi 2 imports successifs et pas un seul fichier ?
                </dt>
                <dd className="text-stone-600">
                  R : Les Pixel IDs changent rarement et restent stables par environnement. Les
                  mappings événements/vendors changent plus souvent (renommage CustomEvent, ajout
                  de provider, etc.). Séparer permet de versionner chacun indépendamment.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-stone-800">
                  Q : J'ai modifié uniquement le mapping. Je peux skip l'import Configs ?
                </dt>
                <dd className="text-stone-600">
                  R : Oui, si les Configs GTM (Pixel IDs) n'ont pas changé, tu réimportes
                  seulement le mapping (import #2). Les variables constantes existantes
                  dans GTM sont conservées.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-stone-800">
                  Q : Que se passe-t-il si je ne fais jamais l'import GTM ?
                </dt>
                <dd className="text-stone-600">
                  R : Le canal serveur (CAPI) marche avec le nouveau mapping, mais le canal client
                  (gtm.js) sert toujours l'ancienne version. Si tu utilises{' '}
                  <code className="font-mono">event_id</code> partagé, tu auras un risque de
                  double comptage des conversions.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-stone-800">
                  Q : Le bouton "Tester" valide-t-il aussi le côté client ?
                </dt>
                <dd className="text-stone-600">
                  R : Non. Le bouton "Tester" simule uniquement le dispatch <strong>serveur</strong>{' '}
                  (dry-run, pas d'appel réseau). Pour tester le côté client, utilise GTM Preview
                  Mode sur le site (étape ⓻).
                </dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}
    </section>
  );
}
