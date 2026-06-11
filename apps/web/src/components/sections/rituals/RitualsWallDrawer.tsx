'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Fleuron } from '@/components/ui/Fleuron';
import { Kicker } from '@/components/ui/Kicker';
import { RitualCard } from './RitualCard';
import { RitualPhotoLightbox } from './RitualPhotoLightbox';
import { RitualsWallFilters, type RitualsFilterKey } from './RitualsWallFilters';
import { RitualsWizard } from './wizard/RitualsWizard';
import {
  DEFAULT_RITUALS_WALL_STRINGS,
  type RitualsWallStrings,
} from './strings';
import { useWallUrlState } from '@/lib/rituals/hooks/use-wall-url-state';
import type {
  RitualSummary,
  RitualTestimonialPublic,
} from '@/lib/schemas/rituals';

/**
 * Drawer « Rituels partagés » — version shell P1.6.
 * Cf. docs/reviews-wall/execution/05-frontend-plan-action.md § 6
 *    docs/reviews-wall/09-interface-publique.md § 3
 *
 * Implémentation sans Radix Dialog (pas dans les deps actuelles) :
 *  - <div role="dialog" aria-modal="true"> portalisé
 *  - Focus trap manuel (premier élément focusable au mount)
 *  - ESC ferme
 *  - Click overlay ferme
 *  - Body scroll lock pendant ouverture
 */

interface RitualsWallDrawerProps {
  productKey: string;
  /**
   * Phase 7 wiring — libellés STRUCTURELS localisés (défaut FR). Résolus côté
   * serveur dans le layout `/[locale]/kit` et injectés ici (ce composant est
   * client + fetche les données via API, donc les libellés transitent en prop).
   */
  strings?: RitualsWallStrings;
}


