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

// 依優先順序嘗試的模型清單。免費方案常出現 503「high demand」，
// 改用多個模型 + 重試退避，避免單一暫時性錯誤直接回傳 500 給顧客。
const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-flash-lite-latest'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 呼叫 Gemini 並對「暫時性錯誤」（429/500/503）做退避重試與跨模型備援。
 * 回傳生成文字；若所有嘗試都失敗則丟出最後一個錯誤。
 */
async function callGemini(prompt: string, apiKey: string): Promise<string> {
  let lastError: Error = new Error('Gemini API 呼叫失敗');

  for (const model of MODELS) {
    // 每個模型最多嘗試 3 次（退避：0ms → 600ms → 1500ms）
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(attempt === 1 ? 600 : 1500);

      let res: Response;
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          }
        );
      } catch (e) {
        // 網路層錯誤 → 視為暫時性，重試
        lastError = e instanceof Error ? e : new Error('網路錯誤');
        continue;
      }

      if (res.ok) {
        const result = await res.json();
        const text: string =
          result?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (text) return text;
        // 安全機制擋下或空回應 → 換下一個模型
        lastError = new Error('Gemini API 未回傳預期的文字');
        break;
      }

      const err = await res.json().catch(() => null);
      const message: string = err?.error?.message ?? res.statusText;
      lastError = new Error(`Gemini API 錯誤：${message}`);

      // 429/500/503 為暫時性 → 重試本模型；其餘（如 400/403）→ 換下一個模型
      if (![429, 500, 503].includes(res.status)) break;
    }
  }

  throw lastError;
}

// 無 API Key 或 Gemini 全數失敗時的本機備援文案
function mockReviews(formData: ReviewFormData): string[] {
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
    return mockReviews(formData);
  }

  let outputText: string;
  try {
    outputText = await callGemini(SYSTEM_PROMPT + '\n\n' + userPrompt, API_KEY);
  } catch (e) {
    // Gemini 經多次重試與跨模型備援仍失敗（多半是免費方案 503 high demand）。
    // 顧客正在現場填表，不能回傳 500，改用本機備援文案讓流程不中斷。
    console.error('generateReviews fallback to mock:', e);
    return mockReviews(formData);
  }

  return outputText
    .split('|||')
    .map((s: string) => s.trim())
    .filter(Boolean)
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

  let text: string;
  try {
    text = await callGemini(prompt, API_KEY);
  } catch {
    return ['（Gemini API 呼叫失敗）'];
  }
  return text.split('|||').map((s: string) => s.trim()).filter(Boolean).slice(0, 2);
}

// ── 週報摘要 ────────────────────────────────────────────────

export async function generateWeeklySummary(reviews: { text: string; rating: number }[]): Promise<string> {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY || reviews.length === 0) return '本週無新評論。';

  const reviewsList = reviews
    .map((r, i) => `${i + 1}. [${r.rating}星] ${r.text}`)
    .join('\n');

  const prompt = `以下是大師修桃園店本週收到的 Google 評論，請用一句話（30字以內）摘要本週整體顧客感受：\n\n${reviewsList}`;

  try {
    const text = await callGemini(prompt, API_KEY);
    return text.trim() || '（無摘要）';
  } catch {
    return '（摘要產生失敗）';
  }
}
