/**
 * Render pipeline : React component → { html, text, subject }.
 *
 * Uses @react-email/render to produce inline-styled HTML, then html-to-text
 * to derive a clean text/plain alternative.
 *
 * Cf. docs/emailing/07-templates-system.md §3.
 */
import { render } from '@react-email/render';
import { htmlToText } from 'html-to-text';
import { createElement } from 'react';
import {
  getTemplateMeta,
  isKnownTemplate,
  type TemplateRegistry,
  type TemplateSlug,
} from './catalog';

export type RenderedEmail = {
  html: string;
  text: string;
  subject: string;
  preheader: string;
};

export async function renderTemplate<S extends TemplateSlug>(
  slug: S,
  payload: TemplateRegistry[S],
): Promise<RenderedEmail> {
  if (!isKnownTemplate(slug)) throw new Error(`Unknown template: ${slug}`);
  const meta = getTemplateMeta(slug);
  const parsed = meta.schema.parse(payload);

  const element = createElement(meta.component as any, parsed as any);
  const html = await render(element, { pretty: false });
  const text = htmlToText(html, {
    wordwrap: 78,
    selectors: [
      { selector: 'img', format: 'skip' },
      { selector: 'a', options: { ignoreHref: false } },
      { selector: 'head', format: 'skip' },
    ],
  });
  const subject = meta.subjectFn(parsed);
  const preheader = meta.preheaderFn ? meta.preheaderFn(parsed) : '';

  return { html, text, subject, preheader };
}
