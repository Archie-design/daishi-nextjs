import { NextRequest, NextResponse } from 'next/server';
import { generateReviews } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.json();
    const reviews = await generateReviews(formData);
    return NextResponse.json({ reviews });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '未知錯誤';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
