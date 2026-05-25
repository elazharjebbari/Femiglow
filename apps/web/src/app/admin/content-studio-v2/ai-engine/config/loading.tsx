import { Skeleton } from '@/components/admin/content-studio-v2/primitives';

export default function ConfigLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Skeleton width={36} height={36} rounded="md" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton width={80} height={11} />
          <Skeleton width={160} height={22} />
        </div>
      </div>

      {/* Tab navigation skeleton */}
      <Skeleton width="100%" height={44} rounded="md" />

      {/* Cards grid skeleton */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 16,
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              background: 'var(--cs-bg-elevated)',
              border: '1px solid var(--cs-border-hair)',
              borderRadius: 'var(--cs-radius-md)',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Skeleton width={36} height={36} rounded="md" />
              <div style={{ flex: 1 }}>
                <Skeleton width={120} height={14} />
                <Skeleton width={80} height={10} style={{ marginTop: 4 }} />
              </div>
              <Skeleton width={80} height={20} rounded="full" />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <Skeleton width={52} height={18} rounded="full" />
              <Skeleton width={48} height={18} rounded="full" />
              <Skeleton width={64} height={18} rounded="full" />
            </div>
            <Skeleton width="100%" height={60} rounded="sm" />
            <Skeleton width={140} height={28} rounded="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
