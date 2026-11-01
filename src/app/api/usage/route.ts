import { NextRequest, NextResponse } from 'next/server';
import { getUsage } from '@/lib/sheets';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';

// 估算單價（USD / 百萬 token：輸入, 輸出）。僅供參考，實際費用以 Google 帳單為準。
const PRICE: Record<string, [number, number]> = {
  'gemini-3.5-flash-lite': [0.1, 0.4],
  'gemini-flash-lite-latest': [0.1, 0.4],
  'gemini-2.5-flash': [0.3, 2.5],
};
const DEFAULT_PRICE: [number, number] = [0.3, 2.5];
const USD_TO_TWD = 32;

const TZ = 'Asia/Taipei';
const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return NextResponse.json({ error: '未授權' }, { status: 401 });
  }

  try {
    const rows = await getUsage();
    const now = new Date();
    const today = dayKey(now);
    const month = today.slice(0, 7);

    const emptyBucket = () => ({ calls: 0, ai: 0, mock: 0, apiCalls: 0, inputTokens: 0, outputTokens: 0, costTWD: 0 });
    const buckets = { today: emptyBucket(), month: emptyBucket(), total: emptyBucket() };
    const byModel: Record<string, number> = {};
    const daily: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) daily[dayKey(new Date(now.getTime() - i * 86400000))] = 0;

    for (const r of rows) {
      const t = new Date(r.time);
      if (isNaN(t.getTime())) continue;
      const k = dayKey(t);
      const [pin, pout] = PRICE[r.model] ?? DEFAULT_PRICE;
      const cost = ((r.inputTokens * pin + r.outputTokens * pout) / 1_000_000) * USD_TO_TWD;

      const targets = [buckets.total];
      if (k === today) targets.push(buckets.today);
      if (k.startsWith(month)) targets.push(buckets.month);
      for (const b of targets) {
        b.calls++;
        if (r.result === 'mock' || r.result === 'fail') b.mock++;
        else b.ai++;
        b.apiCalls += r.apiCalls;
        b.inputTokens += r.inputTokens;
        b.outputTokens += r.outputTokens;
        b.costTWD += cost;
      }
      if (k.startsWith(month) && r.model) byModel[r.model] = (byModel[r.model] ?? 0) + r.apiCalls;
      if (k in daily) daily[k]++;
    }

    return NextResponse.json({
      ...buckets,
      byModel,
      daily: Object.entries(daily).map(([date, count]) => ({ date, count })),
    });
  } catch {
    return NextResponse.json({ error: '讀取用量失敗' }, { status: 500 });
  }
}
