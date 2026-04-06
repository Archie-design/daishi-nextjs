import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 讀取 .env.local
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const SHEET_ID = env.GOOGLE_SHEETS_ID;
const EMAIL = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const KEY = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!SHEET_ID || !EMAIL || !KEY) {
  console.error('❌ .env.local 缺少必要欄位');
  process.exit(1);
}

const auth = new google.auth.JWT({ email: EMAIL, key: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });

async function getExistingSheets() {
  const res = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  return res.data.sheets.map(s => ({ title: s.properties.title, id: s.properties.sheetId }));
}

async function setup() {
  console.log('🔌 連接試算表...');
  const existing = await getExistingSheets();
  const existingTitles = existing.map(s => s.title);
  console.log('📋 現有工作頁：', existingTitles.join(', ') || '（空）');

  const requests = [];

  // 建立 Config 工作頁（若不存在）
  if (!existingTitles.includes('Config')) {
    requests.push({ addSheet: { properties: { title: 'Config' } } });
    console.log('➕ 準備新增 Config 工作頁');
  }

  // 建立 Reviews 工作頁（若不存在）
  if (!existingTitles.includes('Reviews')) {
    requests.push({ addSheet: { properties: { title: 'Reviews' } } });
    console.log('➕ 準備新增 Reviews 工作頁');
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests } });
    console.log('✅ 工作頁建立完成');
  } else {
    console.log('ℹ️  工作頁已存在，跳過建立');
  }

  // 寫入 Config 標題列
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'Config!A1:B1',
    valueInputOption: 'RAW',
    requestBody: { values: [['key', 'value']] },
  });

  // 寫入 Config 初始資料（僅寫入 key，value 留空）
  const configRes = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Config!A:A' });
  const configKeys = (configRes.data.values ?? []).flat();
  const keysToAdd = ['adminPassword', 'lastScanTime', 'options'].filter(k => !configKeys.includes(k));
  if (keysToAdd.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Config!A:B',
      valueInputOption: 'RAW',
      requestBody: { values: keysToAdd.map(k => [k, '']) },
    });
    console.log('✅ Config 初始資料寫入：', keysToAdd.join(', '));
  }

  // 寫入 Reviews 標題列
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'Reviews!A1:G1',
    valueInputOption: 'RAW',
    requestBody: { values: [['reviewId', 'reviewer', 'rating', 'text', 'date', 'replied', 'alertSent']] },
  });
  console.log('✅ Reviews 標題列寫入完成');

  console.log('\n🎉 試算表設定完成！');
  console.log(`📊 https://docs.google.com/spreadsheets/d/${SHEET_ID}`);
}

setup().catch(err => {
  console.error('❌ 錯誤：', err.message);
  process.exit(1);
});
