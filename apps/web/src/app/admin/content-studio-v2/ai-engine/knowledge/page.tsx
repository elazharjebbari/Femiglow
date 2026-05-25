'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Database,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/admin/content-studio-v2/primitives';
import { Badge } from '@/components/admin/content-studio-v2/primitives';
import { Input } from '@/components/admin/content-studio-v2/primitives';

interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  documentCount: number;
  chunkCount: number;
  lastIndexedAt: string | null;
  isActive: boolean;
}

interface Document {
  id: string;
  title: string;
  sourceType: string;
  chunkCount: number;
  createdAt: string;
}

interface EmbedResult {
  documentsProcessed: number;
  chunksCreated: number;
  errors?: string[];
  message?: string;
}

const CATEGORY_BADGE: Record<string, { label: string; tone: 'neutral' | 'accent' | 'success' | 'warning' | 'sage' | 'saffron' | 'violet' | 'clay' }> = {
  science: { label: 'Science', tone: 'accent' },
  platform: { label: 'Plateforme', tone: 'violet' },
  strategy: { label: 'Stratégie', tone: 'saffron' },
  operations: { label: 'Opérations', tone: 'clay' },
  trends: { label: 'Tendances', tone: 'warning' },
  brand: { label: 'Marque', tone: 'sage' },
  craft: { label: 'Craft', tone: 'neutral' },
};

