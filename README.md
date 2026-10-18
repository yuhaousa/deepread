# 深读 DeepRead

AI 时代的深度阅读与判断力训练平台。面向初中到高中学生，每天一篇短文、15–25 分钟，用“预测 → 专注阅读 → 合书回忆 → 结构分析 → 表达迁移 → 反馈复习”六步闭环，练出抓得住重点、记得住、讲得清、能核查 AI 四件事。AI 只做导师：**给提示，不给答案**。

- 项目方案（PRD、能力量表、技术架构、排期）：见 Claude 项目文档《深读 DeepRead · 项目方案 v1.0》
- 原始 UI 原型：[`prototype/index.html`](prototype/index.html)（单文件，可直接用浏览器打开）

## 快速开始

运行在 Cloudflare Workers 上，数据库为 Cloudflare D1（SQLite）。本地开发不需要 Cloudflare 账号：wrangler 会在 `.wrangler/` 下模拟 D1。需要 Node 22+。

```bash
npm install
cp .dev.vars.example .dev.vars  # 本地机密：AUTH_SECRET、模型 Key
npm run db:migrate:local        # 在本地 D1 建表
npm run db:seed:local           # 21 篇分级材料 + 演示学校/班级/账号（会清空数据）
npm run dev                     # http://localhost:3000 （Next.js 开发服务器 + 本地 D1）
npm run preview                 # 可选：按线上方式构建，在 workerd 中运行 http://localhost:8787
```

演示账号（密码均为 `Bamboo123`）：

| 角色 | 账号 | 说明 |
| --- | --- | --- |
| 管理员 | `admin` | 管理后台 `/admin`：平台总览、用户管理、学情表现、班级；也可进入教师端 |
| 教师 | `teacher` | 王老师，初二（3）班：班级洞察、布置任务、每名学生的学习情况与训练记录 |
| 学生 | `student` 体验同学 | 已获监护人同意，没有历史记录，适合从头体验 |
| 学生 | `s2401` 林同学 | 有近四周训练记录、作品对比和到期复习 |
| 学生 | `s2402`–`s2407` | 部分已完成本周任务 |
| 学生 | `s2408` 吴同学 | 监护人尚未同意：可以训练，不能用 AI 导师对话 |

不配置模型 Key 也能完整使用：回忆按关键词评分，导师返回内置提示，摘要显示参考答案并等待教师抽检。

## 模型配置

`quick` 档（回忆判定、导师提示）和 `deep` 档（摘要与迁移量表）分别配置提供方与模型：提供方、模型名、区域写在 `wrangler.jsonc` 的 `vars`，API Key 写在 `.dev.vars`（本地）或用 `wrangler secret put`（线上）。

| 区域 `DEPLOY_REGION` | 允许的提供方 |
| --- | --- |
| `intl`（新加坡 / 东盟） | anthropic、openai、deepseek、qwen |
| `cn`（中国大陆） | deepseek、qwen（数据不出境） |

任何调用失败或超过 `LLM_TIMEOUT_MS` 都会降级到规则评分 / 内置提示，训练不中断。每次调用写入 `ai_calls` 表（只存哈希后的用户 ID），用于成本看板。`*_BASE_URL` 可指向企业网关或私有部署。

## 目录结构

```
src/
  app/                    页面（App Router）与 API 路由
    train/[id]/trainer.tsx   六步训练闭环（学生端核心）
    teacher/                 教师端：共性错误、分组建议、布置任务、学生学习情况表
    learner-table.tsx        学情表格与训练记录（教师端、管理后台共用）
    levels/                  阅读能力等级量表
    welcome/                 公开落地页（未登录访问首页时进入）
    admin/                   管理后台：总览、用户管理、学情表现与学生报告、班级
  content/passages.ts     种子材料（19 篇，含内容卡片、关键点、题目）
  content/passages-leveled.ts  分级扩充材料（L1–L6，按量表字数编写）
  db/schema.ts            数据模型（Drizzle ORM）
  lib/domain.ts           六项能力、六级量表、题型定义
  server/
    assessment/           测评引擎：规则评分、关键点匹配、AI 量表
    tutor/                AI 导师：角色提示词、护栏检测、对话服务
    learner/              学习者模型：能力折算、升级规则、复习调度、学情汇总（performance.ts）
    llm/router.ts         多模型路由（按区域 / 档位）
    training.ts           训练闭环服务
    reports.ts            学生报告、班级洞察
    admin/                管理后台：统计纯函数（metrics）、查询、用户与班级管理、请求体校验
drizzle/                  D1（SQLite）迁移，由 wrangler d1 migrations apply 执行
scripts/seed.ts           在内存 SQLite 生成演示数据，导出 .wrangler/seed.sql
wrangler.jsonc            Workers 与 D1 / R2 绑定、非机密配置
tests/                    单元测试（vitest）
```

