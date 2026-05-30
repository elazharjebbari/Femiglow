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
  Trash2,
  Link as LinkIcon,
  Type,
  Pencil,
  Eye,
  RefreshCw,
  X,
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

interface SeedDefaultsResult {
  collections: number;
  baseDocuments: number;
  strategicDocuments: number;
  strategicSkipped: number;
  documents: number;
  errors: string[];
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

const COLLECTION_CATEGORIES = [
  { value: 'brand', label: 'Marque' },
  { value: 'psychology', label: 'Psychologie' },
  { value: 'platform', label: 'Plateforme' },
  { value: 'trend', label: 'Tendances' },
  { value: 'product', label: 'Produit' },
  { value: 'viral', label: 'Viral' },
  { value: 'production', label: 'Production' },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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
  const [formSourceType, setFormSourceType] = useState<'text' | 'url'>('text');
  const [formUrl, setFormUrl] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);

  const [embedding, setEmbedding] = useState(false);
  const [embedResult, setEmbedResult] = useState<EmbedResult | null>(null);
  const [embedError, setEmbedError] = useState<string | null>(null);

  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<SeedDefaultsResult | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<{ slug: string; docId: string; title: string } | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);
  const [confirmDeleteCol, setConfirmDeleteCol] = useState<{ slug: string; name: string } | null>(null);
  const [deletingCol, setDeletingCol] = useState(false);

  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColSlug, setNewColSlug] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  const [newColCategory, setNewColCategory] = useState('brand');
  const [creatingCol, setCreatingCol] = useState(false);
  const [createColError, setCreateColError] = useState<string | null>(null);

  // Edit collection
  const [editingCol, setEditingCol] = useState<Collection | null>(null);
  const [editColName, setEditColName] = useState('');
  const [editColDesc, setEditColDesc] = useState('');
  const [editColCategory, setEditColCategory] = useState('');
  const [savingCol, setSavingCol] = useState(false);
  const [editColError, setEditColError] = useState<string | null>(null);

  // View/Edit document
  const [viewingDoc, setViewingDoc] = useState<{ slug: string; doc: any } | null>(null);
  const [viewDocContent, setViewDocContent] = useState<string | null>(null);
  const [loadingDocContent, setLoadingDocContent] = useState(false);
  const [editingDoc, setEditingDoc] = useState<{ slug: string; docId: string } | null>(null);
  const [editDocTitle, setEditDocTitle] = useState('');
  const [editDocContent, setEditDocContent] = useState('');
  const [editDocOrigContent, setEditDocOrigContent] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);
  const [editDocError, setEditDocError] = useState<string | null>(null);

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
    if (formSourceType === 'text' && (!formTitle.trim() || !formContent.trim())) return;
    if (formSourceType === 'url' && !formUrl.trim()) return;
    setIngesting(true);
    setIngestError(null);
    setIngestSuccess(null);
    try {
      const body = formSourceType === 'text'
        ? { sourceType: 'text' as const, title: formTitle.trim(), content: formContent.trim() }
        : { sourceType: 'url' as const, url: formUrl.trim() };

      const res = await fetch(`/api/admin/ai-engine/knowledge/${slug}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? data?.detail ?? `Erreur ${res.status}`);
      }
      const data = await res.json();
      setIngestSuccess(`Document ingéré avec ${data.chunkCount} chunks`);
      setFormTitle('');
      setFormContent('');
      setFormUrl('');
      setFormSourceType('text');
      setShowForm(null);
      await fetchDocuments(slug);
      await fetchCollections();
    } catch (e: unknown) {
      setIngestError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setIngesting(false);
    }
  }

  async function handleDeleteDocument() {
    if (!confirmDeleteDoc) return;
    setDeletingDoc(true);
    try {
      const res = await fetch(
        `/api/admin/ai-engine/knowledge/${confirmDeleteDoc.slug}/documents/${confirmDeleteDoc.docId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Erreur ${res.status}`);
      }
      setIngestSuccess(`Document "${confirmDeleteDoc.title}" supprimé`);
      await fetchDocuments(confirmDeleteDoc.slug);
      await fetchCollections();
    } catch (e: unknown) {
      setIngestError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setDeletingDoc(false);
      setConfirmDeleteDoc(null);
    }
  }

  async function handleDeleteCollection() {
    if (!confirmDeleteCol) return;
    setDeletingCol(true);
    try {
      const res = await fetch(
        `/api/admin/ai-engine/knowledge/${confirmDeleteCol.slug}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Erreur ${res.status}`);
      }
      setIngestSuccess(`Collection "${confirmDeleteCol.name}" supprimée`);
      setExpandedId(null);
      await fetchCollections();
    } catch (e: unknown) {
      setIngestError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setDeletingCol(false);
      setConfirmDeleteCol(null);
    }
  }

  async function handleCreateCollection() {
    if (!newColName.trim() || !newColSlug.trim()) return;
    setCreatingCol(true);
    setCreateColError(null);
    try {
      const res = await fetch('/api/admin/ai-engine/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newColName.trim(),
          slug: newColSlug.trim(),
          description: newColDesc.trim() || null,
          category: newColCategory,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? data?.details?.[0]?.message ?? `Erreur ${res.status}`);
      }
      setIngestSuccess(`Collection "${newColName.trim()}" créée`);
      setNewColName('');
      setNewColSlug('');
      setNewColDesc('');
      setNewColCategory('brand');
      setShowNewCollection(false);
      await fetchCollections();
    } catch (e: unknown) {
      setCreateColError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setCreatingCol(false);
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

  async function handleSeedDefaults() {
    setSeeding(true);
    setSeedResult(null);
    setSeedError(null);
    try {
      const res = await fetch('/api/admin/ai-engine/knowledge/seed-defaults', {
        method: 'POST',
      });
      if (!res.ok && res.status !== 207) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? data?.error ?? `Erreur ${res.status}`);
      }
      const data: SeedDefaultsResult = await res.json();
      setSeedResult(data);
      await fetchCollections();
    } catch (e: unknown) {
      setSeedError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setSeeding(false);
    }
  }

  async function handleEditCollection() {
    if (!editingCol) return;
    setSavingCol(true);
    setEditColError(null);
    try {
      const body: Record<string, unknown> = {};
      if (editColName.trim() !== editingCol.name) body.name = editColName.trim();
      if (editColDesc.trim() !== (editingCol.description ?? '')) body.description = editColDesc.trim() || null;
      if (editColCategory !== editingCol.category) body.category = editColCategory;

      if (Object.keys(body).length === 0) {
        setEditingCol(null);
        return;
      }

      const res = await fetch(`/api/admin/ai-engine/knowledge/${editingCol.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Erreur ${res.status}`);
      }
      setIngestSuccess('Collection mise à jour');
      setEditingCol(null);
      await fetchCollections();
    } catch (e: unknown) {
      setEditColError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setSavingCol(false);
    }
  }

  function openEditCollection(col: Collection) {
    setEditingCol(col);
    setEditColName(col.name);
    setEditColDesc(col.description ?? '');
    setEditColCategory(col.category);
    setEditColError(null);
  }

  async function fetchDocumentContent(slug: string, docId: string) {
    setLoadingDocContent(true);
    try {
      const res = await fetch(`/api/admin/ai-engine/knowledge/${slug}/documents/${docId}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setViewDocContent(data.document?.contentText ?? null);
    } catch {
      setViewDocContent(null);
    } finally {
      setLoadingDocContent(false);
    }
  }

  function openViewDocument(slug: string, doc: any) {
    setViewingDoc({ slug, doc });
    setViewDocContent(null);
    fetchDocumentContent(slug, doc.id);
  }

  function openEditDocument(slug: string, doc: any) {
    setEditingDoc({ slug, docId: doc.id });
    setEditDocTitle(doc.title);
    setEditDocContent('');
    setEditDocOrigContent('');
    setEditDocError(null);
    // Fetch full content
    fetch(`/api/admin/ai-engine/knowledge/${slug}/documents/${doc.id}`)
      .then((r) => r.json())
      .then((data) => {
        const content = data.document?.contentText ?? '';
        setEditDocContent(content);
        setEditDocOrigContent(content);
      })
      .catch(() => {});
  }

  async function handleEditDocument() {
    if (!editingDoc) return;
    setSavingDoc(true);
    setEditDocError(null);
    try {
      const body: Record<string, unknown> = {};
      if (editDocTitle.trim()) body.title = editDocTitle.trim();
      const contentChanged = editDocContent !== editDocOrigContent;
      if (contentChanged) body.content = editDocContent;

      if (Object.keys(body).length === 0) {
        setEditingDoc(null);
        return;
      }

      const res = await fetch(
        `/api/admin/ai-engine/knowledge/${editingDoc.slug}/documents/${editingDoc.docId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Erreur ${res.status}`);
      }
      const result = await res.json();
      const msg = result.reChunked
        ? `Document mis à jour — ${result.chunkCount} chunks re-générés`
        : 'Document mis à jour';
      setIngestSuccess(msg);
      setEditingDoc(null);
      await fetchDocuments(editingDoc.slug);
      await fetchCollections();
    } catch (e: unknown) {
      setEditDocError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setSavingDoc(false);
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
        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            variant="ghost"
            leftIcon={<Plus size={14} />}
            onClick={() => { setShowNewCollection(true); setCreateColError(null); }}
            disabled={showNewCollection}
          >
            Nouvelle collection
          </Button>
          <Button
            variant="ghost"
            onClick={handleSeedDefaults}
            loading={seeding}
            leftIcon={<Database size={14} />}
            data-testid="seed-defaults-button"
            title="Crée les collections par défaut et charge le rapport stratégique FemiGlow (idempotent)"
          >
            Charger les connaissances par défaut
          </Button>
          <Button
            onClick={handleEmbed}
            loading={embedding}
            leftIcon={<Sparkles size={14} />}
          >
            Générer les embeddings
          </Button>
        </div>
      </header>

      {seedResult && (
        <section
          data-testid="seed-defaults-result"
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
            <p style={{ margin: 0 }}>
              <strong>{seedResult.collections}</strong> collections prêtes ·{' '}
              <strong>{seedResult.baseDocuments}</strong> documents de base ·{' '}
              <strong>{seedResult.strategicDocuments}</strong> documents stratégiques chargés
              {seedResult.strategicSkipped > 0 && (
                <> · {seedResult.strategicSkipped} déjà présents (ignorés)</>
              )}
            </p>
            <p style={{ margin: '4px 0 0', color: 'var(--cs-fg-muted)', fontSize: 'var(--cs-text-xs)' }}>
              Lancez « Générer les embeddings » si des documents restent non indexés.
            </p>
            {seedResult.errors && seedResult.errors.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: 'var(--cs-danger)' }}>
                {seedResult.errors.map((e, i) => (
                  <li key={i} style={{ fontSize: 'var(--cs-text-xs)' }}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {seedError && (
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
          <p style={{ margin: 0, fontSize: 'var(--cs-text-sm)' }}>{seedError}</p>
        </section>
      )}

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

      {/* Confirm delete document dialog */}
      {confirmDeleteDoc && (
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
          <p style={{ margin: 0, fontSize: 'var(--cs-text-sm)', flex: 1 }}>
            Supprimer ce document ? <strong>{confirmDeleteDoc.title}</strong>
          </p>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDeleteDoc(null)}
              disabled={deletingDoc}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleDeleteDocument}
              loading={deletingDoc}
              style={{ background: 'var(--cs-danger)', color: '#fff', border: 'none' }}
            >
              Supprimer
            </Button>
          </div>
        </section>
      )}

      {/* Confirm delete collection dialog */}
      {confirmDeleteCol && (
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
          <p style={{ margin: 0, fontSize: 'var(--cs-text-sm)', flex: 1 }}>
            Supprimer cette collection ? <strong>{confirmDeleteCol.name}</strong>
          </p>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDeleteCol(null)}
              disabled={deletingCol}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleDeleteCollection}
              loading={deletingCol}
              style={{ background: 'var(--cs-danger)', color: '#fff', border: 'none' }}
            >
              Supprimer
            </Button>
          </div>
        </section>
      )}

      {/* Edit collection form */}
      {editingCol && (
        <section
          style={{
            background: 'var(--cs-bg-elevated)',
            border: '1px solid var(--cs-accent)',
            borderRadius: 'var(--cs-radius-md)',
            padding: '20px 24px',
            boxShadow: 'var(--cs-shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'var(--cs-font-display)', fontWeight: 500, fontSize: 'var(--cs-text-sm)' }}>
              Modifier la collection
            </div>
            <span className="cs-mono" style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
              slug: {editingCol.slug}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              label="Nom"
              value={editColName}
              onChange={(e) => setEditColName(e.target.value)}
              disabled={savingCol}
            />
            <div className="cs-input-field flex flex-col gap-1.5 w-full">
              <label className="cs-eyebrow" style={{ fontSize: 'var(--cs-text-xs)' }}>Catégorie</label>
              <select
                value={editColCategory}
                onChange={(e) => setEditColCategory(e.target.value)}
                disabled={savingCol}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: 'var(--cs-text-sm)',
                  border: '1px solid var(--cs-border)',
                  borderRadius: 'var(--cs-radius-sm)',
                  background: 'var(--cs-bg-elevated)',
                  color: 'var(--cs-fg-primary)',
                  fontFamily: 'inherit',
                }}
              >
                {COLLECTION_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>
          <Input
            label="Description"
            value={editColDesc}
            onChange={(e) => setEditColDesc(e.target.value)}
            disabled={savingCol}
          />
          {editColError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--cs-danger-bg)', borderRadius: 'var(--cs-radius-sm)', fontSize: 'var(--cs-text-xs)', color: 'var(--cs-danger)' }}>
              <AlertTriangle size={12} />
              {editColError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={() => setEditingCol(null)} disabled={savingCol}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleEditCollection} loading={savingCol}>
              Enregistrer
            </Button>
          </div>
        </section>
      )}

      {/* New collection form */}
      {showNewCollection && (
        <section
          style={{
            background: 'var(--cs-bg-elevated)',
            border: '1px solid var(--cs-border-hair)',
            borderRadius: 'var(--cs-radius-md)',
            padding: '20px 24px',
            boxShadow: 'var(--cs-shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ fontFamily: 'var(--cs-font-display)', fontWeight: 500, fontSize: 'var(--cs-text-sm)' }}>
            Nouvelle collection
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              label="Nom"
              placeholder="Ex: Fiches produits"
              value={newColName}
              onChange={(e) => {
                setNewColName(e.target.value);
                if (!newColSlug || newColSlug === slugify(newColName)) {
                  setNewColSlug(slugify(e.target.value));
                }
              }}
              disabled={creatingCol}
            />
            <Input
              label="Slug"
              placeholder="ex: fiches-produits"
              value={newColSlug}
              onChange={(e) => setNewColSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              disabled={creatingCol}
            />
          </div>
          <Input
            label="Description"
            placeholder="Description de la collection (optionnel)"
            value={newColDesc}
            onChange={(e) => setNewColDesc(e.target.value)}
            disabled={creatingCol}
          />
          <div className="cs-input-field flex flex-col gap-1.5 w-full">
            <label className="cs-eyebrow" style={{ fontSize: 'var(--cs-text-xs)' }}>
              Catégorie
            </label>
            <select
              value={newColCategory}
              onChange={(e) => setNewColCategory(e.target.value)}
              disabled={creatingCol}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 'var(--cs-text-sm)',
                border: '1px solid var(--cs-border)',
                borderRadius: 'var(--cs-radius-sm)',
                background: 'var(--cs-bg-elevated)',
                color: 'var(--cs-fg-primary)',
                fontFamily: 'inherit',
              }}
            >
              {COLLECTION_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          {createColError && (
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
              {createColError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowNewCollection(false); setCreateColError(null); }}
              disabled={creatingCol}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleCreateCollection}
              loading={creatingCol}
              disabled={!newColName.trim() || !newColSlug.trim()}
            >
              Créer
            </Button>
          </div>
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
            <div style={{ marginTop: 18 }}>
              <Button
                onClick={handleSeedDefaults}
                loading={seeding}
                leftIcon={<Database size={14} />}
                data-testid="seed-defaults-button-empty"
              >
                Charger les connaissances par défaut
              </Button>
            </div>
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
                            <button
                              onClick={() => openViewDocument(col.slug, doc)}
                              title="Voir le contenu"
                              style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: 28, height: 28, borderRadius: 'var(--cs-radius-sm)',
                                border: 'none', background: 'transparent', color: 'var(--cs-fg-muted)',
                                cursor: 'pointer', flexShrink: 0, transition: 'all var(--cs-motion-fast) var(--cs-easing)',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--cs-accent-bg)'; e.currentTarget.style.color = 'var(--cs-accent)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--cs-fg-muted)'; }}
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              onClick={() => openEditDocument(col.slug, doc)}
                              title="Modifier ce document"
                              style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: 28, height: 28, borderRadius: 'var(--cs-radius-sm)',
                                border: 'none', background: 'transparent', color: 'var(--cs-fg-muted)',
                                cursor: 'pointer', flexShrink: 0, transition: 'all var(--cs-motion-fast) var(--cs-easing)',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--cs-accent-bg)'; e.currentTarget.style.color = 'var(--cs-accent)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--cs-fg-muted)'; }}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteDoc({ slug: col.slug, docId: doc.id, title: doc.title })}
                              title="Supprimer ce document"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 28,
                                height: 28,
                                borderRadius: 'var(--cs-radius-sm)',
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--cs-fg-muted)',
                                cursor: 'pointer',
                                flexShrink: 0,
                                transition: 'all var(--cs-motion-fast) var(--cs-easing)',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--cs-danger-bg)'; e.currentTarget.style.color = 'var(--cs-danger)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--cs-fg-muted)'; }}
                            >
                              <Trash2 size={13} />
                            </button>
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
                          {/* Source type toggle */}
                          <div style={{ display: 'flex', gap: 0, borderRadius: 'var(--cs-radius-sm)', overflow: 'hidden', border: '1px solid var(--cs-border)', alignSelf: 'flex-start' }}>
                            <button
                              onClick={() => setFormSourceType('text')}
                              disabled={ingesting}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 14px',
                                border: 'none',
                                background: formSourceType === 'text' ? 'var(--cs-accent-bg)' : 'transparent',
                                color: formSourceType === 'text' ? 'var(--cs-accent)' : 'var(--cs-fg-muted)',
                                fontWeight: formSourceType === 'text' ? 600 : 400,
                                fontSize: 'var(--cs-text-xs)',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                              }}
                            >
                              <Type size={12} />
                              Texte
                            </button>
                            <button
                              onClick={() => setFormSourceType('url')}
                              disabled={ingesting}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 14px',
                                border: 'none',
                                borderLeft: '1px solid var(--cs-border)',
                                background: formSourceType === 'url' ? 'var(--cs-accent-bg)' : 'transparent',
                                color: formSourceType === 'url' ? 'var(--cs-accent)' : 'var(--cs-fg-muted)',
                                fontWeight: formSourceType === 'url' ? 600 : 400,
                                fontSize: 'var(--cs-text-xs)',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                              }}
                            >
                              <LinkIcon size={12} />
                              URL
                            </button>
                          </div>

                          {formSourceType === 'text' ? (
                            <>
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
                            </>
                          ) : (
                            <Input
                              label="URL du document"
                              placeholder="https://example.com/article"
                              type="url"
                              value={formUrl}
                              onChange={(e) => setFormUrl(e.target.value)}
                              disabled={ingesting}
                              leftAddon={<LinkIcon size={14} />}
                            />
                          )}

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
                                setFormUrl('');
                                setFormSourceType('text');
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
                              disabled={
                                formSourceType === 'text'
                                  ? !formTitle.trim() || !formContent.trim()
                                  : !formUrl.trim()
                              }
                            >
                              Ingérer
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
                          <div style={{ flex: 1 }} />
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Pencil size={12} />}
                            onClick={() => openEditCollection(col)}
                          >
                            Modifier
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Trash2 size={12} />}
                            onClick={() => setConfirmDeleteCol({ slug: col.slug, name: col.name })}
                            style={{ color: 'var(--cs-danger)' }}
                          >
                            Supprimer la collection
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      {/* View document modal */}
      {viewingDoc && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'grid', placeItems: 'center', padding: 24,
          }}
          onClick={() => setViewingDoc(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--cs-bg-elevated)', borderRadius: 'var(--cs-radius-lg)',
              boxShadow: 'var(--cs-shadow-lg)', width: '100%', maxWidth: 700, maxHeight: '80vh',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--cs-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: 'var(--cs-font-display)', fontWeight: 500, fontSize: 'var(--cs-text-base)' }}>
                  {viewingDoc.doc.title}
                </h3>
                <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
                  <span>Type: <strong>{viewingDoc.doc.sourceType}</strong></span>
                  <span>Chunks: <strong>{viewingDoc.doc.chunkCount}</strong></span>
                  <span>Créé: <strong>{formatDate(viewingDoc.doc.createdAt)}</strong></span>
                </div>
              </div>
              <button
                onClick={() => setViewingDoc(null)}
                style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 'var(--cs-radius-sm)', border: 'none', background: 'var(--cs-bg-sunken)', color: 'var(--cs-fg-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
              {loadingDocContent ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Loader2 size={14} style={{ animation: 'cs-spin 0.7s linear infinite', color: 'var(--cs-fg-muted)' }} />
                  <span style={{ fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-muted)' }}>Chargement...</span>
                </div>
              ) : viewDocContent ? (
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 'var(--cs-text-sm)', lineHeight: 1.7, color: 'var(--cs-fg-secondary)', fontFamily: 'inherit' }}>
                  {viewDocContent}
                </pre>
              ) : (
                <p style={{ margin: 0, fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-muted)' }}>Aucun contenu disponible.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit document modal */}
      {editingDoc && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'grid', placeItems: 'center', padding: 24,
          }}
          onClick={() => !savingDoc && setEditingDoc(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--cs-bg-elevated)', borderRadius: 'var(--cs-radius-lg)',
              boxShadow: 'var(--cs-shadow-lg)', width: '100%', maxWidth: 700, maxHeight: '85vh',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--cs-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--cs-font-display)', fontWeight: 500, fontSize: 'var(--cs-text-base)' }}>
                Modifier le document
              </h3>
              <button
                onClick={() => !savingDoc && setEditingDoc(null)}
                style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 'var(--cs-radius-sm)', border: 'none', background: 'var(--cs-bg-sunken)', color: 'var(--cs-fg-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Input
                label="Titre"
                value={editDocTitle}
                onChange={(e) => setEditDocTitle(e.target.value)}
                disabled={savingDoc}
              />
              <div className="cs-input-field flex flex-col gap-1.5 w-full">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className="cs-eyebrow" style={{ fontSize: 'var(--cs-text-xs)' }}>Contenu</label>
                  <span style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
                    {editDocContent.length.toLocaleString('fr-FR')} caractères
                  </span>
                </div>
                <textarea
                  value={editDocContent}
                  onChange={(e) => setEditDocContent(e.target.value)}
                  disabled={savingDoc}
                  rows={14}
                  style={{
                    width: '100%', resize: 'vertical',
                    border: '1px solid var(--cs-border)', borderRadius: 'var(--cs-radius-sm)',
                    background: 'var(--cs-bg-elevated)', fontFamily: 'inherit',
                    padding: '8px 12px', fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-primary)',
                  }}
                />
              </div>
              {editDocContent !== editDocOrigContent && editDocOrigContent !== '' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--cs-warning-bg)', borderRadius: 'var(--cs-radius-sm)', fontSize: 'var(--cs-text-xs)', color: 'var(--cs-warning)' }}>
                  <RefreshCw size={12} />
                  Le contenu a été modifié. L&apos;enregistrement déclenchera un re-chunking et un re-calcul des embeddings. Cette opération peut prendre quelques minutes.
                </div>
              )}
              {editDocError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--cs-danger-bg)', borderRadius: 'var(--cs-radius-sm)', fontSize: 'var(--cs-text-xs)', color: 'var(--cs-danger)' }}>
                  <AlertTriangle size={12} />
                  {editDocError}
                </div>
              )}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--cs-border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="ghost" size="sm" onClick={() => setEditingDoc(null)} disabled={savingDoc}>
                Annuler
              </Button>
              <Button size="sm" onClick={handleEditDocument} loading={savingDoc} disabled={!editDocTitle.trim()}>
                Enregistrer
              </Button>
            </div>
          </div>
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
