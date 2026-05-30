import {
  LoadingShell,
  SkeletonBlock,
  SkeletonHeader,
} from '@/components/admin/content-studio-v2/shell/LoadingShell';

export default function AIEngineLoading() {
  return (
    <LoadingShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <SkeletonHeader eyebrow={72} title={200} />
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
          }}
        >
          <SkeletonBlock height={120} />
          <SkeletonBlock height={120} />
          <SkeletonBlock height={120} />
          <SkeletonBlock height={120} />
        </section>
        <SkeletonBlock height={160} />
        <SkeletonBlock height={80} />
      </div>
    </LoadingShell>
  );
}
