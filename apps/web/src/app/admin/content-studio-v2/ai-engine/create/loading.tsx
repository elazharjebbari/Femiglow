import {
  LoadingShell,
  SkeletonBlock,
  SkeletonHeader,
} from '@/components/admin/content-studio-v2/shell/LoadingShell';
import { Skeleton } from '@/components/admin/content-studio-v2/primitives';

export default function AIEngineCreateLoading() {
  return (
    <LoadingShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 880, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Skeleton width={36} height={36} rounded="md" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width={72} height={10} />
            <Skeleton width={180} height={22} />
          </div>
        </div>
        <SkeletonBlock height={480} />
      </div>
    </LoadingShell>
  );
}
