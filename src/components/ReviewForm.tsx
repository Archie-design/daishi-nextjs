'use client';

import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Options } from '@/lib/sheets';
import ReviewCard from './ReviewCard';
import CopySuccessModal from './CopySuccessModal';

const RANDOM_TONE = '隨機';

export default function ReviewForm() {
  const [options, setOptions] = useState<Options | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [repairProducts, setRepairProducts] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [satisfactions, setSatisfactions] = useState<string[]>([]);
  const [tones, setTones] = useState<string[]>([]);
  const [supplement, setSupplement] = useState('');
  const [reviews, setReviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    fetch('/api/options')
      .then((r) => r.json())
      .then((data: Options) => {
        setOptions(data);
        setTones([RANDOM_TONE]);
        // 還原上次生成結果
        try {
          const saved = localStorage.getItem('daishi_last_reviews');
          if (saved) {
            const parsed: string[] = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setReviews(parsed);
              setRestored(true);
            }
          }
        } catch {
          // ignore
        }
      });
  }, []);

  // 多選 pill 共用邏輯：已選則移除，未選則加入（上限 3 個）
  function toggleIn(setter: Dispatch<SetStateAction<string[]>>) {
    return (val: string) => {
      setter((prev) => {
        if (prev.includes(val)) return prev.filter((v) => v !== val);
        if (prev.length >= 3) return prev;
        return [...prev, val];
      });
    };
  }

  const toggleBrand = toggleIn(setBrands);
  const toggleRepairProduct = toggleIn(setRepairProducts);
  const toggleService = toggleIn(setServices);
  const toggleSatisfaction = toggleIn(setSatisfactions);
  // 語氣：「隨機」與具體語氣互斥；全部取消時回到隨機
  function toggleTone(val: string) {
    setTones((prev) => {
      if (val === RANDOM_TONE) return [RANDOM_TONE];
      const base = prev.filter((v) => v !== RANDOM_TONE);
      if (base.includes(val)) {
        const next = base.filter((v) => v !== val);
        return next.length === 0 ? [RANDOM_TONE] : next;
      }
      if (base.length >= 3) return base;
      return [...base, val];
    });
  }

  async function handleGenerate() {
    if (brands.length === 0) { setError('請先選擇「維修品牌」'); return; }
    if (repairProducts.length === 0) { setError('請先選擇「今天維修產品」'); return; }
    if (services.length === 0) { setError('請先選擇「今天服務項目」'); return; }
    if (tones.length === 0) { setError('請先選擇「想要的評論語氣」'); return; }
    setError('');
    setLoading(true);
    setReviews([]);

    try {
      const res = await fetch('/api/reviews/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services, repairProducts, brands, model, satisfactions, tones, supplement }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReviews(data.reviews);
      setRestored(false);
      try { localStorage.setItem('daishi_last_reviews', JSON.stringify(data.reviews)); } catch { /* ignore */ }
      setTimeout(() => {
        document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '發生錯誤，請再試一次');
    } finally {
      setLoading(false);
    }
  }

  if (!options) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--muted)]">
        載入中...
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-2" style={{
          background: 'linear-gradient(135deg, #ffffff, #94a3b8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          大師修 顧客評論小助手
        </h1>
        <p className="text-[var(--muted)] text-sm">
          幫你快速整理今天的真實體驗<br />
          <span className="font-semibold text-[var(--accent)]">30 秒完成評論內容（可自由修改）</span>
        </p>

        <div className="mt-5 text-left rounded-xl p-4 text-sm"
          style={{ background: 'rgba(32,178,170,0.1)', border: '1px solid rgba(32,178,170,0.2)' }}>
          <p className="font-semibold text-[var(--accent)] mb-2">
            我們不會幫你亂寫評論，只會協助你把「真實感受」整理得更順
          </p>
          <ul className="space-y-1 text-white text-xs">
            {['可自行修改', '不會自動送出', '完全由你決定是否發布'].map((t) => (
              <li key={t} className="flex items-center gap-1">
                <svg className="w-3 h-3 text-[var(--accent)]" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </header>

      <main className="space-y-5">
        {/* Section 1 */}
        <section className="glass-card p-6">
          <label className="block text-lg font-semibold mb-3">
            ① 維修品牌{' '}
            <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 ml-1">必選</span>
            <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-slate-700/60 text-[var(--muted)] ml-1">可複選 (1-3 個)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {options.brands.map((b) => (
              <button key={b} type="button"
                className={`option-pill ${brands.includes(b) ? 'selected-check' : ''}`}
                onClick={() => toggleBrand(b)}>
                {b}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <label className="block text-sm text-[var(--muted)] mb-1.5">
              手機型號 <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700/60 ml-1">選填</span>
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="例如：iPhone 15 Pro、Galaxy S24"
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)' }}
            />
          </div>
        </section>

        {/* Section 2 */}
        <section className="glass-card p-6">
          <label className="block text-lg font-semibold mb-3">
            ② 今天維修產品{' '}
            <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 ml-1">必選</span>
            <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-slate-700/60 text-[var(--muted)] ml-1">可複選 (1-3 個)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {(options.repairProducts ?? []).map((p) => (
              <button key={p} type="button"
                className={`option-pill ${repairProducts.includes(p) ? 'selected-check' : ''}`}
                onClick={() => toggleRepairProduct(p)}>
                {p}
              </button>
            ))}
          </div>
        </section>

        {/* Section 3 */}
        <section className="glass-card p-6">
          <label className="block text-lg font-semibold mb-1">
            ③ 今天服務項目{' '}
            <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 ml-1">必選</span>
            <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-slate-700/60 text-[var(--muted)] ml-1">可複選 (1-3 個)</span>
          </label>
          <p className="text-xs text-[var(--muted)] mb-3">請選擇今天的服務：</p>
          <div className="flex flex-wrap gap-2">
            {options.services.map((s) => (
              <button key={s} type="button"
                className={`option-pill ${services.includes(s) ? 'selected-check' : ''}`}
                onClick={() => toggleService(s)}>
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* Section 4 */}
        <section className="glass-card p-6">
          <label className="block text-lg font-semibold mb-3">
            ④ 今天最滿意的地方{' '}
            <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-slate-700/60 text-[var(--muted)] ml-1">可複選 (1-3 個)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {options.satisfactions.map((s) => (
              <button key={s} type="button"
                className={`option-pill ${satisfactions.includes(s) ? 'selected-check' : ''}`}
                onClick={() => toggleSatisfaction(s)}>
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* Section 5 */}
        <section className="glass-card p-6">
          <label className="block text-lg font-semibold mb-3">
            ⑤ 想要的評論語氣{' '}
            <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 ml-1">必選</span>
            <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-slate-700/60 text-[var(--muted)] ml-1">可複選 (1-3 個)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button"
              className={`option-pill ${tones.includes(RANDOM_TONE) ? 'selected-check' : ''}`}
              onClick={() => toggleTone(RANDOM_TONE)}>
              🎲 隨機語氣
              <span className="ml-1 text-xs bg-[var(--primary)] text-white px-1 py-0.5 rounded">推薦</span>
            </button>
            {options.tones.map((t) => (
              <button key={t} type="button"
                className={`option-pill ${tones.includes(t) ? 'selected-check' : ''}`}
                onClick={() => toggleTone(t)}>
                {t}
              </button>
            ))}
          </div>
        </section>

        {/* Section 6 */}
        <section className="glass-card p-6">
          <label className="block text-lg font-semibold mb-1" htmlFor="supplement">
            ⑥ 補充一句話{' '}
            <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-slate-700/60 text-[var(--muted)] ml-1">選填</span>
          </label>
          <p className="text-xs text-[var(--muted)] mb-3">👉 讓評論更像你的真實感受（可不填）</p>
          <textarea
            id="supplement"
            rows={3}
            value={supplement}
            onChange={(e) => setSupplement(e.target.value)}
            placeholder={'例如：\n原本以為要修很久，結果很快就好了\n第一次來，整體感覺很好'}
            className="w-full rounded-lg px-3 py-2.5 text-sm text-white resize-y focus:outline-none focus:border-blue-500"
            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)' }}
          />
        </section>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-4 rounded-xl text-lg font-semibold text-white transition-all"
          style={{
            background: 'linear-gradient(135deg, #0080FF, #8b5cf6)',
            boxShadow: '0 4px 15px rgba(59,130,246,0.4)',
            opacity: loading ? 0.7 : 1,
          }}>
          {loading ? '⚡ AI 努力撰寫中...' : '⚡ 幫我產生評論（AI生成）'}
        </button>

        {/* 結果 */}
        {reviews.length > 0 && (
          <section id="results" className="fade-in mt-2">
            {restored && (
              <div className="flex items-center justify-between rounded-lg px-3 py-2 mb-3 text-xs"
                style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }}>
                <span>已還原上次生成的評論草稿</span>
                <button
                  onClick={() => { setReviews([]); setRestored(false); localStorage.removeItem('daishi_last_reviews'); }}
                  className="ml-2 opacity-60 hover:opacity-100 transition-opacity">
                  ✕ 清除
                </button>
              </div>
            )}
            <h2 className="text-xl font-semibold mb-4 text-yellow-400">
              👉 幫你整理好的評論{' '}
              <span className="text-sm font-normal text-[var(--muted)]">（可選擇 / 可修改）</span>
            </h2>
            <div className="space-y-4">
              {reviews.map((review, i) => (
                <ReviewCard
                  key={i}
                  index={i}
                  initialText={review}
                  onCopy={() => setShowModal(true)}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="mt-12 pt-6 text-center border-t border-white/10">
        <p className="text-[var(--muted)] text-xs mb-3">
          ⚠️ 重要提醒<br />本工具僅協助整理文字<br />請依照你的真實體驗自由修改後再發布
        </p>
        <p className="text-pink-500 text-sm font-medium">我們重視每一位客戶的真實回饋 ❤️</p>
      </footer>

      {showModal && <CopySuccessModal onClose={() => setShowModal(false)} />}
    </>
  );
}
