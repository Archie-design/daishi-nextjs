import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SHEET_ID = process.env.GOOGLE_SHEETS_ID!;

export interface Options {
  services: string[];
  repairProducts: string[];
  brands: string[];
  satisfactions: string[];
  tones: string[];
}

export interface ReviewRow {
  reviewId: string;
  reviewer: string;
  rating: number;
  text: string;
  date: string;
  replied: boolean;
  alertSent: boolean;
}

const DEFAULT_OPTIONS: Options = {
  services: [
    'Apple 原廠電池更換',
    'Apple 原廠螢幕更換',
    'iPhone 維修',
    'Android 維修',
    'OPPO 授權維修',
    'iPad / MacBook 維修',
    '新機購買',
    '中古機買賣',
    '二手機回收',
    '配件購買',
  ],
  repairProducts: ['電池', '螢幕', '主機板', '相機鏡頭', '充電孔', '揚聲器', '按鍵', '其他'],
  brands: ['Apple', 'Samsung', 'OPPO', 'ASUS', 'Vivo', 'Xiaomi', 'Huawei', 'Google', 'Sony', '其他'],
  satisfactions: [
    '維修速度快',
    '價格透明',
    '服務態度好',
    '老闆很誠實',
    '解說很清楚',
    '使用原廠零件很安心',
    '有90天保固更放心',
    '免費檢測診斷',
    '地點方便',
    '回收價格不錯',
    '買手機價格划算',
  ],
  tones: ['簡短自然', '真誠推薦', '熱情滿意', '專業安心', '生活化口吻'],
};

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: SCOPES,
  });
}

async function getSheets() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

// ── Config 分頁 ────────────────────────────────────────────

export async function getConfig(key: string): Promise<string | null> {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Config!A:B',
  });
  const rows = res.data.values ?? [];
  const row = rows.find((r) => r[0] === key);
  return row ? row[1] : null;
}

export async function setConfig(key: string, value: string): Promise<void> {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Config!A:B',
  });
  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex((r) => r[0] === key);

  if (rowIndex === -1) {
    // 新增一列
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Config!A:B',
      valueInputOption: 'RAW',
      requestBody: { values: [[key, value]] },
    });
  } else {
    // 更新現有列（+1 因為 Sheets 列號從1開始）
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Config!A${rowIndex + 1}:B${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[key, value]] },
    });
  }
}

// ── Options 快捷方法 ────────────────────────────────────────

export async function getOptions(): Promise<Options> {
  try {
    const raw = await getConfig('options');
    if (raw) return JSON.parse(raw) as Options;
  } catch {
    // JSON 損毀時回傳預設值
  }
  return DEFAULT_OPTIONS;
}

export async function saveOptions(options: Options | null): Promise<void> {
  if (options === null) {
    await setConfig('options', JSON.stringify(DEFAULT_OPTIONS));
  } else {
    await setConfig('options', JSON.stringify(options));
  }
}

// ── 密碼 ───────────────────────────────────────────────────

export async function getPasswordHash(): Promise<string | null> {
  return getConfig('adminPassword');
}

export async function setPasswordHash(hash: string): Promise<void> {
  await setConfig('adminPassword', hash);
}

// ── Reviews 分頁 ────────────────────────────────────────────

export async function getReviews(): Promise<ReviewRow[]> {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Reviews!A2:G',  // 跳過標題列
  });
  const rows = res.data.values ?? [];
  return rows.map((r) => ({
    reviewId: r[0] ?? '',
    reviewer: r[1] ?? '',
    rating: Number(r[2] ?? 0),
    text: r[3] ?? '',
    date: r[4] ?? '',
    replied: r[5] === 'TRUE',
    alertSent: r[6] === 'TRUE',
  }));
}

export async function appendReview(row: ReviewRow): Promise<void> {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Reviews!A:G',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        row.reviewId, row.reviewer, row.rating,
        row.text, row.date,
        row.replied ? 'TRUE' : 'FALSE',
        row.alertSent ? 'TRUE' : 'FALSE',
      ]],
    },
  });
}

export async function markReplied(reviewId: string): Promise<void> {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Reviews!A:G',
  });
  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex((r) => r[0] === reviewId);
  if (rowIndex === -1) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Reviews!F${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['TRUE']] },
  });
}

export async function markAlertSent(reviewId: string): Promise<void> {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Reviews!A:G',
  });
  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex((r) => r[0] === reviewId);
  if (rowIndex === -1) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Reviews!G${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['TRUE']] },
  });
}

// ── Usage 分頁（Gemini 用量記錄）─────────────────────────────

export type UsageKind = 'review' | 'reply' | 'weekly';
export type UsageResult = 'ai' | 'partial' | 'mock' | 'fail';

export interface UsageRow {
  time: string; // ISO 8601
  kind: UsageKind;
  model: string;
  result: UsageResult;
  apiCalls: number;
  inputTokens: number;
  outputTokens: number;
}

const USAGE_HEADER = ['time', 'kind', 'model', 'result', 'apiCalls', 'inputTokens', 'outputTokens'];

async function ensureUsageSheet(): Promise<void> {
  const sheets = await getSheets();
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Usage' } } }] },
    });
  } catch {
    // 已存在（並行請求同時建立）→ 忽略
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'Usage!A1:G1',
    valueInputOption: 'RAW',
    requestBody: { values: [USAGE_HEADER] },
  });
}

/** 記錄一次 Gemini 功能呼叫。失敗只寫 log，絕不影響主流程。 */
export async function logUsage(row: Omit<UsageRow, 'time'>): Promise<void> {
  const values = [[
    new Date().toISOString(), row.kind, row.model, row.result,
    row.apiCalls, row.inputTokens, row.outputTokens,
  ]];
  const append = async () => {
    const sheets = await getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Usage!A:G',
      valueInputOption: 'RAW',
      requestBody: { values },
    });
  };
  try {
    try {
      await append();
    } catch {
      // 第一次使用時 Usage 工作頁尚未建立 → 自動建立後重試
      await ensureUsageSheet();
      await append();
    }
  } catch (e) {
    console.error('logUsage failed:', e);
  }
}

export async function getUsage(): Promise<UsageRow[]> {
  const sheets = await getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Usage!A2:G',
    });
    return (res.data.values ?? []).map((r) => ({
      time: r[0] ?? '',
      kind: (r[1] ?? 'review') as UsageKind,
      model: r[2] ?? '',
      result: (r[3] ?? 'ai') as UsageResult,
      apiCalls: Number(r[4] ?? 0),
      inputTokens: Number(r[5] ?? 0),
      outputTokens: Number(r[6] ?? 0),
    }));
  } catch {
    return []; // 尚無 Usage 工作頁
  }
}
