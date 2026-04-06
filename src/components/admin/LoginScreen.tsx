'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    if (!password) return;
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push('/admin');
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? '密碼錯誤，請再試一次');
      setLoading(false);
    }
  }

  return (
    <div className="glass-card p-10 w-full max-w-sm text-center" style={{ borderRadius: '20px' }}>
      <div className="text-4xl mb-3">🔐</div>
      <h1 className="text-2xl font-bold mb-1">後台管理</h1>
      <p className="text-[var(--muted)] text-sm mb-8">大師修顧客評論小助手</p>

      <div className="space-y-3">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          placeholder="請輸入管理密碼"
          className="w-full px-4 py-3 rounded-lg text-white text-sm focus:outline-none"
          style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)' }}
          onFocus={(e) => (e.target.style.borderColor = '#0080FF')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
        />
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3 rounded-lg font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #0080FF, #7c3aed)', opacity: loading ? 0.7 : 1 }}>
          {loading ? '驗證中...' : '登入'}
        </button>
      </div>

      {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
    </div>
  );
}
