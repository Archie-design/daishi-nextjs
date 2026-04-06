import { NextRequest, NextResponse } from 'next/server';
import { getOptions, saveOptions, Options } from '@/lib/sheets';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';

export async function GET() {
  try {
    const options = await getOptions();
    return NextResponse.json(options);
  } catch (e) {
    return NextResponse.json({ error: '讀取選項失敗' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // 驗證 JWT
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return NextResponse.json({ error: '未授權' }, { status: 401 });
  }

  try {
    const body = await req.json() as Options | null;
    await saveOptions(body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: '儲存選項失敗' }, { status: 500 });
  }
}
