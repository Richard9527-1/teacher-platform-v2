# 语文智备Pro

高中语文备课平台（纯原生 HTML/CSS/JS，无框架、无构建），新增 **手写试卷 OCR 识别** 功能。

---

## 功能：作文批改（含手写识别）

手写识别已**并入「✍️ 作文批改」模块**，形成一条完整工作流：

```
📷 手写录入            🤖 智能批改 / ✏️ 主观批改
拍照上传 → 识别校对  →  ✍️ 送去批改  →  出分 + 评语
```

侧边栏「✍️ 作文批改」下有三个 Tab：

| Tab | 作用 |
|---|---|
| **📷 手写录入** | 批量上传手写作文照片，识别为可编辑文字（默认进入） |
| **🤖 自动初评** | 依据字数等简单规则生成初评参考（**非 AI 精批**，正式评分请用主观批改或人工） |
| **✏️ 主观批改** | 勾选优缺点标签自动算分（基础分 42 / 满分 60）+ 生成评语 |

**数据流转**：识别完成后点绿色 **✍️ 送去批改**（或单篇卡片上的 **✍️ 批改本篇**），
文字会自动带入批改 Tab；在批改页编辑过的正文，切换 Tab 也不会丢失。

> 旧的独立「手写识别」菜单已移除，但路由 `ocr` 仍保留兼容，会自动跳到作文批改的手写录入 Tab。

### 识别能力

- 支持 **点击选择 / 拖拽**，一次可选多张
- 逐张显示进度与状态（队列 / 识别中 / 完成 / 失败）
- **分栏版面还原**（见下）—— 作文格子纸的关键
- 结果可直接编辑校对
- 支持 **复制单条 / 复制全部 / 导出 TXT / 导出 MD**
- 上传前自动压缩（长边 ≤ 2200px），省流量也避开接口体积限制

### 分栏版面还原（作文格子纸必看）

高中作文纸是 **三栏格子**，正确读法是「左栏从上读到底 → 中栏 → 右栏」。
但 OCR 引擎按 **物理行** 返回，一行会横跨三栏，直接拼接会得到：

```
左栏第1行 + 中栏第1行 + 右栏第1行
左栏第2行 + 中栏第2行 + 右栏第2行
...
```

读起来完全不通。本模块提供**两种**解决方式：

#### 方式一：分栏切图（默认，作文纸推荐，最可靠）

上传后**先在浏览器里把整张图按栏竖切成 N 条**，逐条送去识别，再按左→右拼接。
每一条内部就是普通的单栏文本，阅读顺序**必定正确**，完全不依赖 OCR 返回的坐标。

切分位置用 canvas 对图片做**列向暗像素投影**自动求出：先检测「实际书写内容」的左右
边界（排除白页边 / 页眉页脚），再在内容范围内做**等份**得到分栏线——标准多栏格子栏宽
相等，分栏线恰在等份点。对带白边的答题纸不再把第二条线推到 2/3 处切进第 3 栏。

- 代价：一张图消耗 **N 次**识别额度（三栏 = 3 次）
- 识别前可点 **✂ 预览切分线** 确认红色虚线是否落在留白处，避免白白消耗额度

#### 方式二：整图智能重排（省额度）

只调 1 次接口，靠单字坐标反推分栏：

1. 后端向腾讯云请求 **单字四点坐标**（`EnableWordPolygon`）
2. 前端把所有单字投影到 X 轴做覆盖直方图，**栏与栏之间的零覆盖带**即为分栏线
3. 按坐标把横跨多栏的行拆成片段，重新归栏
4. 按「栏（左→右）→ 行（上→下）」重排

省额度，但栏间留白不明显、或腾讯云未返回可用单字坐标时可能失效。

> ⚠️ 已知限制：腾讯云 `WordPolygon` 的长度**不保证**等于 `DetectedText` 的字符数
> （官方示例里 8 个字只返回 1 个 polygon）。长度不一致时代码会**主动放弃**单字坐标，
> 以免字与坐标错配产生乱码——此时请改用「分栏切图」。

#### 页面上的 📐 版面还原 设置

| 选项 | 说明 |
|---|---|
| 识别方式 | `分栏切图`（默认，最准）/ `整图智能重排`（省额度） |
| 栏数 | `自动检测` / 1 / 2 / 3 / 4。**作文格子纸请选 3 栏**（切图模式下 `自动检测` 按 3 栏处理） |
| 输出 | `连排成文`（作文推荐，按首行缩进自动分段）/ `保留每行换行`（适合填空题、名单） |
| 🔄 重新排版 | 仅对「整图智能重排」有效，基于已缓存坐标重算，**不消耗额度** |
| ✂ 预览切分线 | 用列表中第一张图预览切分位置，**不消耗额度** |

