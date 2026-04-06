import { NextResponse } from 'next/server';
import QRCode from 'qrcode';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_MAPS_URL ?? 'https://maps.app.goo.gl/bNskpCdwU1cK88N48';

  const buffer = await QRCode.toBuffer(url, {
    type: 'png',
    width: 400,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': 'attachment; filename="daishi-qrcode.png"',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
