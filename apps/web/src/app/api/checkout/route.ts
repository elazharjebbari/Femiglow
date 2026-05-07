import { NextResponse } from 'next/server';
import { checkoutFormSchema } from '@/lib/schemas';
import { generateOrderId } from '@/lib/utils/order-id';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'INVALID_JSON' },
      { status: 400 },
    );
  }

  const parsed = checkoutFormSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'INVALID_PAYLOAD',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 600));

  const orderId = generateOrderId();

  return NextResponse.json({ orderId }, { status: 200 });
}
