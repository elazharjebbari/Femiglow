import {
  LoadingShell,
  SkeletonBlock,
  SkeletonHeader,
} from '@/components/admin/content-studio-v2/shell/LoadingShell';

export default function GraphViewerLoading() {
  return (
    <LoadingShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <SkeletonHeader eyebrow={72} title={260} />
        <SkeletonBlock height={500} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
          }}
        >
          <SkeletonBlock height={200} />
          <SkeletonBlock height={200} />
        </div>
      </div>
    </LoadingShell>
  );
}
