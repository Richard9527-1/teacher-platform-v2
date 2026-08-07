# 腾讯云 SCF 部署 OCR 后端（国内稳定访问）

如果你发现 Vercel 在国内访问超时/必须挂梯子，可以把 OCR 后端部署到 **腾讯云云函数 SCF + 函数 URL**，国内访问又快又稳。

> **注意**：腾讯云 API 网关触发器已于 2024 年 7 月 1 日起停止新建。本方案改用 **SCF 函数 URL** 作为公网访问入口，事件格式与 API 网关相同，无需修改 `ocr-scf.js`。

## 前置条件

1. 腾讯云账号（并完成实名认证）
2. 已开通 **文字识别** 服务里的 **通用手写体识别**
3. 已创建 API 密钥（SecretId + SecretKey）

## 部署步骤

### 1. 打包

在项目根目录执行：

```bash
node deploy/scf-package.js
```

会在 `dist/ocr-scf.zip` 生成部署包，里面包含：
- `index.js`（SCF 默认入口）
- `ocr-scf.js`（腾讯云 event → Vercel req/res 适配）
- `ocr.js`（OCR 核心逻辑，零第三方依赖）

> Windows 如果提示没有 `zip` 命令，请用 Git Bash 执行，或手动把上述 3 个文件压缩成 zip。

### 2. 创建 SCF 函数

1. 登录 [腾讯云云函数控制台](https://console.cloud.tencent.com/scf)
2. 点 **新建** → 选择 **从头开始**
3. 基础配置：
   - **函数名称**：`teacher-platform-ocr`
   - **运行环境**：`Node.js 16.18` 或更高版本
   - **时区**：`Asia/Shanghai`
   - **执行方法**：`index.main_handler`
4. 函数代码：选择 **本地上传 zip 包** → 上传 `dist/ocr-scf.zip`
5. 高级配置（建议）：
   - **执行超时时间**：`30` 秒
   - **运行角色**：使用默认角色即可
6. 点 **完成**

### 3. 设置环境变量

进入函数 → **函数管理 → 函数配置 → 环境变量**，添加：

| 变量名 | 说明 |
|---|---|
| `TENCENT_SECRET_ID` | 腾讯云 API SecretId |
| `TENCENT_SECRET_KEY` | 腾讯云 API SecretKey |
| `TENCENT_OCR_REGION` | OCR 服务地域，可选，默认 `ap-guangzhou` |

### 4. 开启函数 URL

1. 进入函数 → **函数管理 → 函数配置**
2. 找到 **函数 URL**（或 **访问路径**）→ 点 **开启**
3. 配置：
   - **鉴权方式**：选 **无鉴权**（前端是公开调用）
   - **CORS 配置**：开启并设置：
     - **允许的 Origin**：`*`
     - **允许的 Method**：`POST, OPTIONS`
     - **允许的 Header**：`Content-Type`
4. 保存后，控制台会显示一个 **函数 URL**，类似：

```
https://example-xxx.gz.url.cn/release/teacher-platform-ocr
```

把这个地址复制下来。

> 函数 URL 本质上复用了 API 网关 v2.0 事件格式，因此 `ocr-scf.js` 无需任何改动。

### 5. 前端配置

打开教师平台 → 作文批改 → 📷 手写录入 → ⚙️ 识别接口地址 → 填：

```
https://example-xxx.gz.url.cn/release/teacher-platform-ocr
```

点保存，然后上传手写图测试。

### 6. 跨域设置（如前端仍报错 CORS）

如果浏览器提示 `CORS error`：

1. 确认函数代码已返回 CORS 头（`ocr-scf.js` 里已透传）
2. 回到 **函数 URL 配置**，检查 CORS 里是否允许 `Content-Type` 头
3. 保存后重新触发即可

> 注：`ocr-scf.js` 本身已返回 `Access-Control-Allow-Origin: *` 等头，函数 URL 的 CORS 配置再开一次更稳。

## 费用提示

- SCF 有每月免费额度（调用次数 + 运行时间），个人/小范围使用通常免费
- 函数 URL 走外网出流量，有少量免费额度，超出按量计费
- 腾讯云 OCR 服务按调用量计费，新用户通常有免费资源包

## 故障排查

| 现象 | 可能原因 |
|---|---|
| 前端报 "无法连接识别服务" | 函数 URL 地址填错，或 CORS 未开启 |
| 后端返回 "服务端未配置密钥" | SCF 环境变量 `TENCENT_SECRET_ID`/`TENCENT_SECRET_KEY` 没填或拼错 |
| 后端返回 "腾讯云返回错误：AuthFailure" | 密钥填错，或密钥无 OCR 权限 |
| 后端返回 "腾讯云返回错误：FailedOperation" | 文字识别服务未开通，或额度用完 |
