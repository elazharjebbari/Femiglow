'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Atelier } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Image } from '@/components/ui/Image';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';

export interface AtelierGalleryMediaSlot {
  thumbnail: ReactNode;
  full: ReactNode;
}

interface AtelierGalleryProps {
  data: Atelier;
  /**
   * Slots média (thumbnail + plein écran) résolus côté serveur, indexés sur
   * `data.gallerie`. Si absent ou plus court → fallback vers l'item.
   */
  mediaSlotsByIndex?: AtelierGalleryMediaSlot[];
}

export function AtelierGallery({ data, mediaSlotsByIndex }: AtelierGalleryProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (active !== null && !dialog.open) dialog.showModal();
    if (active === null && dialog.open) dialog.close();
  }, [active]);

  const close = () => setActive(null);
  const photo = active !== null ? data.gallerie[active] : null;

  return (
    <section className="bg-creme py-16 sm:py-24">
      <Container width="page">
        <div className="mb-10 flex flex-col gap-3 sm:max-w-[60ch]">
          <Kicker tone="champagne">L’atelier</Kicker>
          <Heading as="h2" size="display-md" italic="auto" balance>
            Casablanca, deux pièces calmes.
          </Heading>
          <p className="font-body text-sm uppercase tracking-[0.18em] text-encre/60">
            {data.adresse} — {data.quartier}
          </p>
          <div className="space-y-3 pt-2">
            {data.description.map((line, i) => (
              <Text key={i} size="body" prose tone="default">
                {line}
              </Text>
            ))}
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          {data.gallerie.map((img, i) => {
            const thumb = mediaSlotsByIndex?.[i]?.thumbnail;
            return (
              <li key={img.src}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Voir la photo : ${img.alt}`}
                  className="group block w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-encre/40 focus-visible:ring-offset-4 focus-visible:ring-offset-creme"
                >
                  {thumb ? (
                    <div className="aspect-[3/2] w-full overflow-hidden bg-encre/5 transition-transform duration-700 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                      {thumb}
                    </div>
                  ) : (
                    <Image
                      src={img.src}
                      alt={img.alt}
                      width={img.width}
                      height={img.height}
                      ratio="3:2"
                      sizes="(min-width: 1024px) 33vw, 100vw"
                      className="transition-transform duration-700 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Container>
      <dialog
        ref={dialogRef}
        onClose={close}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        aria-labelledby="atelier-dialog-title"
        className="m-0 max-h-screen max-w-screen-lg bg-transparent p-4 text-creme backdrop:bg-encre/95 sm:p-8"
      >
        {photo ? (
          <div className="flex flex-col gap-3">
            {active !== null && mediaSlotsByIndex?.[active]?.full ? (
              <div className="aspect-[3/2] w-full overflow-hidden">
                {mediaSlotsByIndex[active]!.full}
              </div>
            ) : (
              <Image
                src={photo.src}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                ratio="3:2"
                sizes="100vw"
                className="w-full"
              />
            )}
            <div className="flex items-start justify-between gap-4">
              <p
                id="atelier-dialog-title"
                className="font-body text-sm text-creme/80"
              >
                {photo.alt}
              </p>
              <button
                type="button"
                onClick={close}
                className="shrink-0 border border-creme/30 px-4 py-2 font-body text-xs uppercase tracking-[0.18em] text-creme transition-colors hover:border-creme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-creme/60"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </section>
  );
}
