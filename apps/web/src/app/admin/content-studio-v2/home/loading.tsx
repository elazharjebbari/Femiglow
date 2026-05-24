import {
  LoadingShell,
  SkeletonBlock,
  SkeletonHeader,
} from '@/components/admin/content-studio-v2/shell/LoadingShell';

export default function HomeLoading() {
  return (
    <LoadingShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <SkeletonHeader eyebrow={72} title={240} />
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
            <SkeletonBlock height={220} />
          </div>
          <SkeletonBlock height={140} />
          <SkeletonBlock height={140} />
          <SkeletonBlock height={140} />
        </section>
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          <SkeletonBlock height={180} />
          <SkeletonBlock height={180} />
          <SkeletonBlock height={180} />
        </section>
        <SkeletonBlock height={220} />
      </div>
    </LoadingShell>
  );
}
