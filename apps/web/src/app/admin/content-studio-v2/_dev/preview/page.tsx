'use client';

import { Sparkles, Upload, Settings, Heart, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Dialog,
  Input,
  Skeleton,
  Toaster,
} from '@/components/admin/content-studio-v2/primitives';
import { ThemeToggle } from '@/components/admin/content-studio-v2/shell/ThemeToggle';

/**
 * Visual QA page for v2 primitives.
 * Visible at /admin/content-studio-v2/_dev/preview (any env), no auth gating
 * because it does not expose data. Use it to verify light + dark + tokens.
 */
export default function PreviewPage() {
  return (
    <main style={{ padding: '40px 32px 80px', maxWidth: 1200, margin: '0 auto' }}>
      <Toaster />
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40, paddingBottom: 24, borderBottom: '1px solid var(--cs-border-hair)' }}>
        <div>
          <p className="cs-eyebrow">Content Studio v2 · Phase 0</p>
          <h1 className="cs-display" style={{ fontSize: 'var(--cs-text-3xl)', marginTop: 8 }}>
            Aperçu des <em style={{ color: 'var(--cs-accent)', fontStyle: 'italic' }}>primitives</em>
          </h1>
          <p style={{ color: 'var(--cs-fg-secondary)', marginTop: 6 }}>
            Galerie pour QA visuelle. Basculer light/dark via le toggle.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Boutons">
        <Stack>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="subtle">Subtle</Button>
          <Button variant="danger">Danger</Button>
        </Stack>
        <Stack>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </Stack>
        <Stack>
          <Button leftIcon={<Sparkles size={14} />}>Avec icône gauche</Button>
          <Button rightIcon={<ArrowRight size={14} />}>Icône droite</Button>
          <Button loading>Chargement…</Button>
          <Button disabled>Désactivé</Button>
        </Stack>
      </Section>

      <Section title="Inputs">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 24, maxWidth: 720 }}>
          <Input label="Nom de campagne" placeholder="Rituel d'été" />
          <Input label="Email" type="email" placeholder="contact@femiglow.test" />
          <Input label="Avec description" description="Petite aide contextuelle" placeholder="…" />
          <Input label="Avec erreur" error="Ce champ est requis" placeholder="…" />
        </div>
      </Section>

      <Section title="Badges">
        <Stack>
          <Badge tone="neutral">Brouillon</Badge>
          <Badge tone="accent">Variante A</Badge>
          <Badge tone="success">Publié</Badge>
          <Badge tone="warning">À revoir</Badge>
          <Badge tone="danger">Échec</Badge>
          <Badge tone="clay">Rituel</Badge>
          <Badge tone="sage">Conversion</Badge>
          <Badge tone="saffron">Considération</Badge>
          <Badge tone="violet">IA</Badge>
        </Stack>
      </Section>

      <Section title="Skeletons">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, maxWidth: 720 }}>
          <div>
            <Skeleton height={140} rounded="md" />
            <Skeleton width="60%" height={12} style={{ marginTop: 10 }} />
            <Skeleton width="80%" height={12} style={{ marginTop: 6 }} />
          </div>
          <div>
            <Skeleton height={140} rounded="md" />
            <Skeleton width="50%" height={12} style={{ marginTop: 10 }} />
            <Skeleton width="70%" height={12} style={{ marginTop: 6 }} />
          </div>
          <div>
            <Skeleton height={140} rounded="md" />
            <Skeleton width="65%" height={12} style={{ marginTop: 10 }} />
            <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
          </div>
        </div>
      </Section>

      <Section title="Dialog">
        <Dialog
          title="Publier le post ?"
          description="Cette action est irréversible. Le post apparaîtra immédiatement sur Instagram."
          trigger={<Button>Ouvrir le dialog</Button>}
          footer={
            <>
              <Button variant="ghost">Annuler</Button>
              <Button>Confirmer la publication</Button>
            </>
          }
        >
          <p style={{ color: 'var(--cs-fg-secondary)', fontSize: 'var(--cs-text-sm)' }}>
            Compte : <strong>femiglow.maroc · Instagram</strong>
          </p>
          <p style={{ color: 'var(--cs-fg-secondary)', fontSize: 'var(--cs-text-sm)', marginTop: 8 }}>
            Format : Post 4:5 · Variante A · Score brand 94/100.
          </p>
        </Dialog>
      </Section>

      <Section title="Toasts (sonner)">
        <Stack>
          <Button variant="ghost" onClick={() => toast.success('Brouillon enregistré')}>Toast succès</Button>
          <Button variant="ghost" onClick={() => toast.error('Échec de la génération IA')}>Toast erreur</Button>
          <Button variant="ghost" onClick={() => toast.message('Brouillon envoyé sur Postiz')}>Toast neutre</Button>
        </Stack>
      </Section>

      <Section title="Typographie">
        <div style={{ display: 'grid', gap: 16 }}>
          <p style={{ fontFamily: 'var(--cs-font-display)', fontSize: 44, fontWeight: 500, letterSpacing: '-0.02em' }}>
            Trois gestes lents, à la lumière d'une bougie.
          </p>
          <p style={{ fontFamily: 'var(--cs-font-display)', fontSize: 24, fontWeight: 500 }}>
            Sous-titre · display 24
          </p>
          <p style={{ fontFamily: 'var(--cs-font-body)', fontSize: 17 }}>
            Body 17 — Trois gestes lents, à la lumière d'une bougie. Le rituel commence quand on accepte que le soin prenne son temps.
          </p>
          <p style={{ fontFamily: 'var(--cs-font-body)', fontSize: 14, color: 'var(--cs-fg-secondary)' }}>
            Body 14 secondary — Texte de description pour annotation ou contexte
          </p>
          <p className="cs-mono" style={{ fontSize: 13, color: 'var(--cs-fg-muted)' }}>
            Mono 13 muted — for IDs, timings, technical labels
          </p>
        </div>
      </Section>

      <Section title="Surfaces">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {(['base', 'elevated', 'sunken', 'feature'] as const).map((kind) => (
            <div
              key={kind}
              style={{
                padding: 24,
                borderRadius: 'var(--cs-radius-md)',
                background: `var(--cs-bg-${kind})`,
                border: '1px solid var(--cs-border-hair)',
                color: 'var(--cs-fg-primary)',
              }}
            >
              <p className="cs-eyebrow">{kind}</p>
              <p style={{ marginTop: 4 }}>var(--cs-bg-{kind})</p>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 56 }}>
      <h2 style={{ fontFamily: 'var(--cs-font-display)', fontSize: 'var(--cs-text-xl)', fontWeight: 500, marginBottom: 20, letterSpacing: '-0.005em', color: 'var(--cs-fg-primary)' }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>{children}</div>
    </section>
  );
}

function Stack({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>{children}</div>;
}
