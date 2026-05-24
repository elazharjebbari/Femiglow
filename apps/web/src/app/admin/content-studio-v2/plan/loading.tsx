import {
  LoadingShell,
  SkeletonBlock,
  SkeletonHeader,
} from '@/components/admin/content-studio-v2/shell/LoadingShell';
import { Skeleton } from '@/components/admin/content-studio-v2/primitives';

export default function PlanLoading() {
  return (
    <LoadingShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SkeletonHeader />
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          <SkeletonBlock height={100} />
          <SkeletonBlock height={100} />
          <SkeletonBlock height={100} />
          <SkeletonBlock height={100} />
        </section>
        <div
          style={{
            background: 'var(--cs-bg-elevated)',
            border: '1px solid var(--cs-border)',
            borderRadius: 'var(--cs-radius-md)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <Skeleton width={180} height={32} rounded="md" />
            <Skeleton width={120} height={32} rounded="md" />
            <div style={{ flex: 1 }} />
            <Skeleton width={100} height={28} rounded="md" />
            <Skeleton width={100} height={28} rounded="md" />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gap: 1,
              background: 'var(--cs-border)',
              border: '1px solid var(--cs-border)',
              borderRadius: 'var(--cs-radius-sm)',
              overflow: 'hidden',
            }}
          >
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={`h-${i}`}
                style={{
                  background: 'var(--cs-bg-sunken)',
                  padding: '8px 6px',
                  textAlign: 'center',
                }}
              >
                <Skeleton width={36} height={10} />
              </div>
            ))}
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={`d-${i}`}
                style={{
                  background: 'var(--cs-bg-elevated)',
                  padding: 8,
                  minHeight: 140,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <Skeleton width={14} height={12} />
                <Skeleton height={28} rounded="sm" />
                <Skeleton height={28} rounded="sm" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </LoadingShell>
  );
}
