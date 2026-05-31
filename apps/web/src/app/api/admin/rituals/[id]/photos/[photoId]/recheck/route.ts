import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { getAdminSession } from '@/lib/auth/require-admin';
import { checkFacesWithTimeout } from '@/lib/rituals/vision-ml-faces';
import { insertAuditEvent } from '@/lib/db/queries/rituals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: { id: string; photoId: string } },
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  const drizzle = db();
  let photo;
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.ritualTestimonialPhotos)
      .where(eq(schema.ritualTestimonialPhotos.id, params.photoId))
      .limit(1);
    photo = rows[0];
  } else {
    photo = memoryStore().ritualTestimonialPhotos.get(params.photoId);
  }

  if (!photo || photo.testimonialId !== params.id) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  }

  const result = await checkFacesWithTimeout({ url: photo.url });
  const now = new Date();

  if (drizzle) {
    await drizzle
      .update(schema.ritualTestimonialPhotos)
      .set({
        facesStatus: result.status,
        facesCount: result.facesCount,
        facesCheckAt: now,
      })
      .where(eq(schema.ritualTestimonialPhotos.id, params.photoId));
  } else {
    memoryStore().ritualTestimonialPhotos.set(params.photoId, {
      ...photo,
      facesStatus: result.status,
      facesCount: result.facesCount,
      facesCheckAt: now,
    });
  }

  await insertAuditEvent({
    testimonialId: params.id,
    actorId: session.adminId,
    action: 'photo_rechecked',
    payload: {
      photoId: params.photoId,
      newStatus: result.status,
      facesCount: result.facesCount,
    },
  });

  return NextResponse.json({
    data: {
      photoId: params.photoId,
      facesStatus: result.status,
      facesCount: result.facesCount,
    },
  });
}
