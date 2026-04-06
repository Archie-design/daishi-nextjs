'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Options } from '@/lib/sheets';
import OptionsSection from './OptionsSection';
import QRCodeSection from './QRCodeSection';
import PasswordSection from './PasswordSection';
import ReviewsSection from './ReviewsSection';

export default function AdminPanel() {
  const [options, setOptions] = useState<Options | null>(null);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/options').then((r) => r.json()).then(setOptions);
  }, []);

  async function handleSave() {
    if (!options) return;
    setSaving(true);
    const res = await fetch('/api/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    setSaving(false);
    if (res.ok) {
      setBanner('✅ 儲存成功！前台頁面已即時更新。');
      setTimeout(() => setBanner(''), 4000);
    } else {
      alert('儲存失敗，請重試');
    }
  }

  async function handleReset() {
    if (!confirm('確定要恢復所有預設值嗎？目前的修改將會遺失。')) return;
    await fetch('/api/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(null),
    });
    const fresh = await fetch('/api/options').then((r) => r.json());
    setOptions(fresh);
    setBanner('✅ 已恢復預設值！');
    setTimeout(() => setBanner(''), 4000);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/admin/login');
  }

  if (!options) {
    return <div className="text-center py-20 text-[var(--muted)]">載入中...</div>;
  }

  return (
    <>
      <header className="flex justify-between items-start mb-8 pb-6 border-b border-white/10">
        <div>
          <h1 className="text-2xl font-bold">⚙️ 後台管理</h1>
          <p className="text-[var(--muted)] text-sm mt-1">修改選項後點「儲存所有設定」</p>
        </div>
        <button onClick={handleLogout}
          className="px-3 py-1.5 rounded-lg text-sm transition-all"
          style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--muted)' }}>
          登出
        </button>
      </header>

      {banner && (
        <div className="mb-5 px-4 py-3 rounded-xl text-sm text-center text-emerald-300"
          style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
          {banner}
        </div>
      )}

      <OptionsSection label="① 今日服務項目" items={options.services}
        onChange={(v) => setOptions({ ...options, services: v })} />
      <OptionsSection label="② 手機品牌" items={options.brands}
        onChange={(v) => setOptions({ ...options, brands: v })} />
      <OptionsSection label="③ 今天最滿意的地方" items={options.satisfactions}
        onChange={(v) => setOptions({ ...options, satisfactions: v })} />
      <OptionsSection label="④ 想要的評論語氣" items={options.tones}
        onChange={(v) => setOptions({ ...options, tones: v })} />

      <div className="flex gap-3 flex-wrap mt-2 mb-4">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-3 rounded-xl font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #0080FF, #7c3aed)', opacity: saving ? 0.7 : 1 }}>
          {saving ? '儲存中...' : '💾 儲存所有設定'}
        </button>
        <button onClick={handleReset}
          className="flex-1 py-3 rounded-xl font-semibold transition-all"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          ↺ 恢復預設值
        </button>
      </div>

      <ReviewsSection />
      <QRCodeSection />
      <PasswordSection />
    </>
  );
}
