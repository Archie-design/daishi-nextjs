'use client';

interface Props {
  onClose: () => void;
}

export default function CopySuccessModal({ onClose }: Props) {
  const mapsUrl = process.env.NEXT_PUBLIC_MAPS_URL ?? 'https://maps.app.goo.gl/bNskpCdwU1cK88N48';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div
        className="glass-card p-8 max-w-sm w-full text-center"
        style={{ borderRadius: '20px' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold mb-2">評論已複製！</h2>
        <p className="text-[var(--muted)] text-sm mb-6">
          現在前往 Google Maps 貼上<br />
          <span className="text-[var(--accent)] font-semibold">只需 10 秒</span>，幫我們留下你的真實感受
        </p>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-3.5 rounded-xl font-semibold text-white mb-3"
          style={{ background: 'linear-gradient(135deg, #0080FF, #8b5cf6)', textDecoration: 'none' }}
          onClick={onClose}>
          ⭐ 立即前往貼上
        </a>
        <button
          onClick={onClose}
          className="text-sm text-[var(--muted)] hover:text-white transition-colors">
          稍後再去
        </button>
      </div>
    </div>
  );
}
