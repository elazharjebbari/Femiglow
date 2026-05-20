import { env } from '../src/lib/env';
import {
  createContentIdea,
  generateIdeaDrafts,
  generateVisualForDraft,
  listContentStudioMedia,
} from '../src/lib/content-studio/service';

async function main() {
  const allowOpenAi = process.argv.includes('--allow-openai');
  if (env.CONTENT_STUDIO_IMAGE_PROVIDER !== 'mock' && !allowOpenAi) {
    throw new Error(
      'Smoke refusé: CONTENT_STUDIO_IMAGE_PROVIDER n’est pas mock. Ajoutez --allow-openai pour consommer du solde.',
    );
  }

  const idea = await createContentIdea({
    pillar: 'rituel',
    objective: 'consideration',
    platform: 'instagram',
    format: 'post',
    prompt: 'Smoke test Content Studio: valider le pipeline visuel IA sans publication automatique.',
    actorId: null,
  });
  const generated = await generateIdeaDrafts({ ideaId: idea.id, actorId: null });
  const draft = generated.drafts[0];
  if (!draft) throw new Error('Aucun brouillon généré.');

  const media = await generateVisualForDraft({
    draftId: draft.id,
    actorId: null,
    prompt: 'Visuel smoke test FemiGlow, composition simple, sans texte lisible, rendu editorial.',
    size: '1024x1024',
    quality: 'low',
  });
  if (media.compartment !== 'ai_generated') {
    throw new Error(`Compartiment inattendu: ${media.compartment}`);
  }
  if (!media.previewUrl) {
    throw new Error('Média IA sans previewUrl.');
  }

  const aiMedia = await listContentStudioMedia({ compartment: 'ai_generated', limit: 5 });
  if (!aiMedia.some((item) => item.id === media.id)) {
    throw new Error('Média IA généré absent du compartiment IA.');
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        provider: env.CONTENT_STUDIO_IMAGE_PROVIDER,
        model: env.CONTENT_STUDIO_IMAGE_MODEL,
        ideaId: idea.id,
        draftId: draft.id,
        mediaId: media.id,
        previewUrl: media.previewUrl,
        aiMediaCount: aiMedia.length,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
