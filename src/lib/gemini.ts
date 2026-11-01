import { logUsage } from './sheets';

export interface ReviewFormData {
  services: string[];
  repairProducts: string[];
  brands: string[];
  model?: string;
  satisfactions: string[];
  tones: string[];
  supplement: string;
}

const SYSTEM_PROMPT = `你是一個幫助真實消費者整理 Google 商家評論內容的助手。
商家名稱是「大師修桃園店」，是 Apple 原廠授權獨立維修中心，同時也提供 OPPO、三星、ASUS、小米等多品牌授權維修服務。
根據使用者提供的服務項目、品牌、滿意點、語氣與補充內容，生成 3 則自然、真實、口語化的繁體中文評論。
每則寫 2 到 3 句話，總長度約 55 到 70 字（不可少於 40 字，絕對不可超過 80 字），不要鋪陳。不要在評論中標註字數或任何括號說明。
字數示範（共 62 字）：「Apple Watch 電池換好了，報價很透明，工程師也解說得很清楚。整個過程比我想的還快，拿到手機時很安心，之後有問題還會再來。」
三則評論要有明顯差異：每則依「指定語氣」撰寫，開頭句型、用詞、句子結構都要不同，不可套用同一個模板，也不要每則都列出全部選項。
避免以「今天來大師修」開頭，不要三則都以「今天」或「我」開頭。
文字要像一般台灣消費者會留下的評論，例如：「讓人很安心」、「報價透明解說詳細」、「整個過程很快速」、「工程師每個步驟都不馬虎」。
可自然提及維修速度、服務態度、價格透明、原廠零件、保固、安心感等，但不得過度推銷。
最後不要加 hashtag，不要加引號。

請直接回傳這三則評論，每則評論之間用 "|||" 分隔，不要包含其他額外標題或敘述。`;

const RANDOM_TONE = '隨機';
const MIN_LEN = 40;
const MAX_LEN = 80;

// 選「隨機」時的語氣池：每則評論各抽一種，讓三則風格明顯不同
const RANDOM_TONE_POOL = [
  '簡短自然，像隨手留的一句話',
  '真誠推薦，像在跟朋友分享',
  '熱情滿意，語氣開心有感',
  '專業安心，強調過程與信任感',
  '生活化口吻，像日常聊天',
  '平實客觀，陳述這次的經驗',
  '感謝導向，點名感謝店員與工程師',
  '前後對比，先說原本的擔心再說結果',
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return Array.from({ length: n }, (_, i) => copy[i % copy.length]);
}

// 決定三則評論各自的語氣：隨機 → 從語氣池抽；指定 → 從使用者選的語氣輪流分配（順序打亂）
function assignTones(tones: string[]): string[] {
  const chosen = tones.filter((t) => t && t !== RANDOM_TONE);
  if (chosen.length === 0) return pickRandom(RANDOM_TONE_POOL, 3);
  return pickRandom(chosen, 3);
}

// 依優先順序嘗試的模型清單。免費方案常出現 503「high demand」，
// 改用多個模型 + 重試退避，避免單一暫時性錯誤直接回傳 500 給顧客。
const MODELS = ['gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-flash-lite-latest'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 呼叫 Gemini 並對「暫時性錯誤」（429/500/503）做退避重試與跨模型備援。
 * 回傳生成文字；若所有嘗試都失敗則丟出最後一個錯誤。
 */
interface GeminiResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

async function callGemini(prompt: string, apiKey: string): Promise<GeminiResult> {
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
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 1.1 },
            }),
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
        if (text) {
          const u = result?.usageMetadata ?? {};
          return {
            text,
            model,
            inputTokens: Number(u.promptTokenCount ?? 0),
            // 思考 token 也會以輸出價格計費
            outputTokens: Number(u.candidatesTokenCount ?? 0) + Number(u.thoughtsTokenCount ?? 0),
          };
        }
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

// 無 API Key 或 Gemini 全數失敗時的本機備援文案（隨機組合，避免每次內容雷同）
function mockReviews(formData: ReviewFormData): string[] {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const brandText = formData.brands.join('、');
  const serviceText = formData.services.join('、');
  const products =
    formData.repairProducts.length > 0 ? formData.repairProducts.join('、') : serviceText;
  const sat =
    formData.satisfactions.length > 0 ? pick(formData.satisfactions) : '整體服務';
  const extra = formData.supplement ? formData.supplement.trim() : '';

  const templates = [
    () => `${brandText}的${products}出問題，抱著試試看的心情來大師修，${sat}讓我很安心，推薦給大家。`,
    () => `朋友推薦來這裡處理${products}，店員講解得很清楚，${sat}真的加分，下次還會再來。`,
    () => `原本擔心${products}會修很久，結果很快就處理好了，${sat}讓人放心，謝謝大師修。`,
    () => `第一次來大師修${serviceText}，${sat}給我很好的感受，師傅專業又有耐心。`,
    () => `${products}交給大師修處理很放心，過程透明、${sat}，整體體驗很棒。`,
    () => `感謝工程師幫我處理${brandText}的${products}，${sat}，有需要維修會再回來。`,
  ];
  return pickRandom(templates, 3).map((t) => (t() + (extra ? extra : '')).trim());
}