每条结果右上角会显示徽标：`✂ 切图识别 N 栏` 或 `📐 N 栏版面`，可据此判断是否正确；
点 `👁 看原始行` 可对比 OCR 未重排前的原始输出。

识别引擎：**腾讯云「通用手写体识别」**，通过服务端函数 `api/ocr.js` 代理调用，
**密钥只存在于服务端环境变量，前端源码里没有任何密钥**。

---

## 部署步骤

本项目前端是**纯静态**的，两种分享方式任选：

- **GitHub Pages（纯静态，推荐快速分享）**：免费简单，但**不含 OCR 后端**，线上手写识别默认不可用（可另配，见下）。
- **Vercel / Cloudflare Pages（带 OCR 后端）**：OCR 手写识别可线上直接用，需配腾讯云密钥。

> 📌 数据说明：无论哪种方式，备课 / 班级 / 成绩 / 试卷等都存在**访客自己的浏览器 localStorage**，
> 每位使用者**各自独立、互不共享**；换设备或清缓存数据会丢失。这是单机分发工具，非多人在线协作平台。

### 方式一：GitHub Pages（纯静态，推荐）

1. 把项目推到 GitHub（仓库名不要带空格）：
   ```bash
   git init
   git add .
   git commit -m "feat: 语文智备Pro"
   git branch -M main
   git remote add origin https://github.com/你的用户名/teacher-platform.git
   git push -u origin main
   ```
2. 仓库 **Settings → Pages → Build and deployment**，Source 选 **Deploy from a branch**，
   Branch 选 `main`、目录选 `/ (root)`，保存。
3. 几分钟后得到网址 `https://你的用户名.github.io/teacher-platform/`，分享即可打开使用。

> 纯静态部署没有 `/api/ocr` 后端，作文「手写录入」会提示"当前部署没有后端"。
> 若仍需线上手写识别，可把 `api/ocr.js` 单独部署到 Vercel，
> 再在「手写录入 → ⚙️ 识别接口地址」填入 `https://你的vercel项目.vercel.app/api/ocr`
> （详见下方"前后端分开部署"）。

### 方式二：Vercel（带 OCR 后端）

使用 OCR 前需先申请腾讯云 OCR 密钥：打开 <https://console.cloud.tencent.com/ocr> 开通**文字识别 OCR**，
到 <https://console.cloud.tencent.com/cam/capi> 新建密钥记下 **SecretId / SecretKey**（等同于账号密码，勿提交 GitHub）。

1. 打开 <https://vercel.com> ，用 GitHub 账号登录
2. **Add New → Project → Import** 刚才那个仓库
3. Framework Preset 选 **Other**，Build Command 和 Output Directory **都留空**（本项目无需构建）
4. 展开 **Environment Variables**，添加两条：

   | Name | Value |
   |---|---|
   | `TENCENT_SECRET_ID` | 你的 SecretId |
   | `TENCENT_SECRET_KEY` | 你的 SecretKey |
   | `TENCENT_OCR_REGION` | （可选）地域，默认 `ap-guangzhou` |

> 仓库根目录已带 `vercel.json`（`buildCommand: null` + `framework: null`），
> 会自动按「纯静态 + api 函数」部署，上面第 3 步的 Framework / Build 设置可留默认。

5. 点 **Deploy**，等 1 分钟左右

完成后得到网址 `https://你的项目.vercel.app`，**把这个网址发给别人，打开就能用手写识别。**

> ⚙️ 若前端在 GitHub Pages、只把 OCR 后端放 Vercel：打开应用 → 作文批改 → 📷 手写录入
> → 展开「⚙️ 识别接口地址」→ 填入 `https://你的项目.vercel.app/api/ocr` → 保存。
> 同一份代码已支持跨域（CORS `*`）。

> 改完密钥或环境变量后，需在 Vercel 里 **Redeploy** 一次才生效。

> ⚠️ 国内访问 Vercel 可能超时/需梯子。若遇到 `ERR_CONNECTION_TIMED_OUT`，请改用下方「腾讯云 SCF」方案。

### 方式三：腾讯云 SCF（国内稳定访问，推荐）

如果 Vercel 在国内访问困难，把 OCR 后端部署到 **腾讯云云函数 SCF + 函数 URL**，国内访问又快又稳。

> 注意：腾讯云 API 网关触发器已于 2024 年 7 月 1 日起停止新建，因此改用 **函数 URL** 作为公网访问入口。

1. 确认已有腾讯云密钥（SecretId / SecretKey）并开通「文字识别 → 通用手写体识别」。
2. 在项目根目录打包：
   ```bash
   node deploy/scf-package.js
   ```
   生成 `dist/ocr-scf.zip`。
