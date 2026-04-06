import { NextRequest, NextResponse } from 'next/server';
import { getPasswordHash, setPasswordHash } from '@/lib/sheets';
import { verifyPassword, hashPassword, signToken, COOKIE_NAME } from '@/lib/auth';

const DEFAULT_PASSWORD = 'admin888';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (!password) {
    return NextResponse.json({ error: '請輸入密碼' }, { status: 400 });
  }

  let storedHash = await getPasswordHash();

  // 初次使用，Sheets 尚無密碼 → 自動寫入預設密碼的雜湊
  if (!storedHash) {
    storedHash = await hashPassword(DEFAULT_PASSWORD);
    await setPasswordHash(storedHash);
  }

  const ok = await verifyPassword(password, storedHash);
  if (!ok) {
    return NextResponse.json({ error: '密碼錯誤' }, { status: 401 });
  }

  const token = await signToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 小時
    path: '/',
  });
  return res;
}
