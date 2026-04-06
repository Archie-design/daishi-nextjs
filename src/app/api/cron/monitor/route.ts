import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getReviews, appendReview, markAlertSent } from '@/lib/sheets';
import { generateReplyDrafts } from '@/lib/gemini';
import { sendLowRatingAlert } from '@/lib/notify';
import type { ReviewRow } from '@/lib/sheets';

function authorize(req: NextRequest): boolean {
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

// ── Business Profile API ────────────────────────────────────

async function fetchReviewsFromBusinessProfile(): Promise<ReviewRow[]> {
  const authClient = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/business.manage'],
  });

  const accountId = process.env.GOOGLE_BUSINESS_ACCOUNT_ID!;
  const locationId = process.env.GOOGLE_BUSINESS_LOCATION_ID!;
  const accessToken = (await authClient.authorize()).access_token;

  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error(`Business Profile API 錯誤：${res.status}`);

  const data = await res.json();
  const starMap: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

  return (data.reviews ?? []).map((r: {
    reviewId: string;
    reviewer: { displayName: string };
    starRating: string;
    comment?: string;
    createTime: string;
    reviewReply?: unknown;
  }) => ({
    reviewId: r.reviewId,
    reviewer: r.reviewer.displayName,
    rating: starMap[r.starRating] ?? 0,
    text: r.comment ?? '',
    date: new Date(r.createTime).toISOString(),
    replied: !!r.reviewReply,
    alertSent: false,
  }));
}

// ── Places API（備用，最多 5 則）──────────────────────────────

async function fetchReviewsFromPlaces(): Promise<ReviewRow[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY!;
  const placeId = process.env.GOOGLE_PLACE_ID!;

  const url = `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${placeId}&fields=reviews&language=zh-TW&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Places API HTTP 錯誤：${res.status}`);

  const data = await res.json();
  if (data.status !== 'OK') throw new Error(`Places API 狀態錯誤：${data.status}`);

  return (data.result?.reviews ?? []).map((r: {
    author_name: string;
    rating: number;
    text: string;
    time: number;
  }) => {
    // Places API 沒有 reviewId，用作者名 + 時間戳產生穩定 ID
    const reviewId = `places_${r.time}_${r.author_name.replace(/\s+/g, '_')}`;
    return {
      reviewId,
      reviewer: r.author_name,
      rating: r.rating,
      text: r.text ?? '',
      date: new Date(r.time * 1000).toISOString(),
      replied: false,   // Places API 無法得知是否已回覆
      alertSent: false,
    };
  });
}

// ── Cron 主流程 ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const useBusinessProfile = !!(
      process.env.GOOGLE_BUSINESS_ACCOUNT_ID &&
      process.env.GOOGLE_BUSINESS_LOCATION_ID
    );

    let apiReviews: ReviewRow[];
    let source: string;

    if (useBusinessProfile) {
      apiReviews = await fetchReviewsFromBusinessProfile();
      source = 'business_profile';
    } else if (process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_PLACE_ID) {
      apiReviews = await fetchReviewsFromPlaces();
      source = 'places_api';
    } else {
      return NextResponse.json(
        { error: '未設定任何評論來源（需要 GOOGLE_BUSINESS_ACCOUNT_ID 或 GOOGLE_MAPS_API_KEY + GOOGLE_PLACE_ID）' },
        { status: 500 }
      );
    }

    const existing = await getReviews();
    const existingIds = new Set(existing.map((r) => r.reviewId));

    let newCount = 0;
    let alertsSent = 0;

    for (const r of apiReviews) {
      if (existingIds.has(r.reviewId)) continue;

      await appendReview(r);
      newCount++;

      if (r.rating <= 4 && r.text) {
        const replyDrafts = await generateReplyDrafts(r.text, r.rating);
        await sendLowRatingAlert({
          reviewer: r.reviewer,
          rating: r.rating,
          text: r.text,
          date: r.date,
          replyDrafts,
        });
        await markAlertSent(r.reviewId);
        alertsSent++;
      }
    }

    return NextResponse.json({ ok: true, source, newReviews: newCount, alertsSent });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '未知錯誤';
    console.error('[cron/monitor]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