3. 登录 [腾讯云 SCF 控制台](https://console.cloud.tencent.com/scf)，新建函数：
   - 运行环境：**Node.js 16.18+**
   - 执行方法：`index.main_handler`
   - 本地上传 `dist/ocr-scf.zip`
   - 环境变量：`TENCENT_SECRET_ID`、`TENCENT_SECRET_KEY`、`TENCENT_OCR_REGION`（可选）
4. 在函数配置里 **开启函数 URL**，选 **无鉴权**，并开启 CORS（允许 `*`、`POST, OPTIONS`、`Content-Type`）。
5. 把控制台给出的函数 URL 填到前端「⚙️ 识别接口地址」里即可。

详细步骤、CORS 配置和故障排查见 `deploy/README-SCF.md`。

### 备选：Cloudflare Pages

同样连 GitHub 仓库，构建命令留空、输出目录填 `/`，
在 **Settings → Environment variables** 里加同样两个变量即可。

> ⚠️ 若用 Vercel/Cloudflare 部署 OCR 后端，接口**无任何鉴权**、CORS 为 `*`，
> 公开 URL 会被任何人调用、烧腾讯云额度。建议仅自己/小范围使用，或自行加访问限制。

---

## 本地调试

**纯静态部分**（除 OCR 外的所有功能）直接双击 `index.html` 即可。

要在本地跑通 OCR，需要起一个能处理 `/api/ocr` 的本地后端。两种方式任选：

### 方式 A：用 dev-server.js（零依赖，推荐）

项目自带了一个 30 行 Node 写的本地开发服务器，不需要装任何第三方包。

1. 在项目根目录创建 `.env.local`，填入腾讯云密钥：
   ```
   TENCENT_SECRET_ID=AKIDxxxxxxxx
   TENCENT_SECRET_KEY=xxxxxxxx
   ```
   （`.env.local` 已在 `.gitignore` 里，不会被提交）

2. 启动：
   ```bash
   node dev-server.js
   ```

3. 浏览器打开 <http://localhost:3000>

输出示例：
```
  本地开发服务器已启动
  访问: http://localhost:3000
  API:  http://localhost:3000/api/ocr
```

### 方式 B：用 Vercel CLI（和线上部署环境一致）

```bash
npm i -g vercel
vercel dev
```

首次会让你登录并关联项目。本地环境变量可放在 `.env.local`（已被 git 忽略）。

---

## 前后端分开部署（可选）

如果前端放在 GitHub Pages、只把接口部署在 Vercel：
在「手写识别」页面展开 **⚙️ 识别接口地址**，填入完整地址，例如：

```
https://你的项目.vercel.app/api/ocr
```

保存后会记在浏览器本地。服务端已开启 CORS，跨域可用。

---

## 项目结构

```
├─ index.html                入口页（侧边栏含「作文批改」入口）
├─ css/style.css             全局样式与主题变量
├─ js/
│  ├─ app.js                 路由：showModule() 切换模块
│  ├─ utils.js
│  └─ modules/
│     ├─ ocr.js              ★ 手写识别前端（上传/压缩/批量/分栏版面还原/复制/导出）
│     ├─ exam.js  essay.js  lesson-plan.js  ...
├─ dev-server.js             ★ 本地开发服务器（零依赖，等价于 vercel dev）
├─ api/
│  ├─ ocr.js                 ★ 服务端代理（腾讯云 OCR，TC3 签名，零依赖）
│  └─ ocr-scf.js             ★ 腾讯云 SCF 入口适配器
├─ deploy/
│  ├─ scf-package.js         SCF 部署包打包脚本
│  └─ README-SCF.md          腾讯云 SCF 部署详细说明
├─ data/sample-data.js
├─ .env.example              环境变量样例
├─ vercel.json               Vercel 部署配置（无构建 + api 函数）
└─ .gitignore
```

---

## 注意事项

- 手写识别**不是 100% 准确**，潦草字迹、公式、表格会有误差，结果请人工校对（页面里结果框可直接改）。
- 若识别顺序读不通（常见于作文格子纸）：把「识别方式」设为 **分栏切图**、栏数设为 **3 栏**，
  先点「✂ 预览切分线」确认切在留白处，再点「开始识别」。
- **改了前端代码却看不到变化？** 本项目是 PWA，`sw.js` 会缓存静态资源。
  改动后请把 `sw.js` 里的 `CACHE_NAME` 版本号 +1；调试时也可在浏览器
  DevTools → Application → Service Workers 勾选 `Update on reload`，
  或直接用 Ctrl+Shift+R 强制刷新。
- 免费额度用完后会报 `RequestLimitExceeded`，需在腾讯云控制台购买资源包。
- 图片会发送到腾讯云进行识别，涉及学生隐私信息时请自行评估合规性。
- 切勿把 `SecretId / SecretKey` 写进任何前端文件或提交到 GitHub。
