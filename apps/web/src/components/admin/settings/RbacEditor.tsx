'use client';

import { useMemo, useState } from 'react';
import type {
  ConfigMeta,
  RbacAction,
  RbacConfig,
  RbacMatrix,
  RbacResource,
} from '@/lib/admin-config/types';
import { rbacSchema, RBAC_ACTIONS, RBAC_RESOURCES } from '@/lib/admin-config/schemas';
import { SectionEditorShell } from './SectionEditorShell';

interface RbacEditorProps {
  initialMatrix: RbacMatrix;
  meta: ConfigMeta;
  currentRole?: string;
}

const ACTION_LABEL: Record<RbacAction, string> = {
  read: 'r',
  write: 'w',
  publish: 'p',
  delete: 'd',
};

const ACTION_TITLE: Record<RbacAction, string> = {
  read: 'Lire',
  write: 'Modifier',
  publish: 'Publier',
  delete: 'Supprimer',
};

function emptyResources(): Record<RbacResource, RbacAction[]> {
  return {
    components: [],
    seo: [],
    products: [],
    media: [],
    users: [],
    'app-config': [],
  };
}

export function RbacEditor({
  initialMatrix,
  meta,
  currentRole = 'admin',
}: RbacEditorProps) {
  const [matrix, setMatrix] = useState<RbacMatrix>(() =>
    JSON.parse(JSON.stringify(initialMatrix)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [version, setVersion] = useState(meta.version);
  const [newRole, setNewRole] = useState('');

  const dirty = useMemo(
    () => JSON.stringify(matrix) !== JSON.stringify(initialMatrix),
    [matrix, initialMatrix],
  );

  function isLocked(role: string): boolean {
    return role === 'superadmin';
  }

  function toggle(role: string, resource: RbacResource, action: RbacAction) {
    if (isLocked(role)) return;
    // Self-lock guard
    if (
      role === currentRole &&
      resource === 'app-config' &&
      action === 'write' &&
      currentRole !== 'superadmin'
    ) {
      const current = matrix[role]?.[resource] ?? [];
      if (current.includes(action)) {
        setError('Impossible de retirer ses propres permissions write sur app-config.');
        return;
      }
    }
    setError(null);
    setMatrix((prev) => {
      const role_ = prev[role] ?? emptyResources();
      const actions = role_[resource] ?? [];
      const next = actions.includes(action)
        ? actions.filter((a) => a !== action)
        : [...actions, action];
      return {
        ...prev,
        [role]: { ...role_, [resource]: next },
      };
    });
  }

  function addRole() {
    const key = newRole.trim().toLowerCase();
    if (!/^[a-z][a-z0-9-]*$/.test(key)) {
      setError('Clé invalide (kebab-case attendu).');
      return;
    }
    if (matrix[key]) {
      setError(`Le rôle "${key}" existe déjà.`);
      return;
    }
    setError(null);
    setMatrix((prev) => ({ ...prev, [key]: emptyResources() }));
    setNewRole('');
  }

  function removeRole(role: string) {
    if (isLocked(role)) return;
    setMatrix((prev) => {
      const next = { ...prev };
      delete next[role];
      return next;
    });
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    const payload: RbacConfig = { matrix };
    const parsed = rbacSchema.safeParse(payload);
    if (!parsed.success) {
      setError(`Validation : ${parsed.error.issues[0]?.message ?? 'invalide'}`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/rbac', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': String(version),
        },
        body: JSON.stringify({ payload: parsed.data }),
      });
      if (res.status === 409) {
        setError('Une autre modification a été enregistrée. Recharge la page.');
        return;
      }
      if (!res.ok) {
        setError('Erreur serveur.');
        return;
      }
      const data = await res.json();
      setSuccess('Matrice RBAC enregistrée.');
      if (typeof data?.meta?.version === 'number') setVersion(data.meta.version);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau.');
    } finally {
      setSaving(false);
    }
  }

  const roles = Object.keys(matrix);

  return (
    <SectionEditorShell
      section="rbac"
      title="RBAC"
      description="Matrice rôles × ressources × actions. superadmin a toutes les permissions par défaut."
      meta={{ ...meta, version }}
      dirty={dirty}
      saving={saving}
      errorMessage={error}
      successMessage={success}
      onSave={handleSave}
      onReset={() => setMatrix(JSON.parse(JSON.stringify(initialMatrix)))}
      currentPayload={{ matrix }}
    >
      <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
        <table role="grid" aria-label="Matrice RBAC" className="min-w-full text-sm">
          <thead className="bg-stone-50">
            <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
              <th className="px-3 py-2">Rôle</th>
              {RBAC_RESOURCES.map((r) => (
                <th key={r} role="columnheader" className="px-3 py-2">
                  {r}
                </th>
              ))}
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {roles.map((role) => {
              const locked = isLocked(role);
              return (
                <tr key={role} role="row">
                  <td className="px-3 py-2 align-top">
                    <p className="font-medium text-stone-900">{role}</p>
                    {locked ? (
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-stone-500">
                        verrouillé
                      </p>
                    ) : null}
                  </td>
                  {RBAC_RESOURCES.map((resource) => {
                    const actions = matrix[role]?.[resource] ?? [];
                    return (
                      <td
                        key={resource}
                        role="gridcell"
                        className="px-3 py-2"
                        aria-label={`${role}, ${resource}`}
                      >
                        <div className="flex gap-1">
                          {RBAC_ACTIONS.map((action) => {
                            const checked = actions.includes(action);
                            return (
                              <button
                                key={action}
                                type="button"
                                role="checkbox"
                                aria-checked={checked}
                                aria-label={`${role}, ${resource}, ${ACTION_TITLE[action]}, ${
                                  checked ? 'activé' : 'désactivé'
                                }`}
                                title={ACTION_TITLE[action]}
                                onClick={() => toggle(role, resource, action)}
                                disabled={locked}
                                className={`inline-flex h-7 w-7 items-center justify-center rounded border text-xs font-medium transition ${
                                  locked
                                    ? 'cursor-not-allowed border-stone-200 bg-stone-50 text-stone-400'
                                    : checked
                                      ? 'border-stone-900 bg-stone-900 text-white'
                                      : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50'
                                }`}
                              >
                                {ACTION_LABEL[action]}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right align-top">
                    <button
                      type="button"
                      onClick={() => removeRole(role)}
                      disabled={locked}
                      className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-40"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <dl className="mt-3 flex flex-wrap gap-4 text-xs text-stone-500">
        {RBAC_ACTIONS.map((action) => (
          <span key={action}>
            <dt className="inline font-mono font-medium text-stone-700">
              {ACTION_LABEL[action]}
            </dt>{' '}
            <dd className="inline">{ACTION_TITLE[action]}</dd>
          </span>
        ))}
      </dl>
      <div className="mt-6 flex items-center gap-2">
        <input
          type="text"
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          placeholder="content-manager"
          aria-label="Nouvelle clé de rôle"
          className="w-56 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={addRole}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
        >
          + Ajouter rôle
        </button>
      </div>
    </SectionEditorShell>
  );
}
