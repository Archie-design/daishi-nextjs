import { NextRequest, NextResponse } from 'next/server';
import { getReviews } from '@/lib/sheets';
import { generateWeeklySummary } from '@/lib/gemini';
import { sendWeeklyReport } from '@/lib/notify';

function authorize(req: NextRequest): boolean {
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const allReviews = await getReviews();

    // 過濾本週（台灣時間）的評論
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    const weekReviews = allReviews.filter((r) => {
      const d = new Date(r.date);
      return d >= weekStart && d <= now;
    });

    const avgRating =
      weekReviews.length > 0
        ? weekReviews.reduce((sum, r) => sum + r.rating, 0) / weekReviews.length
        : 0;

    const sorted = [...weekReviews].sort((a, b) => b.rating - a.rating);
    const bestReview = sorted[0] ?? null;
    const worstReview = sorted[sorted.length - 1] ?? null;

    const aiSummary = await generateWeeklySummary(
      weekReviews.map((r) => ({ text: r.text, rating: r.rating }))
    );

    const fmt = (d: Date) =>
      d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', month: 'long', day: 'numeric' });

    await sendWeeklyReport({
      weekStart: fmt(weekStart),
      weekEnd: fmt(now),
      newCount: weekReviews.length,
      avgRating,
      bestReview: bestReview
        ? { reviewer: bestReview.reviewer, rating: bestReview.rating, text: bestReview.text }
        : null,
      worstReview:
        worstReview && worstReview.rating <= 4
          ? { reviewer: worstReview.reviewer, rating: worstReview.rating, text: worstReview.text }
          : null,
      aiSummary,
    });

    return NextResponse.json({ ok: true, weekCount: weekReviews.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '未知錯誤';
    console.error('[cron/weekly]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
