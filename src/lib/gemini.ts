export interface ReviewFormData {
  service: string;
  brand: string;
  model?: string;
  satisfactions: string[];
  tone: string;
  supplement: string;
}

const SYSTEM_PROMPT = `你是一個幫助真實消費者整理 Google 商家評論內容的助手。
商家名稱是「大師修桃園店」，是 Apple 原廠授權獨立維修中心，同時也提供 OPPO、三星、ASUS、小米等多品牌授權維修服務。
根據使用者提供的服務項目、品牌、滿意點、語氣與補充內容，生成 3 則自然、真實、口語化的繁體中文評論。
每則 35 到 90 字。
不要誇大、不虛構、不重複句型。每則評論的開頭句型要不同（避免三則都以「今天」或「我」開頭）。
文字要像一般台灣消費者會留下的評論，例如：「讓人很安心」、「報價透明解說詳細」、「整個過程很快速」、「工程師每個步驟都不馬虎」。
可自然提及維修速度、服務態度、價格透明、原廠零件、保固、安心感等，但不得過度推銷。
最後不要加 hashtag，不要加引號。

請直接回傳這三則評論，每則評論之間用 "|||" 分隔，不要包含其他額外標題或敘述。`;

export async function generateReviews(formData: ReviewFormData): Promise<string[]> {
  const API_KEY = process.env.GEMINI_API_KEY;

  const satisfactionsText =
    formData.satisfactions.length > 0
      ? formData.satisfactions.join('、')
      : '無特別選擇（請自由帶入）';
  const supplementText = formData.supplement || '無補充';

  const brandText = formData.model
    ? `${formData.brand}（${formData.model}）`
    : formData.brand;

  const userPrompt = `
服務項目：${formData.service}
手機品牌與型號：${brandText}
最滿意的地方：${satisfactionsText}
想要的評論語氣：${formData.tone}
補充一句話：${supplementText}
`;

  // 未設定 API Key → 回傳模擬資料
  if (!API_KEY) {
    await new Promise((r) => setTimeout(r, 1000));
    const sat =
      formData.satisfactions.length > 0
        ? `，尤其是${formData.satisfactions.join('跟')}`
        : '';
    return [
      `今天來大師修換${formData.brand}${formData.model ? ` ${formData.model}` : ''}的${formData.service}${sat}，整體很滿意！${formData.supplement ?? ''}`,
      `第一次拿${formData.brand}來大師修體驗${formData.service}，店員服務態度很好，推薦給大家。${formData.supplement ?? ''}`,
      `感謝大師修幫我做${formData.service}${sat}，${formData.supplement || '下次手機有問題還會想來這裡修！'}`,
    ];
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }] }],
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Gemini API 錯誤：${err?.error?.message ?? res.statusText}`);
  }

  const result = await res.json();
  const outputText: string = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!outputText) throw new Error('Gemini API 未回傳預期的文字');

  return outputText
    .split('|||')
    .map((s: string) => s.trim())
    .slice(0, 3);
}

// ── 負評回覆草稿 ────────────────────────────────────────────

export async function generateReplyDrafts(reviewText: string, rating: number): Promise<string[]> {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return ['（未設定 Gemini API Key，無法產生草稿）'];

  const prompt = `你是大師修桃園店的客服人員，需要對以下 ${rating} 星的 Google Maps 評論撰寫官方回覆。
請產生 2 則不同風格的回覆草稿：第一則偏正式、第二則偏親切口語。
每則 80～150 字，態度誠懇、不辯解、展現解決意願，不要在開頭用「您好」。
兩則草稿之間用 "|||" 分隔，不含其他標題。

顧客評論內容：
「${reviewText}」`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });

  if (!res.ok) return ['（Gemini API 呼叫失敗）'];

  const result = await res.json();
  const text: string = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return text.split('|||').map((s: string) => s.trim()).slice(0, 2);
}

// ── 週報摘要 ────────────────────────────────────────────────

export async function generateWeeklySummary(reviews: { text: string; rating: number }[]): Promise<string> {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY || reviews.length === 0) return '本週無新評論。';

  const reviewsList = reviews
    .map((r, i) => `${i + 1}. [${r.rating}星] ${r.text}`)
    .join('\n');

  const prompt = `以下是大師修桃園店本週收到的 Google 評論，請用一句話（30字以內）摘要本週整體顧客感受：\n\n${reviewsList}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });

  if (!res.ok) return '（摘要產生失敗）';
  const result = await res.json();
  return result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '（無摘要）';
}