## 设计要点

- **浏览器拿不到答案。** `toClient()` 发给浏览器的材料不含答案、关键点和参考摘要；排序题的环节会打乱。答案与解析只在提交后由服务器返回。
- **导师护栏三层。** 角色提示词约束；输出后用规则检测复述原文、说出关键点、直接给答案（`tutor/guardrail.ts`），命中即替换为按步骤准备的安全提示，并记录在 `tutor_messages.guardrail`；每节课最多 20 轮对话。红队用例见 `tests/guardrail.test.ts`。
- **回忆评分取并集。** 关键词匹配作为离线基线，AI 语义判定作为补充，两者取并集；AI 反馈本身也要过护栏。
- **量表低置信度进抽检。** AI 量表 `confidence < 0.6` 的作答标记 `flagged`，进入教师抽检。
- **等级规则**（`learner/levels.ts`）：在本级或更高等级材料上连续 4 次达标率 ≥ 70%，且最近一次 7 天复习没有失败，即升一级；本级连续 3 次 < 40% 推送补练，不显示降级。
- **内容库可直接阅读。** 每篇材料都能点开阅读原文；学生端不含答案与关键点。每日训练节数上限只限制开始新训练，不限制阅读和继续进行中的训练；演示时可在 `wrangler.jsonc` 的 `vars` 中调大 `DAILY_SESSION_LIMIT`。
- **合规。** 监护人未同意时不能使用 AI 对话；`DELETE /api/me/data` 一键删除作答原文与对话；每日训练节数上限（`DAILY_SESSION_LIMIT`）；所有 AI 输出标注“AI 导师”。

