import { NextRequest, NextResponse } from 'next/server';
import { getReviews, markReplied } from '@/lib/sheets';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return NextResponse.json({ error: '未授權' }, { status: 401 });
  }

  try {
    const reviews = await getReviews();
    return NextResponse.json(reviews);
  } catch {
    return NextResponse.json({ error: '讀取評論失敗' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return NextResponse.json({ error: '未授權' }, { status: 401 });
  }

  try {
    const { reviewId } = await req.json();
    if (!reviewId) return NextResponse.json({ error: '缺少 reviewId' }, { status: 400 });
    await markReplied(reviewId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '標記失敗' }, { status: 500 });
  }
}
