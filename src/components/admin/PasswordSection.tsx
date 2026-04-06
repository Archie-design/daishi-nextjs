'use client';

import { useState } from 'react';

export default function PasswordSection() {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [msg, setMsg] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleChange() {
    if (!oldPw || !newPw) { setMsg('請填寫舊密碼與新密碼'); setSuccess(false); return; }
    if (newPw.length < 4) { setMsg('新密碼至少需要 4 個字元'); setSuccess(false); return; }

    const res = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
    });
    const data = await res.json();
    if (res.ok) {
      setSuccess(true);
      setMsg('密碼更新成功！');
      setOldPw(''); setNewPw('');
    } else {
      setSuccess(false);
      setMsg(data.error ?? '更改失敗');
    }
    setTimeout(() => setMsg(''), 4000);
  }

  return (
    <section className="glass-card p-6 mt-4">
      <h2 className="text-base font-semibold mb-4">🔑 更改管理密碼</h2>
      <div className="flex flex-wrap gap-2">
        <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)}
          placeholder="舊密碼"
          className="flex-1 min-w-[130px] px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
          style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)' }} />
        <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
          placeholder="新密碼（至少4字）"
          className="flex-1 min-w-[130px] px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
          style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)' }} />
        <button onClick={handleChange}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{ background: 'rgba(32,178,170,0.15)', border: '1px solid rgba(32,178,170,0.3)', color: '#2dd4bf' }}>
          更改密碼
        </button>
      </div>
      {msg && (
        <p className={`mt-3 text-sm px-3 py-2 rounded-lg ${success
          ? 'bg-emerald-900/30 text-emerald-400'
          : 'bg-red-900/30 text-red-400'}`}>
          {msg}
        </p>
      )}
    </section>
  );
}
