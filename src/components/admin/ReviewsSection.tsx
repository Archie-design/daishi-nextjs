'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ReviewRow } from '@/lib/sheets';

const STARS: Record<number, string> = { 1: '★☆☆☆☆', 2: '★★☆☆☆', 3: '★★★☆☆', 4: '★★★★☆', 5: '★★★★★' };
const RATING_COLOR: Record<number, string> = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#84cc16', 5: '#22c55e' };

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
}

function parseDateTs(dateStr: string): number {
  return new Date(dateStr).getTime() || 0;
}

function exportCSV(reviews: ReviewRow[]) {
  const headers = ['評論ID', '評論者', '評分', '內容', '日期', '已回覆', '已示警'];
  const rows = reviews.map((r) => [
    r.reviewId,
    r.reviewer,
    r.rating,
    `"${r.text.replace(/"/g, '""')}"`,
    formatDate(r.date),
    r.replied ? '是' : '否',
    r.alertSent ? '是' : '否',
  ]);
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `大師修評論_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type FilterKey = 'all' | 'low' | 'unreplied';
type SortKey = 'newest' | 'oldest' | 'highest' | 'lowest';

export default function ReviewsSection() {
  const [reviews, setReviews] = useState<ReviewRow[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [search, setSearch] = useState('');
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/reviews')
      .then((r) => {
        if (!r.ok) throw new Error('讀取失敗');
        return r.json();
      })
      .then((data) => setReviews(data))
      .catch(() => setError('無法載入評論，請確認 Sheets 設定'));
  }, []);

  const handleMarkReplied = useCallback(async (reviewId: string) => {
    setMarkingId(reviewId);
    try {
      const res = await fetch('/api/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId }),
      });
      if (!res.ok) throw new Error();
      setReviews((prev) =>
        prev ? prev.map((r) => (r.reviewId === reviewId ? { ...r, replied: true } : r)) : prev
      );
    } catch {
      alert('標記失敗，請稍後再試');
    } finally {
      setMarkingId(null);
    }
  }, []);

  // ── Computed stats ──────────────────────────────────────────
  const total = reviews?.length ?? 0;
  const repliedCount = reviews?.filter((r) => r.replied).length ?? 0;
  const replyRate = total > 0 ? Math.round((repliedCount / total) * 100) : 0;
  const avgRating =
    total > 0
      ? (reviews!.reduce((s, r) => s + r.rating, 0) / total).toFixed(1)
      : '—';
  const lowCount = reviews?.filter((r) => r.rating <= 4).length ?? 0;
  const unrepliedCount = reviews?.filter((r) => !r.replied).length ?? 0;

  // Rating distribution (5 → 1)
  const ratingDist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews?.filter((r) => r.rating === star).length ?? 0,
  }));

  // Monthly trend (last 6 months with data)
  const monthlyData = (() => {
    if (!reviews || reviews.length === 0) return [];
    const map = new Map<string, { count: number; ratingSum: number }>();
    for (const r of reviews) {
      const d = new Date(r.date);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const cur = map.get(key) ?? { count: 0, ratingSum: 0 };
      map.set(key, { count: cur.count + 1, ratingSum: cur.ratingSum + r.rating });
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, { count, ratingSum }]) => ({
        month,
        count,
        avg: (ratingSum / count).toFixed(1),
      }));
  })();

  const maxMonthlyCount = Math.max(...monthlyData.map((m) => m.count), 1);

  // ── Filtered + sorted list ──────────────────────────────────
  const filtered = (reviews ?? [])
    .filter((r) => {
      if (filter === 'low') return r.rating <= 4;
      if (filter === 'unreplied') return !r.replied;
      return true;
    })
    .filter((r) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return r.reviewer.toLowerCase().includes(q) || r.text.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sort === 'newest') return parseDateTs(b.date) - parseDateTs(a.date);
      if (sort === 'oldest') return parseDateTs(a.date) - parseDateTs(b.date);
      if (sort === 'highest') return b.rating - a.rating;
      if (sort === 'lowest') return a.rating - b.rating;
      return 0;
    });

  const cardStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };

  return (
    <section className="glass-card p-6 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">📋 評論記錄</h2>
        {reviews && reviews.length > 0 && (
          <button
            onClick={() => exportCSV(reviews)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--muted)' }}>
            ⬇ 匯出 CSV
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
      {!reviews && !error && (
        <p className="text-sm text-[var(--muted)] text-center py-6">載入中...</p>
      )}

      {reviews && (
        <>
          {/* ① 統計卡片 */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl p-3 text-center" style={cardStyle}>
              <div className="text-xl font-bold" style={{ color: 'var(--accent)' }}>{total}</div>
              <div className="text-xs text-[var(--muted)] mt-0.5">總評論數</div>
            </div>
            <div className="rounded-xl p-3 text-center" style={cardStyle}>
              <div className="text-xl font-bold" style={{ color: 'var(--accent)' }}>{avgRating}</div>
              <div className="text-xs text-[var(--muted)] mt-0.5">平均評分</div>
            </div>
            <div className="rounded-xl p-3 text-center" style={cardStyle}>
              <div
                className="text-xl font-bold"
                style={{ color: unrepliedCount > 0 ? '#f87171' : 'var(--accent)' }}>
                {unrepliedCount}
              </div>
              <div className="text-xs text-[var(--muted)] mt-0.5">未回覆</div>
            </div>
          </div>

          {/* ② 回覆率 */}
          <div className="rounded-xl p-4 mb-4" style={cardStyle}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--muted)]">回覆率</span>
              <span
                className="text-sm font-bold"
                style={{ color: replyRate >= 80 ? '#4ade80' : replyRate >= 50 ? '#facc15' : '#f87171' }}>
                {replyRate}%
              </span>
            </div>
            <div className="w-full rounded-full h-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${replyRate}%`,
                  background: replyRate >= 80 ? '#4ade80' : replyRate >= 50 ? '#facc15' : '#f87171',
                }}
              />
            </div>
            <p className="text-xs text-[var(--muted)] mt-1.5">
              {repliedCount} / {total} 則已回覆
            </p>
          </div>

          {/* ① 評分分佈 */}
          {total > 0 && (
            <div className="rounded-xl p-4 mb-4" style={cardStyle}>
              <div className="text-xs text-[var(--muted)] mb-3">評分分佈</div>
              <div className="flex flex-col gap-2">
                {ratingDist.map(({ star, count }) => (
                  <div key={star} className="flex items-center gap-2">
                    <span
                      className="text-xs w-5 text-right shrink-0 font-mono"
                      style={{ color: RATING_COLOR[star] }}>
                      {star}★
                    </span>
                    <div
                      className="flex-1 rounded-full h-2 overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: total > 0 ? `${(count / total) * 100}%` : '0%',
                          background: RATING_COLOR[star],
                        }}
                      />
                    </div>
                    <span className="text-xs w-5 shrink-0 text-right" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ⑥ 月度趨勢 */}
          {monthlyData.length > 1 && (
            <div className="rounded-xl p-4 mb-4" style={cardStyle}>
              <div className="text-xs text-[var(--muted)] mb-3">近 6 個月評論量</div>
              <div className="flex items-end gap-1.5 h-20">
                {monthlyData.map(({ month, count, avg }) => (
                  <div key={month} className="flex-1 flex flex-col items-center gap-1" title={`平均 ${avg} 星`}>
                    <span className="text-xs font-medium" style={{ color: 'var(--accent)', fontSize: '11px' }}>
                      {count}
                    </span>
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${Math.max((count / maxMonthlyCount) * 48, 4)}px`,
                        background: 'linear-gradient(to top, var(--accent), rgba(32,178,170,0.35))',
                      }}
                    />
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>
                      {parseInt(month.slice(5))}月
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ③ 篩選 + 搜尋 + 排序 */}
          <div className="flex flex-wrap gap-2 mb-3">
            {(
              [
                ['all', '全部'],
                ['low', `低分 (${lowCount})`],
                ['unreplied', `未回覆 (${unrepliedCount})`],
              ] as const
            ).map(([key, label]) => (
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

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋評論者或關鍵字..."
              className="flex-1 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg px-2 py-1.5 text-xs focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--muted)' }}>
              <option value="newest">最新</option>
              <option value="oldest">最舊</option>
              <option value="highest">最高分</option>
              <option value="lowest">最低分</option>
            </select>
          </div>

          {/* 評論列表 */}
          {filtered.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-6">無符合條件的評論</p>
          ) : (
            <div className="flex flex-col gap-3 max-h-[520px] overflow-y-auto pr-1">
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
                    <div className="flex gap-1 shrink-0 flex-wrap justify-end items-center">
                      {/* ④ 標記已回覆按鈕 */}
                      {r.replied ? (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
                          已回覆
                        </span>
                      ) : (
                        <button
                          onClick={() => handleMarkReplied(r.reviewId)}
                          disabled={markingId === r.reviewId}
                          className="text-xs px-2 py-0.5 rounded-full transition-all"
                          style={{
                            background: 'rgba(59,130,246,0.2)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59,130,246,0.3)',
                            opacity: markingId === r.reviewId ? 0.5 : 1,
                          }}>
                          {markingId === r.reviewId ? '處理中...' : '標記已回覆'}
                        </button>
                      )}
                      {r.alertSent && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
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
                    {formatDate(r.date)}
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
