// api/ocr.js
// ============================================================
// 手写试卷 OCR —— 服务端代理（Vercel Serverless Function）
//
// 作用：接收前端上传的 base64 图片，代腾讯云「通用手写体识别」调用，
//      把文字 **连同坐标信息** 返回前端，供前端做分栏版面还原。
//
// 为什么要返回坐标：
//   作文格子纸是「三栏格子」，腾讯云按物理行返回，一行会横跨三栏，
//   直接拼接会得到「左栏第1行+中栏第1行+右栏第1行」这种读不通的结果。
//   前端需要单字坐标才能重新分栏、按「左栏读到底→中栏→右栏」重排。
//
// 需要的环境变量（在 Vercel 项目 Settings → Environment Variables 里配）：
//   TENCENT_SECRET_ID
//   TENCENT_SECRET_KEY
//   TENCENT_OCR_REGION   （可选，默认 ap-guangzhou）
//
// 零第三方依赖：使用 Node 内置 crypto 手工完成 TC3-HMAC-SHA256 签名
// ============================================================

const crypto = require('crypto');

const HOST = 'ocr.tencentcloudapi.com';
const SERVICE = 'ocr';
const ACTION = 'GeneralHandwritingOCR'; // 通用手写体识别
const VERSION = '2018-11-19';

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}
function hmac(key, str) {
  return crypto.createHmac('sha256', key).update(str, 'utf8').digest();
}

function buildAuthorization(secretId, secretKey, timestamp, payload) {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10); // UTC YYYY-MM-DD

  // 1. 拼接规范请求串
  const canonicalHeaders =
    'content-type:application/json; charset=utf-8\n' + 'host:' + HOST + '\n';
  const signedHeaders = 'content-type;host';
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    sha256Hex(payload)
  ].join('\n');

  // 2. 拼接待签名字符串
  const credentialScope = `${date}/${SERVICE}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n');

  // 3. 计算签名
  const secretDate = hmac('TC3' + secretKey, date);
  const secretService = hmac(secretDate, SERVICE);
  const secretSigning = hmac(secretService, 'tc3_request');
  const signature = crypto
    .createHmac('sha256', secretSigning)
    .update(stringToSign, 'utf8')
    .digest('hex');

  // 拼接 Authorization
  return `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

// ---- 发一次腾讯云请求，返回 Response 对象 ----
async function requestTencent(payloadObj, secretId, secretKey, region) {
  const payload = JSON.stringify(payloadObj);
  const timestamp = Math.floor(Date.now() / 1000);
  const authorization = buildAuthorization(secretId, secretKey, timestamp, payload);

  const tcResp = await fetch(`https://${HOST}`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json; charset=utf-8',
      Host: HOST,
      'X-TC-Action': ACTION,
      'X-TC-Version': VERSION,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Region': region
    },
    body: payload
  });

  const json = await tcResp.json();
  return json.Response || {};
}

// ItemPolygon {X,Y,Width,Height} → 四点多边形
function rectToPoly(r) {
  if (!r) return null;
  const x = r.X || 0, y = r.Y || 0, w = r.Width || 0, h = r.Height || 0;
  return [
    { X: x, Y: y },
    { X: x + w, Y: y },
    { X: x + w, Y: y + h },
    { X: x, Y: y + h }
  ];
}

// 腾讯云 Polygon 对象 {LeftTop,RightTop,RightBottom,LeftBottom} → 四点数组
// 兼容已经是数组形态的输入
function polygonObjToArray(p) {
  if (!p) return null;
  if (Array.isArray(p)) return p.length ? p : null;
  const pts = [p.LeftTop, p.RightTop, p.RightBottom, p.LeftBottom].filter(
    c => c && typeof c.X === 'number' && typeof c.Y === 'number'
  );
  return pts.length ? pts : null;
}