function formatDate(iso: string | null): string {
  if (!iso) return 'Jamais';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function KnowledgeBasePage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Record<string, Document[]>>({});
  const [loadingDocs, setLoadingDocs] = useState<string | null>(null);

  const [showForm, setShowForm] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);

  const [embedding, setEmbedding] = useState(false);
  const [embedResult, setEmbedResult] = useState<EmbedResult | null>(null);
  const [embedError, setEmbedError] = useState<string | null>(null);

  const fetchCollections = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/admin/ai-engine/knowledge');
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setCollections(data.collections ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  async function fetchDocuments(slug: string) {
    setLoadingDocs(slug);
    try {
      const res = await fetch(`/api/admin/ai-engine/knowledge/${slug}/documents`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setDocuments((prev) => ({ ...prev, [slug]: data.documents ?? [] }));
    } catch {
      setDocuments((prev) => ({ ...prev, [slug]: [] }));
    } finally {
      setLoadingDocs(null);
    }
  }

  function toggleExpand(collection: Collection) {
    if (expandedId === collection.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(collection.id);
    if (!documents[collection.slug]) {
      fetchDocuments(collection.slug);
    }
  }

  async function handleIngest(slug: string) {
    if (!formTitle.trim() || !formContent.trim()) return;
    setIngesting(true);
    setIngestError(null);
    setIngestSuccess(null);
    try {
      const res = await fetch(`/api/admin/ai-engine/knowledge/${slug}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: 'text',
          title: formTitle.trim(),
          content: formContent.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? data?.detail ?? `Erreur ${res.status}`);
      }
      const data = await res.json();
      setIngestSuccess(`Document ingéré avec ${data.chunkCount} chunks`);
      setFormTitle('');
      setFormContent('');
      setShowForm(null);
      await fetchDocuments(slug);
      await fetchCollections();
    } catch (e: unknown) {
      setIngestError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setIngesting(false);
    }
  }

  async function handleEmbed() {
    setEmbedding(true);
    setEmbedResult(null);
    setEmbedError(null);
    try {
      const res = await fetch('/api/admin/ai-engine/knowledge/embed', {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? data?.error ?? `Erreur ${res.status}`);
      }
      const data: EmbedResult = await res.json();
      setEmbedResult(data);
      await fetchCollections();
    } catch (e: unknown) {
      setEmbedError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setEmbedding(false);
    }
  }

  const totalDocs = collections.reduce((s, c) => s + c.documentCount, 0);
  const totalChunks = collections.reduce((s, c) => s + c.chunkCount, 0);
  const pendingDocs = collections.filter((c) => c.documentCount > 0 && c.chunkCount === 0).length;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[80, 100, 100, 100].map((h, i) => (
          <div
            key={i}
            style={{
              background: 'var(--cs-bg-elevated)',
              border: '1px solid var(--cs-border)',
              borderRadius: 'var(--cs-radius-md)',
              minHeight: h,
              padding: 16,
            }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <section
        style={{
          background: 'var(--cs-danger-bg)',
          border: '1px solid var(--cs-danger)',
          borderRadius: 'var(--cs-radius-md)',
          padding: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <AlertTriangle size={20} style={{ color: 'var(--cs-danger)', flexShrink: 0 }} />
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--cs-text-sm)' }}>
            Impossible de charger la base de connaissances
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-secondary)' }}>
            {error}
          </p>
        </div>
      </section>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link
            href="/admin/content-studio-v2/ai-engine"
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 32,
              height: 32,
              borderRadius: 'var(--cs-radius)',
              background: 'var(--cs-bg-sunken)',
              color: 'var(--cs-fg-secondary)',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <p className="cs-eyebrow" style={{ marginBottom: 6 }}>AI Engine</p>
            <h1
              className="cs-display"
              style={{
                margin: 0,
                fontSize: 'var(--cs-text-2xl)',
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              Base de connaissances
            </h1>
          </div>
        </div>
        <Button
          onClick={handleEmbed}
          loading={embedding}
          leftIcon={<Sparkles size={14} />}
        >
          Générer les embeddings
        </Button>
      </header>

      {embedResult && (
        <section
          style={{
            background: 'var(--cs-success-bg)',
            border: '1px solid var(--cs-success)',
            borderRadius: 'var(--cs-radius-md)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <CheckCircle2 size={18} style={{ color: 'var(--cs-success)', flexShrink: 0 }} />
          <div style={{ fontSize: 'var(--cs-text-sm)' }}>
            {embedResult.message ? (
              <p style={{ margin: 0 }}>{embedResult.message}</p>
            ) : (
              <p style={{ margin: 0 }}>
                {embedResult.documentsProcessed} document{embedResult.documentsProcessed > 1 ? 's' : ''} traité{embedResult.documentsProcessed > 1 ? 's' : ''},{' '}
                <strong>{embedResult.chunksCreated}</strong> chunks créés
              </p>
            )}
            {embedResult.errors && embedResult.errors.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: 'var(--cs-danger)' }}>
                {embedResult.errors.map((e, i) => (
                  <li key={i} style={{ fontSize: 'var(--cs-text-xs)' }}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {embedError && (
        <section
          style={{
            background: 'var(--cs-danger-bg)',
            border: '1px solid var(--cs-danger)',
            borderRadius: 'var(--cs-radius-md)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <AlertTriangle size={18} style={{ color: 'var(--cs-danger)', flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 'var(--cs-text-sm)' }}>{embedError}</p>
        </section>
      )}

      {ingestSuccess && (
        <section
          style={{
            background: 'var(--cs-success-bg)',
            border: '1px solid var(--cs-success)',
            borderRadius: 'var(--cs-radius-md)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <CheckCircle2 size={18} style={{ color: 'var(--cs-success)', flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 'var(--cs-text-sm)' }}>{ingestSuccess}</p>
        </section>
      )}

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
        }}
      >
        <StatCard icon={<BookOpen size={16} />} label="Collections" value={collections.length} />
        <StatCard icon={<FileText size={16} />} label="Documents" value={totalDocs} />
        <StatCard icon={<Hash size={16} />} label="Chunks" value={totalChunks} />
        <StatCard
          icon={<Database size={16} />}
          label="En attente"
          value={pendingDocs}
          tone={pendingDocs > 0 ? 'warning' : 'success'}
        />
      </section>

      {collections.length === 0 ? (
        <section
          style={{
            background: 'var(--cs-bg-elevated)',
            border: '1px solid var(--cs-border-hair)',
            borderRadius: 'var(--cs-radius-lg)',
            padding: '64px 48px',
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
            minHeight: 300,
            boxShadow: 'var(--cs-shadow-sm)',
          }}
        >
          <div style={{ maxWidth: 420 }}>
            <div
              style={{
                marginBottom: 24,
                display: 'inline-grid',
                placeItems: 'center',
                width: 64,
                height: 64,
                borderRadius: 'var(--cs-radius-full)',
                background: 'var(--cs-bg-sunken)',
                color: 'var(--cs-accent)',
              }}
            >
              <BookOpen size={24} />
            </div>
            <h2
              className="cs-display"
              style={{
                fontSize: 'var(--cs-text-xl)',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: 'var(--cs-fg-primary)',
              }}
            >
              Aucune collection
            </h2>
            <p
              style={{
                marginTop: 8,
                fontSize: 'var(--cs-text-sm)',
                color: 'var(--cs-fg-secondary)',
                lineHeight: 1.6,
              }}
            >
              Lancez le seed de la base de connaissances pour créer les collections et documents initiaux.
            </p>
          </div>
        </section>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {collections.map((col) => {
            const isExpanded = expandedId === col.id;
            const catBadge = CATEGORY_BADGE[col.category] ?? { label: col.category, tone: 'neutral' as const };
            const docs = documents[col.slug];
            const isLoadingDocs = loadingDocs === col.slug;

            return (
              <section
                key={col.id}
                style={{
                  background: 'var(--cs-bg-elevated)',
                  border: '1px solid var(--cs-border-hair)',
                  borderRadius: 'var(--cs-radius-md)',
                  boxShadow: 'var(--cs-shadow-sm)',
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => toggleExpand(col)}
                  style={{
                    width: '100%',
                    padding: '18px 22px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    textAlign: 'left',
                    color: 'inherit',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ color: 'var(--cs-fg-muted)', flexShrink: 0 }}>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span
                        style={{
                          fontFamily: 'var(--cs-font-display)',
                          fontWeight: 500,
                          fontSize: 'var(--cs-text-sm)',
                          color: 'var(--cs-fg-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {col.name}
                      </span>
                      <Badge tone={catBadge.tone} size="sm">{catBadge.label}</Badge>
                    </div>
                    {col.description && (
                      <p
                        style={{
                          margin: 0,
                          fontSize: 'var(--cs-text-xs)',
                          color: 'var(--cs-fg-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {col.description}
                      </p>
                    )}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 20,
                      flexShrink: 0,
                      fontSize: 'var(--cs-text-xs)',
                      color: 'var(--cs-fg-muted)',
                    }}
                  >
                    <span>
                      <strong style={{ color: 'var(--cs-fg-secondary)' }}>{col.documentCount}</strong> doc{col.documentCount !== 1 ? 's' : ''}
                    </span>
                    <span>
                      <strong style={{ color: 'var(--cs-fg-secondary)' }}>{col.chunkCount}</strong> chunk{col.chunkCount !== 1 ? 's' : ''}
                    </span>
                    <span>
                      Indexé : <strong style={{ color: 'var(--cs-fg-secondary)' }}>{formatDate(col.lastIndexedAt)}</strong>
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div
                    style={{
                      borderTop: '1px solid var(--cs-border)',
                      padding: '16px 22px',
                      background: 'var(--cs-bg-base)',
                    }}
                  >
                    {isLoadingDocs ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
                        <Loader2 size={14} style={{ animation: 'cs-spin 0.7s linear infinite', color: 'var(--cs-fg-muted)' }} />
                        <span style={{ fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-muted)' }}>
                          Chargement des documents...
                        </span>
                      </div>
                    ) : docs && docs.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {docs.map((doc) => (
                          <div
                            key={doc.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '10px 14px',
                              background: 'var(--cs-bg-elevated)',
                              borderRadius: 'var(--cs-radius-sm)',
                              border: '1px solid var(--cs-border)',
                            }}
                          >
                            <FileText size={14} style={{ color: 'var(--cs-fg-muted)', flexShrink: 0 }} />
                            <span
                              style={{
                                flex: 1,
                                fontSize: 'var(--cs-text-sm)',
                                fontWeight: 500,
                                color: 'var(--cs-fg-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {doc.title}
                            </span>
                            <Badge tone={doc.chunkCount > 0 ? 'success' : 'warning'} size="sm">
                              {doc.chunkCount > 0 ? `${doc.chunkCount} chunks` : 'Non indexé'}
                            </Badge>
                            <span
                              className="cs-mono"
                              style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)', flexShrink: 0 }}
                            >
                              {doc.sourceType}
                            </span>
                            <span style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)', flexShrink: 0 }}>
                              {formatDate(doc.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-muted)', padding: '8px 0' }}>
                        Aucun document dans cette collection.
                      </p>
                    )}

                    <div style={{ marginTop: 14 }}>
                      {showForm === col.slug ? (
                        <div
                          style={{
                            background: 'var(--cs-bg-elevated)',
                            border: '1px solid var(--cs-border)',
                            borderRadius: 'var(--cs-radius-sm)',
                            padding: 18,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 14,
                          }}
                        >
                          <Input
                            label="Titre du document"
                            placeholder="Ex: Guide des ingrédients japonais"
                            value={formTitle}
                            onChange={(e) => setFormTitle(e.target.value)}
                            disabled={ingesting}
                          />
                          <div className="cs-input-field flex flex-col gap-1.5 w-full">
                            <label
                              className="cs-eyebrow"
                              style={{ fontSize: 'var(--cs-text-xs)' }}
                              htmlFor={`content-${col.slug}`}
                            >
                              Contenu
                            </label>
                            <textarea
                              id={`content-${col.slug}`}
                              placeholder="Collez le contenu textuel ici..."
                              value={formContent}
                              onChange={(e) => setFormContent(e.target.value)}
                              disabled={ingesting}
                              rows={6}
                              className="flex-1 bg-transparent px-3 py-2 text-sm text-cs-fg-primary placeholder:text-cs-fg-muted focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{
                                width: '100%',
                                resize: 'vertical',
                                border: '1px solid var(--cs-border)',
                                borderRadius: 'var(--cs-radius-sm)',
                                background: 'var(--cs-bg-elevated)',
                                fontFamily: 'inherit',
                              }}
                            />
                          </div>

                          {ingestError && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '8px 12px',
                                background: 'var(--cs-danger-bg)',
                                borderRadius: 'var(--cs-radius-sm)',
                                fontSize: 'var(--cs-text-xs)',
                                color: 'var(--cs-danger)',
                              }}
                            >
                              <AlertTriangle size={12} />
                              {ingestError}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setShowForm(null);
                                setFormTitle('');
                                setFormContent('');
                                setIngestError(null);
                              }}
                              disabled={ingesting}
                            >
                              Annuler
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleIngest(col.slug)}
                              loading={ingesting}
                              disabled={!formTitle.trim() || !formContent.trim()}
                            >
                              Ingérer
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Plus size={12} />}
                          onClick={() => {
                            setShowForm(col.slug);
                            setIngestError(null);
                            setIngestSuccess(null);
                          }}
                        >
                          Ajouter un document
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone = 'accent',
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: 'accent' | 'warning' | 'success';
}) {
  const toneColors: Record<string, string> = {
    accent: 'var(--cs-accent)',
    warning: 'var(--cs-warning)',
    success: 'var(--cs-success)',
  };
  const toneBgs: Record<string, string> = {
    accent: 'var(--cs-accent-bg)',
    warning: 'var(--cs-warning-bg)',
    success: 'var(--cs-success-bg)',
  };
  return (
    <div
      style={{
        background: 'var(--cs-bg-elevated)',
        border: '1px solid var(--cs-border-hair)',
        borderRadius: 'var(--cs-radius-md)',
        padding: '18px 20px',
        boxShadow: 'var(--cs-shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--cs-radius)',
          background: toneBgs[tone],
          color: toneColors[tone],
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div>
        <p
          className="cs-mono"
          style={{
            margin: 0,
            fontSize: 'var(--cs-text-2xl)',
            fontWeight: 600,
            color: 'var(--cs-fg-primary)',
            lineHeight: 1,
          }}
        >
          {value}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
          {label}
        </p>
      </div>
    </div>
  );
}
