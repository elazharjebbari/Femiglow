/**
 * Common email layout (header, body container, footer, Tailwind tokens).
 * Cf. docs/emailing/07-templates-system.md §4.
 */
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Section,
  Tailwind,
} from '@react-email/components';
import type { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

type Props = { preheader?: string; children: ReactNode };

export function BaseLayout({ preheader, children }: Props) {
  return (
    <Html lang="fr">
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="light only" />
      </Head>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                'brand-sauge': '#7C9A8A',
                'brand-champagne': '#E8D7B4',
                'brand-petale': '#F2C4C9',
                'brand-encre': '#0F2F2A',
                stone: {
                  50: '#FAFAF9',
                  100: '#F5F5F4',
                  200: '#E7E5E4',
                  600: '#57534E',
                  700: '#44403C',
                  900: '#1C1917',
                },
              },
              fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Cormorant Garamond', 'serif'],
              },
            },
          },
        }}
      >
        <Body className="bg-stone-100 font-sans text-stone-700">
          {preheader ? (
            <span style={{ display: 'none', opacity: 0, fontSize: 0, lineHeight: 0 }}>
              {preheader}
            </span>
          ) : null}
          <Container className="my-8 max-w-[600px] rounded-2xl bg-white p-8 shadow-sm">
            <Header />
            <Hr className="my-4 border-stone-200" />
            <Section>{children}</Section>
            <Hr className="my-6 border-stone-200" />
            <Footer />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
