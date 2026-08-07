// api/ocr-scf.js
// ============================================================
// 腾讯云 SCF（云函数）入口适配器
//
// 作用：把腾讯云 API 网关触发器的 event 转成 Vercel 风格的 req/res，
//      复用现有的 api/ocr.js 逻辑，无需改 OCR 核心代码。
//
// 部署方式：
//   1. 把 api/ocr.js + api/ocr-scf.js 一起打包上传为 SCF 函数
//   2. 运行环境选 Node.js 16/18/20
//   3. 触发器选 API 网关（自动获得 HTTPS 地址）
//   4. 环境变量：TENCENT_SECRET_ID / TENCENT_SECRET_KEY / TENCENT_OCR_REGION
//   5. 前端「识别接口地址」填 API 网关给出的 https://xxx.ap-shanghai.apigateway.myqcloud.com/ocr
// ============================================================

const ocrHandler = require('./ocr.js');

function lowerCaseHeaders(headers) {
  const out = {};
  if (headers && typeof headers === 'object') {
    for (const k of Object.keys(headers)) {
      out[k.toLowerCase()] = headers[k];
    }
  }
  return out;
}

function parseBody(event) {
  // SCF 触发器 body 通常是 JSON 字符串；如果已被网关解析成 object 则直接用
  if (!event.body) return {};
  if (typeof event.body === 'object') return event.body;
  try {
    return JSON.parse(event.body);
  } catch (e) {
    return {};
  }
}

exports.main_handler = async function (event, context) {
  const req = {
    method: (event.httpMethod || 'POST').toUpperCase(),
    headers: lowerCaseHeaders(event.headers),
    body: parseBody(event)
  };

  const res = {
    _status: 200,
    _headers: {},
    _body: '',
    setHeader(k, v) {
      this._headers[k] = v;
    },
    writeHead(code, headers) {
      this._status = code;
      if (headers && typeof headers === 'object') {
        Object.assign(this._headers, headers);
      }
    },
    end(data) {
      this._body = data || '';
    }
  };

  await ocrHandler(req, res);

  return {
    isBase64Encoded: false,
    statusCode: res._status,
    headers: res._headers,
    body: res._body
  };
};
