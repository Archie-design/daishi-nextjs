'use client';

export default function QRCodeSection() {
  return (
    <section className="glass-card p-6 mb-4">
      <h2 className="text-base font-semibold mb-1">🔲 店內 QR Code</h2>
      <p className="text-xs text-[var(--muted)] mb-4">掃描後直達 Google Maps 評論頁，可下載列印</p>
      <div className="flex flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/api/qrcode"
          alt="Google Maps QR Code"
          className="rounded-xl"
          style={{ width: 200, height: 200, imageRendering: 'pixelated' }}
        />
        <a
          href="/api/qrcode"
          download="daishi-qrcode.png"
          className="px-6 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: 'linear-gradient(135deg, #0080FF, #7c3aed)',
            color: 'white',
            textDecoration: 'none',
          }}>
          ⬇ 下載 PNG
        </a>
      </div>
    </section>
  );
}
