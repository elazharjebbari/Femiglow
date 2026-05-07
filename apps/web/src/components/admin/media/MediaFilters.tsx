import type { MediaListFilters } from '@/lib/schemas/admin/media';

interface MediaFiltersProps {
  filters: MediaListFilters;
}

export function MediaFilters({ filters }: MediaFiltersProps) {
  return (
    <form className="mb-6 grid gap-3 sm:grid-cols-4" role="search">
      <label className="block">
        <span className="block text-xs font-medium text-stone-600">Recherche</span>
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ''}
          placeholder="slug, alt, caption"
          className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-stone-600">Type</span>
        <select
          name="kind"
          defaultValue={filters.kind ?? ''}
          className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">— Tous —</option>
          <option value="image">Image</option>
          <option value="video">Vidéo</option>
          <option value="audio">Audio</option>
        </select>
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-stone-600">Statut</span>
        <select
          name="status"
          defaultValue={filters.status ?? ''}
          className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">— Tous —</option>
          <option value="pending">En attente</option>
          <option value="processing">Traitement</option>
          <option value="ready">Prêt</option>
          <option value="failed">Échec</option>
          <option value="passthrough">Passthrough</option>
        </select>
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-stone-600">Tri</span>
        <select
          name="sort"
          defaultValue={filters.sort ?? 'created_desc'}
          className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
        >
          <option value="created_desc">Plus récents</option>
          <option value="created_asc">Plus anciens</option>
          <option value="size_desc">Plus lourds</option>
          <option value="most_used">Plus utilisés</option>
        </select>
      </label>
      <fieldset className="flex items-center gap-4 sm:col-span-4">
        <legend className="sr-only">Filtres avancés</legend>
        <label className="flex items-center gap-2 text-xs text-stone-600">
          <input
            type="checkbox"
            name="isHero"
            value="true"
            defaultChecked={filters.isHero === true}
          />
          Hero uniquement
        </label>
        <label className="flex items-center gap-2 text-xs text-stone-600">
          <input
            type="checkbox"
            name="unused"
            value="true"
            defaultChecked={filters.unused === true}
          />
          Inutilisés
        </label>
        <button
          type="submit"
          className="ml-auto rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          Appliquer
        </button>
      </fieldset>
    </form>
  );
}
