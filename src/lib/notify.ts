import nodemailer from 'nodemailer';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
}

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.NOTIFY_EMAIL_USER,
      pass: process.env.NOTIFY_EMAIL_PASS,
    },
  });
}

export interface LowRatingAlertPayload {
  reviewer: string;
  rating: number;
  text: string;
  date: string;
  replyDrafts: string[];
}

export async function sendLowRatingAlert(payload: LowRatingAlertPayload): Promise<void> {
  const stars = '⭐'.repeat(payload.rating);
  const draftsHtml = payload.replyDrafts
    .map(
      (d, i) => `
      <div style="background:#f8f9fa;border-left:4px solid #0080ff;padding:12px 16px;margin-bottom:12px;border-radius:4px;">
        <strong>草稿 ${i + 1}</strong><br/><br/>
        ${d.replace(/\n/g, '<br/>')}
      </div>`
    )
    .join('');

  await getTransporter().sendMail({
    from: `"大師修監控系統" <${process.env.NOTIFY_EMAIL_FROM ?? process.env.NOTIFY_EMAIL_USER}>`,
    to: process.env.NOTIFY_EMAIL_TO,
    subject: `【大師修桃園店】收到 ${payload.rating} 星評論 — 請儘速回覆`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#ef4444;">⚠️ 收到低分評論</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr><td style="padding:6px 0;color:#666;">評論者</td><td><strong>${payload.reviewer}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">評分</td><td><strong>${stars}（${payload.rating} 星）</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">時間</td><td>${formatDate(payload.date)}</td></tr>
        </table>
        <div style="background:#fff3cd;padding:12px 16px;border-radius:6px;margin-bottom:20px;">
          <strong>評論內容：</strong><br/><br/>
          ${payload.text}
        </div>
        <h3 style="color:#0080ff;">💬 AI 回覆草稿（審閱後再貼到 Google Maps）</h3>
        ${draftsHtml}
        <a href="${process.env.NEXT_PUBLIC_MAPS_URL}"
           style="display:inline-block;background:#0080ff;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px;">
          前往 Google Maps 回覆
        </a>
      </div>
    `,
  });
}

export interface WeeklyReportPayload {
  weekStart: string;
  weekEnd: string;
  newCount: number;
  avgRating: number;
  bestReview: { reviewer: string; rating: number; text: string } | null;
  worstReview: { reviewer: string; rating: number; text: string } | null;
  aiSummary: string;
}

export async function sendWeeklyReport(payload: WeeklyReportPayload): Promise<void> {
  const ratingBar = (r: number) => '⭐'.repeat(r) + '☆'.repeat(5 - r);

  const bestHtml = payload.bestReview
    ? `<div style="background:#d4edda;padding:12px;border-radius:6px;margin-bottom:8px;">
        <strong>${payload.bestReview.reviewer}</strong> ${ratingBar(payload.bestReview.rating)}<br/>
        ${payload.bestReview.text}
      </div>`
    : '<p>無</p>';

  const worstHtml = payload.worstReview
    ? `<div style="background:#f8d7da;padding:12px;border-radius:6px;margin-bottom:8px;">
        <strong>${payload.worstReview.reviewer}</strong> ${ratingBar(payload.worstReview.rating)}<br/>
        ${payload.worstReview.text}
      </div>`
    : '<p>本週無低分評論 🎉</p>';

  await getTransporter().sendMail({
    from: `"大師修監控系統" <${process.env.NOTIFY_EMAIL_FROM ?? process.env.NOTIFY_EMAIL_USER}>`,
    to: process.env.NOTIFY_EMAIL_TO,
    subject: `【大師修桃園店】每週評論摘要 ${payload.weekStart} ~ ${payload.weekEnd}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2>📊 每週評論摘要</h2>
        <p style="color:#666;">${payload.weekStart} ～ ${payload.weekEnd}</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:8px 0;color:#666;">本週新評論</td><td><strong>${payload.newCount} 則</strong></td></tr>
          <tr><td style="padding:8px 0;color:#666;">本週平均評分</td><td><strong>${payload.avgRating.toFixed(1)} 星</strong></td></tr>
        </table>
        <div style="background:#e8f4fd;padding:12px 16px;border-radius:6px;margin-bottom:20px;">
          <strong>🤖 AI 本週摘要：</strong><br/>${payload.aiSummary}
        </div>
        <h3 style="color:#28a745;">🏆 最高分評論</h3>
        ${bestHtml}
        <h3 style="color:#dc3545;">⚠️ 最低分評論</h3>
        ${worstHtml}
        <a href="${process.env.NEXT_PUBLIC_MAPS_URL}"
           style="display:inline-block;background:#0080ff;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:16px;">
          前往 Google Maps 查看所有評論
        </a>
      </div>
    `,
  });
}