## API 一览

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/auth/login` · `/api/auth/logout` | 登录 / 退出 |
| GET | `/api/passages` | 内容库（`?genre=&grade=`） |
| 页面 | `/library/:id` | 阅读原文；教师 / 管理员另见内容卡片、关键点、答案与参考摘要 |
| POST | `/api/sessions` | 开始训练（同一篇未完成则继续） |
| GET / PATCH | `/api/sessions/:id` | 读取去答案材料；推进步骤、上报用时、标记、预测 |
| POST | `/api/sessions/:id/recall` | 合书回忆 → 关键点覆盖 + 回忆教练反馈 |
| POST | `/api/sessions/:id/analysis` | 结构分析 / 核查 / 排序 / 定位题 → 规则评分 |
| POST | `/api/sessions/:id/summary` | 摘要与迁移 → 量表评分 |
| POST | `/api/sessions/:id/complete` | 结算今日反馈、安排复习、更新等级（幂等） |
| POST | `/api/tutor` | 导师对话 |
| GET / POST | `/api/reviews/due` · `/api/reviews/:id` | 到期复习 / 作答 |
| GET | `/api/reports/student/:id` | 学生能力报告（本人或任课教师） |
| GET | `/api/classrooms/:id/insights` | 班级洞察（`?assignmentId=`） |
| POST | `/api/assignments` | 布置任务 |
| DELETE | `/api/me/data` | 删除我的作答数据 |
| GET / POST | `/api/admin/users` | 用户列表（`?q=&role=&classroomId=`）/ 新建用户（管理员） |
| PATCH / DELETE | `/api/admin/users/:id` | 修改姓名、角色、班级、监护人同意、重置密码 / 删除用户 |
| GET / POST | `/api/admin/classrooms` · PATCH `/api/admin/classrooms/:id` | 班级概况 / 新建班级 / 更换任课教师 |
| GET | `/api/admin/learners` · `/api/admin/learners/export` | 学情表现（JSON）/ 导出 CSV |

## 管理后台

管理员登录后进入 `/admin`（其他角色访问会被重定向回各自首页，API 返回 403）。

- **平台总览**：学生与活跃度、近 7 天完成训练与完成率、需要关注与待抽检人数；近 14 天每日完成训练、六项能力近 28 天平均达标率、能力等级分布（均附数据表视图）；完成最多的材料；AI 调用次数、失败率、延迟、Token 与导师护栏改写次数。
- **用户管理**：按账号 / 姓名搜索，按角色、班级筛选；新建用户；修改姓名、角色、班级、年级、监护人同意，重置密码；删除用户（学生的训练数据级联删除）。护栏：不能删除或降级自己、至少保留一名管理员、仍有任教班级的教师不能删除或改角色、账号重复返回 409。
- **学情表现**：每名学生的已完成 / 进行中训练、最近训练、平均回忆覆盖 / 结构分析 / 摘要量表、六项能力等级、待复习数与预警（回忆连续偏低、14 天未训练、未开始、监护人未同意）；可排序、筛选、导出 CSV（带 BOM，防公式注入）。点击姓名查看完整学生报告与训练记录。
- **班级**：班级、任课教师、学生数、任务数；新建班级、更换任课教师，并可直接打开该班的教师端洞察。

注意：会话令牌 7 天有效，修改角色或删除账号后，对方已登录的会话要到令牌过期或重新登录才会更新。

## 开发命令

```bash
npm run typecheck    # TypeScript
npm test             # 单元测试：内容完整性（含分级覆盖与篇幅）、评分、护栏红队、等级、调度、路由、班级洞察、管理后台统计
npm run preview      # OpenNext 构建并在 workerd 中运行（与线上一致）
npm run db:generate  # 修改 src/db/schema.ts 后生成迁移，再 npm run db:migrate:local
npm run cf-typegen   # 修改 wrangler.jsonc 后重新生成 cloudflare-env.d.ts
```

## 部署到 Cloudflare

一次性准备（需要 Cloudflare 账号，`npx wrangler login`）：

```bash
npx wrangler d1 create deepread          # 把返回的 database_id 填进 wrangler.jsonc
npx wrangler secret put AUTH_SECRET      # 至少 32 字符随机串；模型 Key 同样用 secret put
npm run db:migrate:remote                # 在线上 D1 建表
npm run db:seed:remote                   # 可选：写入演示数据（会清空线上数据）
npm run deploy                           # 构建并部署，输出 *.workers.dev 地址
```

之后每次发布只需 `npm run db:migrate:remote && npm run deploy`。也可以交给 GitHub Actions：在仓库设置中添加变量 `CF_DEPLOY=true`、机密 `CLOUDFLARE_API_TOKEN`（含 Workers 与 D1 编辑权限）和 `CLOUDFLARE_ACCOUNT_ID`，推送到 `main` 即自动迁移并部署。

- **R2（可选）**：目前没有文件存储需求。需要存放导出、上传材料或备份时，`npx wrangler r2 bucket create deepread-files`，并取消 `wrangler.jsonc` 中 `r2_buckets` 的注释。
- **D1 的取舍**：D1 不支持交互式事务，多步写入用 `db.batch()`（整体原子执行）；单条语句最多 100 个绑定参数，关联查询用子查询而不是长 ID 列表。
- **密码**：使用 Web Crypto PBKDF2（10 万次迭代），适合 Workers 的 CPU 限制。
- **中国大陆**：D1 无法部署在中国大陆。`DEPLOY_REGION=cn`（数据不出境）的场景需要境内数据库与托管，不适合本方案。
- **Next.js 16 的 proxy.ts**：OpenNext 构建时会提示“Node.js middleware 在 Cloudflare 上为实验性支持”。本项目的页面访问控制已在 workerd 中验证；如遇问题，可改回 `middleware.ts`（Edge 运行时）。

## 已知差距（进入试点前要补）

- 第 8 节的 6 篇示例材料为 224–322 字，短于量表中 L2–L4 的篇幅要求；分级扩充的 10 篇已按量表篇幅编写（测试校验）。正式内容仍需走审核流。
- 尚未实现：内容后台（制卡出题、审核发布）、入学定级测、家长周报推送、教师抽检改分界面、导师流式输出。
- 复习提醒的推送（Cloudflare Queues / Cron Triggers）尚未接入，目前复习在首页与复习页展示。

## 分级内容一览

| 等级 | 材料（主训练能力） |
| --- | --- |
| L1 起步 | 向日葵真的一直跟着太阳转吗（专注）· 企鹅爸爸怎样孵蛋（回忆） |
| L2 基础 | 蜜蜂怎样告诉同伴花在哪里（专注）· 课间十分钟，走出教室吧（分析）· 图书角一学期的借阅统计（核查）· 一张旧报纸的“第二次生命”（表达） |
| L3 发展 | 城市为什么会“发烧”（理解）· 午睡能让记忆更好吗（核查）· 秋天的叶子为什么会变色（回忆）· 一条河为什么越来越弯（理解）· 我们学校的剩饭调查（核查）· 多吃鱼会让人变聪明吗（分析） |
| L4 熟练 | 刷短视频会让人变笨吗（分析）· 考前熬夜复习，值得吗（分析）· 共享单车的“潮汐”（表达）· 莫高窟的“慢”保护（回忆）· 一份关于中学生近视的调查（核查） |
| L5 精通 | 校园该不该全面禁止手机——两种观点（分析 · 双文本）· “喝咖啡能长寿”？三条信息的比较（核查 · 多源） |
| L6 研究 | 双文本论证的进阶分析 · 多源健康信息的证据边界（沿用材料并增加进阶任务） |
