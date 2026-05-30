import {
  LoadingShell,
  SkeletonBlock,
  SkeletonHeader,
} from '@/components/admin/content-studio-v2/shell/LoadingShell';

export default function KnowledgeBaseLoading() {
  return (
    <LoadingShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <SkeletonHeader eyebrow={100} title={260} />
        <SkeletonBlock height={80} />
        <SkeletonBlock height={100} />
        <SkeletonBlock height={100} />
        <SkeletonBlock height={100} />
        <SkeletonBlock height={100} />
      </div>
    </LoadingShell>
  );
}
