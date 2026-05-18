<!-- markdownlint-disable MD033 MD041 -->

# Waline on Worker

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

一個運行在 **Cloudflare Workers** 上的 [Waline](https://waline.js.org/) 評論系統後端實現，使用 **D1 (SQLite)** 作為資料儲存。實現了 Waline 的絕大多數功能。

---

## 文件

[詳細文件](docs/README.md)

## 特性

- 快速
- 安全
- Markdown 語法支援
- 輕量易用
- 免費部署
- 完全相容 `@waline/client` 前端和 `@waline/admin` 管理面板

|                    | Waline on Worker                                                       |
| ------------------ | ---------------------------------------------------------------------- |
| **執行時**         | [Cloudflare Workers](https://workers.cloudflare.com/)                  |
| **資料庫**         | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)       |
| **框架**           | [Hono](https://hono.dev/)                                             |
| **語言**           | TypeScript                                                             |

> [!CAUTION]
> **AI 輔助開發聲明**
>
> 本專案的程式碼實現主要由 AI 主導完成。儘管已經盡可能地進行了人工程式碼審查和測試，但**無法保證**與原版 Waline Server 的所有行為完全一致。
>
> 已經盡可能做了鑑權和邊界情況測試，**請在生產環境使用前自行評估風險。** 歡迎提交 Issue 和 Pull Request 來幫助改進。

## 功能狀態

- [x] 評論 CRUD（執行緒化、計數、最近評論）
- [x] 文章瀏覽量統計
- [x] 評論反應（讚踩）
- [x] 置頂評論
- [x] 使用者註冊 / 登入
- [x] 評論管理（審核、刪除）
- [x] 社交登入
- [x] 兩步驗證 (2FA / TOTP)
- [x] Markdown 渲染 + XSS 防護
- [x] Gravatar 頭像
- [x] UA 解析（瀏覽器 / 作業系統）
- [x] RSS 訂閱
- [x] 資料匯入匯出（相容 @waline/admin 遷移面板）
- [x] LLM 評論審查（內嵌 [waline-plugin-llm-reviewer-next](https://github.com/wuyilingwei/waline-plugin-llm-reviewer-next) 設計，支援自然語言安全策略）
- [x] 評論預設狀態控制（匿名 / 登入使用者獨立設定）
- [x] 管理面板（@waline/admin CDN + Worker 設定頁）
- [x] IP 頻率限制 (IPQPS) 可直接配置Cloudflare安全規則實現
- [x] 附加管理面板，能夠設定前端預設版本，控制評論預設狀態，配置LLM審查策略等功能
- [ ] Oauth lithub登入
- [ ] 郵件通知（SMTP）
- [ ] Webhook 通知

> [!NOTE]
> Akismet 反垃圾評論功能透過內建的 LLM 評論審查變通實現——接入任意相容 OpenAI 格式的 LLM API，以自然語言設定審查策略，即可對評論進行智慧審核。

## 快速開始

```bash
git clone https://github.com/wuyilingwei/Waline_On_Worker.git
cd Waline_On_Worker
pnpm install

# 建立 D1 資料庫並編輯 wrangler.toml
npx wrangler d1 create waline-db
pnpm run db:init
npx wrangler secret put JWT_SECRET
pnpm run deploy
```

詳細部署步驟和配置說明請參閱[文件](docs/README.md)。

## 許可證

[GPL-3.0](LICENSE)
