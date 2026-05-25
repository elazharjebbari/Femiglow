import { Skeleton } from '@/components/admin/content-studio-v2/primitives';

export default function AnalyticsLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Skeleton width={36} height={36} rounded="md" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton width={80} height={11} />
          <Skeleton width={140} height={22} />
        </div>
      </div>

      {/* KPI cards skeleton */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              background: 'var(--cs-bg-elevated)',
              border: '1px solid var(--cs-border-hair)',
              borderRadius: 'var(--cs-radius-md)',
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Skeleton width={36} height={36} rounded="md" />
              <Skeleton width={100} height={10} />
            </div>
            <div>
              <Skeleton width={80} height={26} />
              <Skeleton width={140} height={10} style={{ marginTop: 6 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[1, 2].map((i) => (
          <div
            key={i}
            style={{
              background: 'var(--cs-bg-elevated)',
              border: '1px solid var(--cs-border-hair)',
              borderRadius: 'var(--cs-radius-md)',
              padding: '24px 28px',
            }}
          >
            <Skeleton width={180} height={16} style={{ marginBottom: 20 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3, 4].map((j) => (
                <div key={j}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Skeleton width={80} height={12} />
                    <Skeleton width={60} height={12} />
                  </div>
                  <Skeleton width="100%" height={8} rounded="full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div
        style={{
          background: 'var(--cs-bg-elevated)',
          border: '1px solid var(--cs-border-hair)',
          borderRadius: 'var(--cs-radius-md)',
          padding: '24px 28px',
        }}
      >
        <Skeleton width={200} height={16} style={{ marginBottom: 20 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 16,
                padding: '12px 0',
                borderBottom: '1px solid var(--cs-border-hair)',
              }}
            >
              <Skeleton width={60} height={18} rounded="full" />
              <Skeleton width={80} height={14} />
              <Skeleton width={60} height={14} />
              <Skeleton width={70} height={14} />
              <Skeleton width={50} height={14} />
              <Skeleton width={40} height={14} />
              <Skeleton width={60} height={14} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
