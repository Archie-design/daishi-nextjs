'use client';

import { useState } from 'react';

interface Props {
  index: number;
  initialText: string;
  onCopy: () => void;
}

export default function ReviewCard({ index, initialText, onCopy }: Props) {
  const [text, setText] = useState(initialText);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    onCopy();
    setTimeout(() => setCopied(false), 2000);
  }

  const mapsUrl = process.env.NEXT_PUBLIC_MAPS_URL ?? 'https://maps.app.goo.gl/bNskpCdwU1cK88N48';

  return (
    <div className="glass-card p-5" style={{ boxShadow: '0 4px 15px 0 rgba(0,0,0,0.2)' }}>
      <div className="flex justify-between items-center mb-2 text-sm text-[var(--muted)]">
        <span>✏️ 評論版本 {index + 1}</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="w-full rounded px-2 py-1.5 text-sm text-white resize-y focus:outline-none mb-3"
        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid transparent', lineHeight: '1.5' }}
        onFocus={(e) => (e.target.style.borderColor = '#0080FF')}
        onBlur={(e) => (e.target.style.borderColor = 'transparent')}
      />
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff' }}>
          {copied ? '✅ 已複製' : '📋 複製'}
        </button>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-2 rounded-lg text-sm font-medium text-center transition-all"
          style={{
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.3)',
            color: '#60a5fa',
            textDecoration: 'none',
          }}>
          ⭐ 前往 Google
        </a>
      </div>
    </div>
  );
}
