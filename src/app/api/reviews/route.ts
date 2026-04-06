import { NextRequest, NextResponse } from 'next/server';
import { getReviews } from '@/lib/sheets';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return NextResponse.json({ error: '未授權' }, { status: 401 });
  }

  try {
    const reviews = await getReviews();
    return NextResponse.json(reviews);
  } catch (e) {
    return NextResponse.json({ error: '讀取評論失敗' }, { status: 500 });
  }
}
