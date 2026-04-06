# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # 本機開發伺服器
npm run build    # 正式建置（部署前確認無 TypeScript 錯誤）
npx tsc --noEmit # 型別檢查
```

手動觸發 Cron（需替換 CRON_SECRET）：
```bash
curl -X GET "https://daishi-nextjs.vercel.app/api/cron/monitor" \
  -H "Authorization: Bearer <CRON_SECRET>"

curl -X GET "https://daishi-nextjs.vercel.app/api/cron/weekly" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

試算表工作頁初始化：
```bash
node scripts/setup-sheets.mjs
```

## Architecture

**大師修顧客評論小助手** — 幫助店員引導顧客快速撰寫 Google Maps 評論，並自動監控低分評論。

### 資料流

```
Google Sheets（主資料庫）
  ├── Config 工作頁：key/value 設定（adminPassword、lastScanTime、options JSON）
  └── Reviews 工作頁：評論記錄（reviewId, reviewer, rating, text, date, replied, alertSent）

Google Places API / Business Profile API
  └── Cron 抓取 → 寫入 Reviews 工作頁 → 低分觸發 Email + Gemini 草稿
```

### 前後台

- **前台** `/`：顧客填表（服務、品牌、滿意點、語氣）→ 呼叫 Gemini 生成 3 則評論草稿 → 複製後跳轉引導彈窗
- **後台** `/admin`：JWT Cookie 驗證（middleware 保護）→ 選項管理、評論記錄、QR Code、密碼設定

### 關鍵模組

| 檔案 | 職責 |
|------|------|
| `src/lib/sheets.ts` | 所有 Google Sheets 讀寫（Config、Reviews、Options、密碼） |
| `src/lib/gemini.ts` | 三種 Gemini 呼叫：評論生成、負評回覆草稿、週報摘要 |
| `src/lib/notify.ts` | nodemailer Gmail SMTP，低分示警信與週報 |
| `src/lib/auth.ts` | bcrypt 密碼雜湊 + jose JWT 簽發/驗證 |
| `src/middleware.ts` | 保護 `/admin` 路由，未登入重導至 `/admin/login` |
| `src/app/api/cron/monitor/route.ts` | 評論監控：自動選擇 Business Profile API 或 Places API |
| `src/app/api/cron/weekly/route.ts` | 週報：過濾近 7 天評論，Gemini 摘要，寄送報告 |

### 評論監控來源切換邏輯

`/api/cron/monitor` 自動判斷：
1. 有 `GOOGLE_BUSINESS_ACCOUNT_ID` + `GOOGLE_BUSINESS_LOCATION_ID` → Business Profile API（全部評論，需白名單申請）
2. 有 `GOOGLE_MAPS_API_KEY` + `GOOGLE_PLACE_ID` → Places API（最新 5 則，免申請）

### 日期格式

評論日期一律存為 **ISO 8601 字串**（`new Date().toISOString()`）存入 Sheets，顯示時才用 `toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })` 格式化。週報過濾邏輯依賴此格式，改成其他格式會導致 `weekCount: 0`。

### Cron 排程（vercel.json）

| 路徑 | UTC 排程 | 台灣時間 |
|------|---------|---------|
| `/api/cron/monitor` | `0 1 * * *` | 每天 09:00 |
| `/api/cron/weekly` | `0 1 * * 1` | 每週一 09:00 |

Vercel 免費方案每天限 2 次 Cron，不建議改為更高頻率。

### CSS 設計系統

`globals.css` 定義全域 CSS 變數（`--bg-color`, `--accent`, `--muted` 等）和兩個共用 class：
- `.glass-card`：毛玻璃卡片容器
- `.option-pill`：選項標籤按鈕

新增元件應優先使用這些 class 和 CSS 變數，保持視覺一致性。