export async function generateReviews(formData: ReviewFormData): Promise<string[]> {
  const API_KEY = process.env.GEMINI_API_KEY;

  const satisfactionsText =
    formData.satisfactions.length > 0
      ? formData.satisfactions.join('、')
      : '無特別選擇（請自由帶入）';
  const supplementText = formData.supplement || '無補充';

  const brandsText = formData.model
    ? `${formData.brands.join('、')}（${formData.model}）`
    : formData.brands.join('、');

  const repairProductsText =
    formData.repairProducts.length > 0 ? formData.repairProducts.join('、') : '無特別指定';

  const servicesText = formData.services.join('、');
  const assignedTones = assignTones(formData.tones);
  const tonesText = assignedTones.map((t, i) => `第 ${i + 1} 則：${t}`).join('\n');

  const userPrompt = `
服務項目：${servicesText}
今天維修的產品/部位：${repairProductsText}
手機品牌與型號：${brandsText}
最滿意的地方：${satisfactionsText}
三則評論的指定語氣（請依序對應）：
${tonesText}
補充一句話：${supplementText}
`;

  // 未設定 API Key → 回傳模擬資料
  if (!API_KEY) {
    await new Promise((r) => setTimeout(r, 1000));
    await logUsage({ kind: 'review', model: '', result: 'mock', apiCalls: 0, inputTokens: 0, outputTokens: 0 });
    return mockReviews(formData);
  }

  const fullPrompt = SYSTEM_PROMPT + '\n\n' + userPrompt;
  const parse = (text: string) =>
    text
      .split('|||')
      // 移除模型偶爾自行附上的「（字數：52）」之類標註
      .map((r) => r.replace(/[（(]\s*(字數|共)?[:：]?\s*\d+\s*字?\s*[）)]/g, '').trim())
      .filter(Boolean)
      .slice(0, 3);
  const inRange = (r: string) => {
    const n = [...r].length;
    return n >= MIN_LEN && n <= MAX_LEN;
  };

  // 最多生成 2 次：第一次有任何一則字數不符，就帶著提醒重生成一次
  let best: string[] = [];
  let lastError: unknown = null;
  let lastTooLong = true;
  let usedModel = '';
  let apiCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const prompt =
        attempt === 0
          ? fullPrompt
          : fullPrompt + `\n\n【重要】上一次有評論字數${lastTooLong ? '太長' : '太短'}。這次每則請寫 ${lastTooLong ? '2 句話、約 50 字' : '3 句話、約 65 字'}，必須在 ${MIN_LEN} 到 ${MAX_LEN} 字之間。`;
      const gen = await callGemini(prompt, API_KEY);
      apiCalls++;
      usedModel = gen.model;
      inputTokens += gen.inputTokens;
      outputTokens += gen.outputTokens;
      const parsed = parse(gen.text);
      if (best.length === 0 || parsed.filter(inRange).length > best.filter(inRange).length) best = parsed;
      if (parsed.length === 3 && parsed.every(inRange)) break;
      lastTooLong = parsed.some((r) => [...r].length > MAX_LEN);
    } catch (e) {
      lastError = e;
      break;
    }
  }

  if (best.length === 0) {
    // Gemini 經多次重試與跨模型備援仍失敗（多半是額度或 503 high demand）。
    // 顧客正在現場填表，不能回傳 500，改用本機備援文案讓流程不中斷。
    console.error('generateReviews fallback to mock:', lastError);
    await logUsage({ kind: 'review', model: usedModel, result: 'mock', apiCalls, inputTokens, outputTokens });
    return mockReviews(formData);
  }

  // 只保留字數合格的 AI 評論，不足 3 則的部分用備援文案補齊
  const valid = best.filter(inRange);
  if (valid.length < 3) {
    console.warn(`generateReviews: ${3 - valid.length} 則字數不符，改用備援文案補齊`);
    valid.push(...mockReviews(formData).slice(0, 3 - valid.length));
  }
  await logUsage({
    kind: 'review', model: usedModel,
    result: valid.length === best.filter(inRange).length ? 'ai' : 'partial',
    apiCalls, inputTokens, outputTokens,
  });
  return valid;
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
    const gen = await callGemini(prompt, API_KEY);
    text = gen.text;
    await logUsage({ kind: 'reply', model: gen.model, result: 'ai', apiCalls: 1, inputTokens: gen.inputTokens, outputTokens: gen.outputTokens });
  } catch {
    await logUsage({ kind: 'reply', model: '', result: 'fail', apiCalls: 0, inputTokens: 0, outputTokens: 0 });
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
    const gen = await callGemini(prompt, API_KEY);
    await logUsage({ kind: 'weekly', model: gen.model, result: 'ai', apiCalls: 1, inputTokens: gen.inputTokens, outputTokens: gen.outputTokens });
    return gen.text.trim() || '（無摘要）';
  } catch {
    await logUsage({ kind: 'weekly', model: '', result: 'fail', apiCalls: 0, inputTokens: 0, outputTokens: 0 });
    return '（摘要產生失敗）';
  }
}
