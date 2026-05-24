import {
  LoadingShell,
  SkeletonBlock,
  SkeletonHeader,
} from '@/components/admin/content-studio-v2/shell/LoadingShell';
import { Skeleton } from '@/components/admin/content-studio-v2/primitives';

export default function LibraryLoading() {
  return (
    <LoadingShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <SkeletonHeader eyebrow={0} title={200} />
          <Skeleton width={240} height={32} rounded="md" />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Skeleton width={100} height={28} rounded="md" />
          <Skeleton width={100} height={28} rounded="md" />
          <Skeleton width={100} height={28} rounded="md" />
          <Skeleton width={100} height={28} rounded="md" />
        </div>
        <ul
          role="list"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))',
            gap: 14,
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i}>
              <SkeletonBlock height={280} />
            </li>
          ))}
        </ul>
      </div>
    </LoadingShell>
  );
}
