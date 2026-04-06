import { NextRequest, NextResponse } from 'next/server';
import { getPasswordHash, setPasswordHash } from '@/lib/sheets';
import { verifyPassword, hashPassword, verifyToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return NextResponse.json({ error: '未授權' }, { status: 401 });
  }

  const { oldPassword, newPassword } = await req.json();
  if (!oldPassword || !newPassword) {
    return NextResponse.json({ error: '請填寫舊密碼與新密碼' }, { status: 400 });
  }
  if (newPassword.length < 4) {
    return NextResponse.json({ error: '新密碼至少需要 4 個字元' }, { status: 400 });
  }

  const storedHash = await getPasswordHash();
  if (!storedHash || !(await verifyPassword(oldPassword, storedHash))) {
    return NextResponse.json({ error: '舊密碼錯誤' }, { status: 401 });
  }

  const newHash = await hashPassword(newPassword);
  await setPasswordHash(newHash);
  return NextResponse.json({ ok: true });
}
