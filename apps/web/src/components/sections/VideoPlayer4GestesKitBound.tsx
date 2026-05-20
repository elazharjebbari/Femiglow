/**
 * RSC wrapper qui résout l'override singleton `kit:video` côté serveur,
 * puis délègue à `<VideoPlayer4Gestes>` côté client.
 *
 * Cascade serveur :
 *   override publié → merge sur le mock (cf. `resolveKitVideo`)
 *   sinon → mock pur
 *
 * Différent de `VideoPlayer4GestesBound` (utilisé sur `/rituel`) qui résout
 * uniquement le poster via le binding média.
 */
import 'server-only';

import { VideoPlayer4Gestes } from './VideoPlayer4Gestes';
import { resolveKitVideo } from '@/lib/kit/video/resolver';

export function VideoPlayer4GestesKitBound(): JSX.Element {
  const { video } = resolveKitVideo();
  return <VideoPlayer4Gestes video={video} />;
}
