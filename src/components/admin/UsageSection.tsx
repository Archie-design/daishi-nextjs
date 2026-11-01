'use client';

import { useState, useEffect } from 'react';

interface Bucket {
  calls: number;
  ai: number;
  mock: number;
  apiCalls: number;
  inputTokens: number;
  outputTokens: number;
  costTWD: number;
}

interface UsageData {
  today: Bucket;
  month: Bucket;
  total: Bucket;
  byModel: Record<string, number>;
  daily: { date: string; count: number }[];
}

function fmtCost(n: number): string {
  return n < 0.01 && n > 0 ? '< NT$0.01' : `NT$${n.toFixed(2)}`;
}

function StatCard({ label, b }: { label: string; b: Bucket }) {
  const fallbackRate = b.calls > 0 ? Math.round((b.mock / b.calls) * 100) : 0;
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)' }}>
      <div className="text-xs text-[var(--muted)] mb-1">{label}</div>
      <div className="text-2xl font-bold">{b.calls}<span className="text-sm font-normal text-[var(--muted)]"> 次</span></div>
      <div className="text-xs text-[var(--muted)] mt-2 space-y-0.5">
        <div>AI 生成 {b.ai}・備援 {b.mock}
          {b.calls > 0 && (
            <span style={{ color: fallbackRate >= 20 ? '#f87171' : undefined }}>（備援 {fallbackRate}%）</span>
          )}
        </div>
        <div>API 請求 {b.apiCalls}・估算 {fmtCost(b.costTWD)}</div>
      </div>
    </div>
  );
}

export default function UsageSection() {
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/usage')
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setData(j);
      })
      .catch((e: Error) => setError(e.message || '讀取用量失敗'));
  }, []);

  const max = data ? Math.max(1, ...data.daily.map((d) => d.count)) : 1;

  return (
    <section className="glass-card p-6 mb-6">
      <h2 className="text-lg font-semibold mb-1">📊 Gemini 用量</h2>
      <p className="text-xs text-[var(--muted)] mb-4">
        只統計經過本網站的呼叫；費用為依 token 的估算值，實際金額請以 Google AI Studio 帳單為準。
      </p>

      {error && <div className="text-sm text-red-400">{error}</div>}
      {!data && !error && <div className="text-sm text-[var(--muted)]">載入中...</div>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <StatCard label="今天" b={data.today} />
            <StatCard label="本月" b={data.month} />
            <StatCard label="累計" b={data.total} />
          </div>

          {data.month.calls > 0 && data.month.mock / data.month.calls >= 0.2 && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-300"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
              ⚠️ 本月有 {Math.round((data.month.mock / data.month.calls) * 100)}% 的生成使用了備援文案，
              請檢查 Gemini 額度或 API Key 是否正常。
            </div>
          )}

          <div className="text-xs text-[var(--muted)] mb-2">近 14 天生成次數</div>
          <div className="flex items-end gap-1 h-24 mb-1">
            {data.daily.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col justify-end h-full" title={`${d.date}：${d.count} 次`}>
                <div className="rounded-t"
                  style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 2 : 0, background: 'var(--accent, #7c3aed)' }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-[var(--muted)] mb-4">
            <span>{data.daily[0]?.date.slice(5)}</span>
            <span>{data.daily[data.daily.length - 1]?.date.slice(5)}</span>
          </div>

          {Object.keys(data.byModel).length > 0 && (
            <div className="text-xs text-[var(--muted)]">
              本月模型請求數：
              {Object.entries(data.byModel).map(([m, n]) => (
                <span key={m} className="ml-2 px-2 py-0.5 rounded bg-slate-700/60">{m} × {n}</span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
