import { notFound } from 'next/navigation';
import { MediaImage, MediaVideo, MediaAudio } from '@/lib/media';

export const dynamic = 'force-dynamic';

export default function MediaDemoPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main className="mx-auto max-w-3xl space-y-12 px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold text-stone-900">Démo composants média</h1>
        <p className="mt-2 text-sm text-stone-600">
          Page de référence (dev only) pour vérifier visuellement le rendu de
          <code className="mx-1 rounded bg-stone-100 px-1 text-xs">&lt;MediaImage&gt;</code>,
          <code className="mx-1 rounded bg-stone-100 px-1 text-xs">&lt;MediaVideo&gt;</code> et
          <code className="mx-1 rounded bg-stone-100 px-1 text-xs">&lt;MediaAudio&gt;</code>.
        </p>
      </header>

      <section aria-labelledby="img-title" className="space-y-4">
        <h2 id="img-title" className="text-xl font-medium text-stone-800">
          Image (hero)
        </h2>
<MediaImage
          slug="home-mains-yasmine"
          context="hero"
          priority
          className="overflow-hidden rounded-2xl"
          fallback="/og.png"
          route="/dev/media-demo"
        />
      </section>

      <section aria-labelledby="img-inline-title" className="space-y-4">
        <h2 id="img-inline-title" className="text-xl font-medium text-stone-800">
          Image (inline avec lazy)
        </h2>
<MediaImage
          slug="journal-pluie-de-mars"
          context="inline"
          className="overflow-hidden rounded-xl"
          fallback="/og.png"
          route="/dev/media-demo"
        />
      </section>

      <section aria-labelledby="video-title" className="space-y-4">
        <h2 id="video-title" className="text-xl font-medium text-stone-800">
          Vidéo (interaction lazy)
        </h2>
<MediaVideo
          slug="rituel-demo"
          lazy="interaction"
          className="overflow-hidden rounded-xl"
          route="/dev/media-demo"
        />
      </section>

      <section aria-labelledby="audio-title" className="space-y-4">
        <h2 id="audio-title" className="text-xl font-medium text-stone-800">
          Audio
        </h2>
<MediaAudio
          slug="meditation-guidee"
          controls
          route="/dev/media-demo"
        />
      </section>
    </main>
  );
}
