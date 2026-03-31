<!-- markdownlint-disable MD033 MD041 -->

# Waline on Worker

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

一个运行在 **Cloudflare Workers** 上的 [Waline](https://waline.js.org/) 评论系统后端实现，使用 **D1 (SQLite)** 作为数据存储。实现了 Waline 的绝大多数功能。

---

## 文档

[详细文档](docs/README.md)

## 特性

- 快速
- 安全
- Markdown 语法支持
- 轻量易用
- 免费部署
- 完全兼容 `@waline/client` 前端和 `@waline/admin` 管理面板

|                    | Waline on Worker                                                       |
| ------------------ | ---------------------------------------------------------------------- |
| **运行时**         | [Cloudflare Workers](https://workers.cloudflare.com/)                  |
| **数据库**         | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)       |
| **框架**           | [Hono](https://hono.dev/)                                             |
| **语言**           | TypeScript                                                             |

> [!CAUTION]
> **AI 辅助开发声明**
>
> 本项目的代码实现主要由 AI 主导完成。尽管已经尽可能地进行了人工代码审查和测试，但**无法保证**与原版 Waline Server 的所有行为完全一致。
>
> **请在生产环境使用前自行评估风险。** 欢迎提交 Issue 和 Pull Request 来帮助改进。

## 功能状态

- [x] 评论 CRUD（线程化、计数、最近评论）
- [x] 文章浏览量统计
- [x] 评论反应（赞踩）
- [x] 置顶评论
- [x] 用户注册 / 登录
- [x] 评论管理（审核、删除）
- [x] 社交登录
- [x] 两步验证 (2FA / TOTP)
- [x] Markdown 渲染 + XSS 防护
- [x] Gravatar 头像
- [x] UA 解析（浏览器 / 操作系统）
- [x] RSS 订阅
- [x] 数据导入导出（兼容 @waline/admin 迁移面板）
- [x] LLM 评论审查（内嵌 [waline-plugin-llm-reviewer-next](https://github.com/wuyilingwei/waline-plugin-llm-reviewer-next) 设计，支持自然语言安全策略）
- [x] 评论默认状态控制（匿名 / 登录用户独立设置）
- [x] 管理面板（@waline/admin CDN + Worker 设置页）
- [x] IP 频率限制 (IPQPS) 可直接配置Cloudflare安全规则实现
- [x] 附加管理面板，能够设置前端默认版本，控制评论默认状态，配置LLM审查策略等功能
- [ ] Oauth lithub登录
- [ ] 邮件通知（SMTP）
- [ ] Webhook 通知

> [!NOTE]
> Akismet 反垃圾评论功能通过内置的 LLM 评论审查变通实现——接入任意兼容 OpenAI 格式的 LLM API，以自然语言设置审查策略，即可对评论进行智能审核。

## 快速开始

```bash
git clone https://github.com/wuyilingwei/Waline_On_Worker.git
cd Waline_On_Worker
pnpm install

# 创建 D1 数据库并编辑 wrangler.toml
npx wrangler d1 create waline-db
pnpm run db:init
npx wrangler secret put JWT_SECRET
pnpm run deploy
```

详细部署步骤和配置说明请参阅[文档](docs/README.md)。

## 许可证

[GPL-3.0](LICENSE)
