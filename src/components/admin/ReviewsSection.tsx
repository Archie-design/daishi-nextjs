'use client';

import { useState, useEffect } from 'react';
import type { ReviewRow } from '@/lib/sheets';

const STARS: Record<number, string> = { 1: '★☆☆☆☆', 2: '★★☆☆☆', 3: '★★★☆☆', 4: '★★★★☆', 5: '★★★★★' };
const RATING_COLOR: Record<number, string> = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#84cc16', 5: '#22c55e' };

export default function ReviewsSection() {
  const [reviews, setReviews] = useState<ReviewRow[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'unreplied'>('all');

  useEffect(() => {
    fetch('/api/reviews')
      .then((r) => {
        if (!r.ok) throw new Error('讀取失敗');
        return r.json();
      })
      .then((data) => setReviews([...data].reverse()))
      .catch(() => setError('無法載入評論，請確認 Sheets 設定'));
  }, []);

  const filtered = reviews?.filter((r) => {
    if (filter === 'low') return r.rating <= 4;
    if (filter === 'unreplied') return !r.replied;
    return true;
  }) ?? [];

  const avgRating =
    reviews && reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : '—';

  const lowCount = reviews?.filter((r) => r.rating <= 4).length ?? 0;
  const unrepliedCount = reviews?.filter((r) => !r.replied).length ?? 0;

  return (
    <section className="glass-card p-6 mb-4">
      <h2 className="text-base font-semibold mb-4">📋 評論記錄</h2>

      {error && (
        <p className="text-sm text-red-400 mb-4">{error}</p>
      )}

      {!reviews && !error && (
        <p className="text-sm text-[var(--muted)] text-center py-6">載入中...</p>
      )}

      {reviews && (
        <>
          {/* 統計卡片 */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: '總評論數', value: reviews.length },
              { label: '平均評分', value: avgRating },
              { label: '未回覆', value: unrepliedCount, warn: unrepliedCount > 0 },
            ].map(({ label, value, warn }) => (
              <div
                key={label}
                className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-xl font-bold" style={{ color: warn ? '#f87171' : 'var(--accent)' }}>
                  {value}
                </div>
                <div className="text-xs text-[var(--muted)] mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* 篩選按鈕 */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {([
              ['all', '全部'],
              ['low', `低分 (${lowCount})`],
              ['unreplied', `未回覆 (${unrepliedCount})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: filter === key ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                  color: filter === key ? '#fff' : 'var(--muted)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* 評論列表 */}
          {filtered.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-6">無符合條件的評論</p>
          ) : (
            <div className="flex flex-col gap-3 max-h-[480px] overflow-y-auto pr-1">
              {filtered.map((r) => (
                <div
                  key={r.reviewId}
                  className="rounded-xl p-4"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${r.rating <= 4 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)'}`,
                  }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{r.reviewer || '匿名'}</span>
                      <span className="text-xs font-mono" style={{ color: RATING_COLOR[r.rating] ?? '#999' }}>
                        {STARS[r.rating] ?? '?'}
                      </span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {r.replied && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
                          已回覆
                        </span>
                      )}
                      {r.alertSent && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                          已示警
                        </span>
                      )}
                    </div>
                  </div>
                  {r.text && (
                    <p className="text-sm text-[var(--muted)] leading-relaxed mb-2">{r.text}</p>
                  )}
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {new Date(r.date).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