// 把腾讯云的 TextDetections 归一化成前端好用的 blocks
//
// ⚠️ 字段名坑：GeneralHandwritingOCR 的单字坐标字段是 **WordPolygon**
//    （Array of Polygon 对象，且不含字符内容，需按索引与 DetectedText 对齐）。
//    Words / WordCoordPoint 是 GeneralBasicOCR / GeneralAccurateOCR 的字段，
//    这里一并兼容，避免以后换接口再踩一次。
function normalizeDetections(detections) {
  return detections.map(d => {
    const poly =
      (d.Polygon && d.Polygon.length ? d.Polygon : null) || rectToPoly(d.ItemPolygon);

    const text = d.DetectedText || '';
    const chars = [];

    // 路径 A：手写体接口 —— WordPolygon[i] 对应 text 的第 i 个字符
    //
    // ⚠️ 关键保护：WordPolygon 的长度 **不保证** 等于字符数（官方示例里
    //    8 个字只给了 1 个 polygon）。长度不一致时若强行按索引配对，
    //    会把字与坐标错配、输出乱序乱码。此时宁可放弃单字坐标，
    //    退回行级框（再不行由前端「分栏切图」模式兜底）。
    const wp = d.WordPolygon || [];
    const glyphs = Array.from(text); // 按码点切，避免代理对被拆坏
    if (wp.length && wp.length === glyphs.length) {
      for (let i = 0; i < wp.length; i++) {
        const box = polygonObjToArray(wp[i]);
        if (box) chars.push({ ch: glyphs[i], poly: box });
      }
    }

    // 路径 B：印刷体接口 —— Words[i].Character + WordCoordPoint[i].WordCoordinate
    //         这里字符与坐标是成对结构，天然对齐，无需长度校验
    if (!chars.length) {
      const words = d.Words || [];
      const coords = d.WordCoordPoint || [];
      for (let i = 0; i < words.length; i++) {
        const wc = polygonObjToArray(coords[i] && coords[i].WordCoordinate);
        const ch = words[i] && words[i].Character;
        if (ch && wc) chars.push({ ch, poly: wc });
      }
    }

    return {
      text,
      poly: poly || null,
      words: chars
    };
  });
}

module.exports = async function handler(req, res) {
  // --- CORS：允许前端与接口分开部署（如前端在 GitHub Pages） ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持 POST 请求' });
  }

  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;
  const region = process.env.TENCENT_OCR_REGION || 'ap-guangzhou';

  if (!secretId || !secretKey) {
    return res.status(500).json({
      error: '服务端未配置密钥：请在部署平台设置 TENCENT_SECRET_ID / TENCENT_SECRET_KEY'
    });
  }

  // 兼容不同运行时的 body 解析
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  if (!body) {
    body = await new Promise(resolve => {
      let raw = '';
      req.on('data', c => (raw += c));
      req.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (e) { resolve({}); }
      });
    });
  }

  let imageBase64 = body.imageBase64 || body.ImageBase64 || '';
  const imageUrl = body.imageUrl || '';

  if (!imageBase64 && !imageUrl) {
    return res.status(400).json({ error: '缺少图片数据（imageBase64 或 imageUrl）' });
  }
  // 容错：前端若误传了 data:image/...;base64, 前缀，这里剥掉
  if (imageBase64.startsWith('data:')) {
    imageBase64 = imageBase64.slice(imageBase64.indexOf(',') + 1);
  }

  const baseParams = imageBase64 ? { ImageBase64: imageBase64 } : { ImageUrl: imageUrl };

  try {
    // 优先开启「单字四点坐标」——前端分栏重排的必要条件
    let r = await requestTencent(
      Object.assign({}, baseParams, { EnableWordPolygon: true }),
      secretId, secretKey, region
    );

    // 若该参数不被支持，降级重试（仍可用行级坐标做粗分栏）
    if (r.Error && /InvalidParameter/i.test(r.Error.Code || '')) {
      r = await requestTencent(baseParams, secretId, secretKey, region);
    }

    if (r.Error) {
      // 常见：AuthFailure.SignatureFailure(密钥错) / RequestLimitExceeded(超额)
      return res.status(502).json({
        error: `腾讯云返回错误：${r.Error.Code} - ${r.Error.Message}`
      });
    }

    const detections = r.TextDetections || [];
    const blocks = normalizeDetections(detections);
    const hasWordPolygon = blocks.some(b => b.words && b.words.length);

    // text 为「原始物理行」拼接，仅作兜底；正式排版由前端基于 blocks 完成
    const text = detections.map(d => d.DetectedText || '').join('\n').trim();

    return res.status(200).json({
      text,
      blocks,
      hasWordPolygon,
      lines: detections.length,
      requestId: r.RequestId || ''
    });
  } catch (err) {
    return res.status(500).json({
      error: '识别请求失败：' + (err && err.message ? err.message : String(err))
    });
  }
};
