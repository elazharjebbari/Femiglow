import {
  LoadingShell,
  SkeletonBlock,
} from '@/components/admin/content-studio-v2/shell/LoadingShell';
import { Skeleton } from '@/components/admin/content-studio-v2/primitives';

export default function CreateLoading() {
  return (
    <LoadingShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            background: 'var(--cs-bg-elevated)',
            border: '1px solid var(--cs-border)',
            borderRadius: 'var(--cs-radius-md)',
            padding: '10px 14px',
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width={120} height={22} rounded="md" />
          ))}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(260px, 280px) minmax(0, 1fr) minmax(320px, 380px)',
            gap: 16,
            alignItems: 'flex-start',
          }}
        >
          <SkeletonBlock height={420} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SkeletonBlock height={180} />
            <SkeletonBlock height={220} />
          </div>
          <SkeletonBlock height={420} />
        </div>
      </div>
    </LoadingShell>
  );
}
