# 腾讯云 SCF 部署 OCR 后端（国内稳定访问）

如果你发现 Vercel 在国内访问超时/必须挂梯子，可以把 OCR 后端部署到 **腾讯云云函数 SCF + API 网关**，国内访问又快又稳。

## 前置条件

1. 腾讯云账号（并完成实名认证）
2. 已开通 **文字识别** 服务里的 **通用手写体识别**
3. 已创建 API 密钥（SecretId + SecretKey）

## 部署步骤

### 1. 打包

在仓库根目录执行：

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

### 4. 创建 API 网关触发器

1. 进入函数 → **触发管理** → **创建触发器**
2. 触发方式选择 **API 网关**
3. 新建 API 服务：
   - **API 名称**：`ocr`
   - **请求方法**：`ANY` 或只选 `POST`
   - **鉴权类型**：选 **免鉴权**（因为前端是公开调用）
4. 点 **提交**

提交后，触发器列表会显示一个 **访问路径**，类似：

```
https://service-xxx-123456789.gz.apigw.tencentcs.com/release/ocr
```

把这个地址复制下来。

### 5. 前端配置

打开教师平台 → 作文批改 → 📷 手写录入 → ⚙️ 识别接口地址 → 填：

```
https://service-xxx-123456789.gz.apigw.tencentcs.com/release/ocr
```

点保存，然后上传手写图测试。

### 6. 跨域设置（如前端仍报错 CORS）

如果浏览器提示 `CORS error`：

1. 进入 [API 网关控制台](https://console.cloud.tencent.com/apigateway)
2. 找到你的 API 服务 → 编辑 `ocr` API
3. 开启 **CORS 跨域资源共享**：
   - **允许的 Origin**：`*`
   - **允许的 Method**：`POST, OPTIONS`
   - **允许的 Header**：`Content-Type`
4. 发布/重新部署 API

> 注：`ocr-scf.js` 本身已返回 `Access-Control-Allow-Origin: *` 等头，但在 API 网关层再开一次更稳。

## 费用提示

- SCF 有每月免费额度（调用次数 + 运行时间），个人/小范围使用通常免费
- API 网关也有免费额度
- 腾讯云 OCR 服务按调用量计费，新用户通常有免费资源包

## 故障排查

| 现象 | 可能原因 |
|---|---|
| 前端报 "无法连接识别服务" | API 网关地址填错，或 CORS 未开启 |
| 后端返回 "服务端未配置密钥" | SCF 环境变量 `TENCENT_SECRET_ID`/`TENCENT_SECRET_KEY` 没填或拼错 |
| 后端返回 "腾讯云返回错误：AuthFailure" | 密钥填错，或密钥无 OCR 权限 |
| 后端返回 "腾讯云返回错误：FailedOperation" | 文字识别服务未开通，或额度用完 |