export function RitualsWallDrawer({
  productKey,
  strings = DEFAULT_RITUALS_WALL_STRINGS,
}: RitualsWallDrawerProps) {
  const { isOpen, view, close, setView, scrollToSlug } = useWallUrlState();
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <DrawerSurface
          productKey={productKey}
          view={view}
          onClose={close}
          onSwitchView={setView}
          scrollToSlug={scrollToSlug}
          reduceMotion={!!reduceMotion}
          strings={strings}
        />
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface DrawerSurfaceProps {
  productKey: string;
  view: 'list' | 'wizard' | 'policy';
  onClose: () => void;
  onSwitchView: (view: 'list' | 'wizard' | 'policy') => void;
  scrollToSlug: string | null;
  reduceMotion: boolean;
  strings: RitualsWallStrings;
}

interface ListResponse {
  data: RitualTestimonialPublic[];
  meta: { nextCursor: string | null; hasMore: boolean; total: number };
}

function DrawerSurface({
  productKey,
  view,
  onClose,
  onSwitchView,
  scrollToSlug,
  reduceMotion,
  strings,
}: DrawerSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [summary, setSummary] = useState<RitualSummary | null>(null);
  const [items, setItems] = useState<RitualTestimonialPublic[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<RitualsFilterKey>('all');
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ slug: string; index: number } | null>(null);

  // Lock scroll body
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Focus management : focus sur bouton fermer au mount
  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  // ESC ferme
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fetchSummary = useCallback(async () => {
    const res = await fetch(`/api/rituals/summary?product_key=${encodeURIComponent(productKey)}`);
    if (!res.ok) throw new Error('summary failed');
    const json = (await res.json()) as { data: RitualSummary };
    setSummary(json.data);
  }, [productKey]);

  const fetchList = useCallback(
    async (resetItems = true, nextCursor: string | null = null) => {
      const params = new URLSearchParams({
        product_key: productKey,
        limit: '12',
      });
      // TODO(7E-11): le drawer « voir tout » fetche côté client et ne connaît pas
      // la locale active. Pour localiser le mur complet, threader la locale en
      // prop (depuis le layout `/[locale]/kit`) puis ajouter `params.set('language', locale)`
      // — l'API /api/rituals/list accepte déjà le filtre `language` (repli FR).
      if (filter === 'with_photos') params.set('with_photos', '1');
      if (filter === 'halal') params.set('tags', 'halal');
      if (filter === 'recent') params.set('sort', 'recent');
      if (nextCursor) params.set('cursor', nextCursor);
      const res = await fetch(`/api/rituals/list?${params.toString()}`);
      if (!res.ok) throw new Error('list failed');
      const json = (await res.json()) as ListResponse;
      setItems((prev) => (resetItems ? json.data : [...prev, ...json.data]));
      setCursor(json.meta.nextCursor);
      setHasMore(json.meta.hasMore);
    },
    [productKey, filter],
  );

  // Initial + on filter change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchSummary(), fetchList(true, null)])
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchSummary, fetchList]);

  // Scroll vers carte ciblée
  useEffect(() => {
    if (!scrollToSlug || loading) return;
    const el = containerRef.current?.querySelector(
      `[data-public-slug="${scrollToSlug}"]`,
    );
    if (el) (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [scrollToSlug, loading]);

  const handleLoadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      await fetchList(false, cursor);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const total = summary?.totalCount ?? 0;
  const oui = summary?.ouiCount ?? 0;
  const topTags = (summary?.topTags ?? []).slice(0, 3);

  const drawerVariants = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.08 },
      }
    : {
        initial: { x: '100%', opacity: 0.9 },
        animate: { x: 0, opacity: 1 },
        exit: { x: '100%', opacity: 0.9 },
        transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
      };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rituals-wall-title"
      className="fixed inset-0 z-[300] flex justify-end"
    >
      <motion.button
        type="button"
        aria-label="Fermer le panneau (overlay)"
        onClick={onClose}
        className="absolute inset-0 bg-encre/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0.08 : 0.2 }}
      />
      <motion.div
        ref={containerRef}
        {...drawerVariants}
        className="relative ms-auto flex h-full w-full max-w-[480px] flex-col overflow-y-auto bg-creme"
        style={{ width: 'min(100vw, var(--ritual-drawer-width-desktop))' }}
      >
        {view === 'wizard' ? (
          <RitualsWizard
            productKey={productKey}
            onClose={onClose}
            onBackToList={() => onSwitchView('list')}
          />
        ) : (
          <>
        <header className="sticky top-0 z-10 border-b border-encre/10 bg-creme/95 backdrop-blur px-6 pb-4 pt-6">
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            data-testid="rituals-wall-close"
            className="mb-4 inline-flex h-11 w-11 items-center justify-center border border-encre/10 text-encre hover:bg-encre/5"
          >
            <span aria-hidden="true" className="text-xl">✕</span>
          </button>
          <Kicker tone="sauge">{strings.kicker}</Kicker>
          <h2
            id="rituals-wall-title"
            className="mt-1 font-cormorant text-2xl font-light text-encre"
          >
            {strings.title}
          </h2>
          <Fleuron size="sm" tone="champagne" className="my-3" />
          {summary && total > 0 ? (
            <div className="space-y-1">
              <p className="font-cormorant text-lg italic text-encre">
                {strings.headlinePlural
                  .replace('{total}', String(total))
                  .replace('{oui}', String(oui))}
              </p>
              {topTags.length > 0 && (
                <p className="font-inter text-xs text-encre/60">
                  {topTags
                    .map(
                      (t) => strings.card.tagLabels[t.tag] ?? t.tag.replace(/-/g, ' '),
                    )
                    .join(' · ')}
                </p>
              )}
            </div>
          ) : null}
        </header>

        <div className="border-b border-encre/10 bg-creme px-6 py-3">
          <RitualsWallFilters value={filter} onChange={setFilter} />
        </div>

        <div className="flex-1 px-6 py-6">
          {loading && items.length === 0 && (
            <ul className="space-y-4" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <li
                  key={i}
                  className="h-32 border border-sauge-soft bg-white p-5"
                  data-testid="rituals-wall-skeleton"
                />
              ))}
            </ul>
          )}

          {!loading && items.length === 0 && !error && (
            <div className="py-16 text-center">
              <Fleuron size="md" tone="champagne" className="mb-4" />
              <p className="font-cormorant text-lg italic text-encre">
                La maison écoute.
              </p>
              <p className="mt-1 text-sm text-encre/60">
                Soyez la première à partager votre rituel.
              </p>
            </div>
          )}

          {error && (
            <p className="bg-sauge-soft p-4 text-sm text-encre">
              La maison n&apos;a pas pu charger les rituels. Essayez à nouveau dans un instant.
            </p>
          )}

          {items.length > 0 && (
            <ul className="space-y-4" role="list">
              {items.map((item) => (
                <li key={item.publicSlug}>
                  <RitualCard
                    data={item}
                    variant="default"
                    highlighted={item.publicSlug === scrollToSlug}
                    strings={strings.card}
                    onPhotoClick={(idx) =>
                      setLightbox({ slug: item.publicSlug, index: idx })
                    }
                  />
                </li>
              ))}
            </ul>
          )}

          {lightbox &&
            (() => {
              const target = items.find((i) => i.publicSlug === lightbox.slug);
              if (!target) return null;
              const altName = target.signature.firstName ?? 'une initiée';
              return (
                <RitualPhotoLightbox
                  isOpen
                  photos={target.photos}
                  initialIndex={lightbox.index}
                  alt={`Photos partagées par ${altName}`}
                  onClose={() => setLightbox(null)}
                />
              );
            })()}

          {hasMore && (
            <div className="mt-6">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                data-testid="rituals-wall-load-more"
                className="w-full border border-sauge-soft bg-white py-3 text-sm font-medium text-encre transition-colors hover:bg-sauge-soft disabled:opacity-50"
              >
                {loadingMore
                  ? 'La maison cherche…'
                  : `Afficher plus (${items.length} / ${summary?.totalCount ?? '?'})`}
              </button>
            </div>
          )}

          {!hasMore && items.length > 0 && !loading && (
            <p className="mt-6 text-center font-cormorant text-sm italic text-encre/60">
              Vous avez lu toutes les voix de la maison.
            </p>
          )}
        </div>

        <footer className="sticky bottom-0 z-10 border-t border-encre/10 bg-creme/95 backdrop-blur px-6 py-4">
          <button
            type="button"
            onClick={() => onSwitchView('wizard')}
            data-testid="rituals-wall-share-link"
            className="mb-3 block w-full text-sm font-medium text-encre/80 transition-colors hover:text-encre"
          >
            Partager mon rituel →
          </button>
          <a
            href="/kit#kit-hero-produit"
            onClick={onClose}
            className="block w-full bg-encre py-4 text-center font-inter text-sm font-medium text-creme transition-colors hover:bg-encre-soft"
          >
            Recevoir le pack — 199 dh
          </a>
          <p className="mt-2 text-center text-xs text-encre/60">
            Livraison offerte au Maroc
          </p>
        </footer>
          </>
        )}
      </motion.div>
    </div>
  );
}
