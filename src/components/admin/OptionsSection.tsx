'use client';

import { useState } from 'react';

interface Props {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}

export default function OptionsSection({ label, items, onChange }: Props) {
  const [input, setInput] = useState('');

  function add() {
    const val = input.trim();
    if (!val) return;
    if (items.includes(val)) { alert(`「${val}」已經存在！`); return; }
    onChange([...items, val]);
    setInput('');
  }

  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  return (
    <section className="glass-card p-6 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-semibold">{label}</h2>
        <span className="text-xs px-2 py-0.5 rounded-full text-[var(--muted)]"
          style={{ background: 'rgba(148,163,184,0.15)' }}>
          {items.length} 項
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 min-h-[2.5rem]">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
            {item}
            <button onClick={() => remove(i)}
              className="text-red-400 hover:text-red-300 transition-colors text-base leading-none"
              title="刪除">
              ✕
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="輸入後按 Enter 或點＋新增"
          className="flex-1 px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
          style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)' }}
          onFocus={(e) => (e.target.style.borderColor = '#0080FF')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
        />
        <button onClick={add}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{ background: 'rgba(32,178,170,0.15)', border: '1px solid rgba(32,178,170,0.3)', color: '#2dd4bf' }}>
          ＋ 新增
        </button>
      </div>
    </section>
  );
}
