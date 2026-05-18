# Waline on Worker 詳細文件

## 快速開始

### 前提條件

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/)
- [Cloudflare 賬號](https://dash.cloudflare.com/)
- 已安裝並登入 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### 一鍵部署

```bash
# 克隆倉庫
git clone https://github.com/wuyilingwei/Waline_On_Worker.git
cd Waline_On_Worker

# 執行部署指令碼
# Linux / macOS
chmod +x deploy.sh
./deploy.sh

# Windows (PowerShell)
.\deploy.ps1
```

### 手動部署

```bash
# 1. 安裝依賴
pnpm install

# 2. 建立 D1 資料庫
npx wrangler d1 create waline-db

# 3. 編輯 wrangler.toml，填入上一步返回的 database_id

# 4. 初始化資料庫 Schema
pnpm run db:init

# 5. 設定 JWT 金鑰
npx wrangler secret put JWT_SECRET
# 輸入一個隨機字串作為金鑰

# 6. 部署
pnpm run deploy
```

### 本地開發

```bash
# 初始化本地資料庫
pnpm run db:init:local

# 啟動開發伺服器
pnpm run dev
```

## API 端點

### 評論

| 方法 | 路徑 | 說明 | 鑑權 |
|------|------|------|------|
| `GET` | `/api/comment?path=` | 獲取評論列表（執行緒化） | - |
| `GET` | `/api/comment?type=recent` | 最近評論 | - |
| `GET` | `/api/comment?type=count&url=` | 評論計數 | - |
| `GET` | `/api/comment?type=list` | 管理員評論列表 | Admin |
| `GET` | `/api/comment/rss` | RSS 訂閱源 | - |
| `POST` | `/api/comment` | 建立評論 | - |
| `PUT` | `/api/comment/:id` | 更新/點贊評論 | Admin/Like |
| `DELETE` | `/api/comment/:id` | 刪除評論（級聯） | Admin |

### 文章

| 方法 | 路徑 | 說明 | 鑑權 |
|------|------|------|------|
| `GET` | `/api/article?url=` | 獲取瀏覽量 | - |
| `POST` | `/api/article` | 增加瀏覽量/反應 | - |

### 使用者

| 方法 | 路徑 | 說明 | 鑑權 |
|------|------|------|------|
| `POST` | `/api/user` | 註冊使用者 | - |
| `GET` | `/api/user` | 使用者列表 | -/Admin |
| `PUT` | `/api/user/:id` | 更新使用者 | Self/Admin |
| `DELETE` | `/api/user/:id` | 刪除/封停用戶 | Admin |

### 認證

| 方法 | 路徑 | 說明 | 鑑權 |
|------|------|------|------|
| `POST` | `/api/token` | 登入 | - |
| `GET` | `/api/token` | 獲取當前使用者資訊 | Bearer |
| `DELETE` | `/api/token` | 登出 | - |
| `POST` | `/api/token/2fa` | 兩步驗證 | Bearer |

### OAuth

| 方法 | 路徑 | 說明 | 鑑權 |
|------|------|------|------|
| `GET` | `/api/oauth?type=<provider>` | 發起 OAuth 登入 | - |

支援的 OAuth 提供方（`type` 引數值）：`github`、`twitter`、`facebook`、`weibo`、`qq`

OAuth 流程透過外部 OAuth 代理服務（預設 `https://oauth.lithub.cc`）實現，可透過環境變數 `OAUTH_URL` 自定義。

### 資料管理

| 方法 | 路徑 | 說明 | 鑑權 |
|------|------|------|------|
| `GET` | `/api/db` | 匯出所有資料 (Waline JSON 格式) | Admin |
| `POST` | `/api/db?table=` | 匯入單條資料 | Admin |
| `PUT` | `/api/db?table=&objectId=` | 更新已匯入資料 | Admin |
| `DELETE` | `/api/db?table=` | 清空指定表 | Admin |

### 設定

| 方法 | 路徑 | 說明 | 鑑權 |
|------|------|------|------|
| `GET` | `/api/settings` | 獲取設定 | Admin |
| `PUT` | `/api/settings` | 更新設定 | Admin |

### 管理面板

| 路徑 | 說明 |
|------|------|
| `/ui` | @waline/admin 管理面板 |
| `/ui/worker-setting` | Worker 自定義設定頁 |

> 首位註冊的使用者自動成為管理員。

## 資料匯入匯出

本專案實現了與 `@waline/admin` 管理面板完全相容的 `/api/db` 端點，支援標準 Waline JSON 格式的資料匯入匯出。

### 使用管理面板匯入匯出

1. 訪問管理面板 `/ui` 並登入管理員賬戶
2. 進入 **匯入匯出** 頁面
3. **匯出**：點選匯出按鈕，下載 `waline.json` 檔案
4. **匯入**：選擇之前匯出的 `waline.json` 檔案，點選匯入

### 使用 Wrangler CLI 直接匯入

對於大量資料，推薦使用 Wrangler 直接操作 D1 資料庫：

```bash
# 匯出為 SQL
npx wrangler d1 export <database-name> --remote --output=backup.sql

# 從 SQL 匯入
npx wrangler d1 execute <database-name> --remote --file=backup.sql
```

> [!WARNING]
> **大量資料匯入的已知限制**
>
> 透過管理面板匯入大量資料時（數百條以上），可能會因 Cloudflare Workers 的請求超時或 D1 的併發限制導致 **500 錯誤**。建議：
>
> 1. **分片匯入**：將匯出的 JSON 資料手動拆分為每片約 **500 條記錄**，分批匯入
> 2. **使用 Wrangler CLI**：對於大規模資料遷移，直接使用 `wrangler d1 execute --file` 匯入 SQL 檔案更為可靠
> 3. **使用遷移指令碼**：參考 `migrate.ts` / `migrate-d1.ts` 進行程式化遷移

## 配置

### 環境變數 (wrangler.toml `[vars]`)

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `SITE_NAME` | 站點名稱 | `Waline` |
| `SITE_URL` | 站點 URL | - |
| `SECURE_DOMAINS` | 允許的域名（逗號分隔） | - |

### Secrets (透過 `wrangler secret put` 設定)

| Secret | 說明 | 必需 |
|--------|------|------|
| `JWT_SECRET` | JWT 簽名金鑰 | ✅ |

### Worker 設定 (透過管理面板 `/ui/worker-setting` 配置)

| 設定 | 說明 | 預設值 |
|------|------|--------|
| `waline_client_version` | @waline/client CDN 版本號 | - |
| `comment_default_status` | 匿名評論預設狀態 (approved/waiting/spam) | `approved` |
| `user_comment_default_status` | 登入使用者評論預設狀態 | `approved` |
| `worker_display` | 管理面板顯示 Worker 擴充套件選單 | - |
| `llm_mode` | LLM 審查模式 (off/anonymous/all) | `off` |
| `llm_skip_admin` | 管理員評論跳過 LLM 審查 | - |
| `llm_endpoint` | LLM API 端點 URL | - |
| `llm_api_key` | LLM API 金鑰 | - |
| `llm_model` | LLM 模型名稱 | - |
| `llm_prompt` | LLM 審查提示詞 | - |

### OAuth 配置

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `OAUTH_URL` | OAuth 代理服務地址 | `https://oauth.lithub.cc` |

OAuth 登入透過外部代理服務處理 Client ID/Secret，無需在 Worker 中配置各平臺金鑰。支援 GitHub、Twitter、Facebook、Weibo、QQ 五個平臺。

## 前端對接

在你的網站中使用 `@waline/client`：

```html
<script src="https://unpkg.com/@waline/client@v3/dist/waline.js"></script>
<link rel="stylesheet" href="https://unpkg.com/@waline/client@v3/dist/waline.css" />
<div id="waline"></div>
<script>
  Waline.init({
    el: '#waline',
    serverURL: 'https://your-worker-name.your-subdomain.workers.dev',
  });
</script>
```

## 專案結構

```
├── src/
│   ├── index.ts               # Workers 入口 (Hono + CORS + auth + version)
│   ├── env.ts                 # 型別定義
│   ├── router/
│   │   ├── comment.ts         # 評論 CRUD + LLM 審查
│   │   ├── article.ts         # 瀏覽量/反應計數器
│   │   ├── user.ts            # 使用者管理
│   │   ├── token.ts           # JWT 登入 + 2FA
│   │   ├── oauth.ts           # OAuth 登入 (GitHub/Twitter/Facebook/Google/Weibo/QQ)
│   │   ├── settings.ts        # Worker 設定管理 (API Key 脫敏返回)
│   │   └── db.ts              # 資料匯入匯出
│   ├── middleware/
│   │   └── auth.ts            # JWT 鑑權中介軟體
│   ├── ui/
│   │   ├── admin-panel.ts     # @waline/admin 管理面板
│   │   ├── custom-admin.ts    # Worker 自定義設定頁
│   │   └── waline-page.ts     # Waline 評論頁
│   └── utils/
│       ├── password.ts        # PBKDF2 密碼雜湊
│       ├── avatar.ts          # Gravatar 頭像
│       ├── ua.ts              # UA 解析
│       ├── markdown.ts        # Markdown 渲染
│       ├── llm-review.ts      # LLM 評論審查
│       └── totp.ts            # TOTP 兩步驗證
├── schema.sql                 # D1 資料庫 Schema
├── migrate.ts                 # LeanCloud 資料遷移
├── migrate-d1.ts              # D1 間資料遷移
├── wrangler.toml              # Workers 配置
└── deploy.sh / deploy.ps1     # 部署指令碼
```
