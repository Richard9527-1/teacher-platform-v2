// js/modules/ocr.js
// ============================================================
// 手写试卷 OCR 识别模块
// 调用后端代理 /api/ocr（密钥由服务端保管，前端不接触）
//
// 【版面还原】作文格子纸是三栏格子，OCR 按物理行返回会横跨三栏，
// 直接拼接读不通。本模块基于单字坐标做「列间空白检测」重新分栏，
// 再按「左栏读到底 → 中栏 → 右栏」重排，还原真实阅读顺序。
// ============================================================

/* ------------------------------------------------------------------
 * 版面还原引擎（纯函数，与 DOM 无关，便于单测）
 * ------------------------------------------------------------------ */

// 四点多边形 → 包围盒
function ocrPolyToBox(poly) {
  if (!poly || !poly.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly) {
    const x = p.X != null ? p.X : p.x;
    const y = p.Y != null ? p.Y : p.y;
    if (typeof x !== 'number' || typeof y !== 'number') continue;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x0 === Infinity) return null;
  return { x0, y0, x1, y1 };
}

function ocrUnionBox(boxes) {
  const valid = (boxes || []).filter(Boolean);
  if (!valid.length) return null;
  return {
    x0: Math.min(...valid.map(b => b.x0)),
    y0: Math.min(...valid.map(b => b.y0)),
    x1: Math.max(...valid.map(b => b.x1)),
    y1: Math.max(...valid.map(b => b.y1))
  };
}

function ocrMedian(arr) {
  const s = (arr || []).filter(n => typeof n === 'number' && isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// 把后端 blocks 归一化为 { text, box, words:[{ch, box}] }
// 注意：没有坐标的 block 也要保留（否则会丢字），box 置为 null
function ocrNormalizeBlocks(blocks) {
  const out = [];
  (blocks || []).forEach(b => {
    if (!b) return;
    const words = (b.words || [])
      .map(w => ({ ch: w.ch || '', box: ocrPolyToBox(w.poly) }))
      .filter(w => w.box && w.ch);
    const box = ocrPolyToBox(b.poly) || ocrUnionBox(words.map(w => w.box));
    const text = b.text || '';
    if (!box && !words.length && !text) return;
    out.push({ text, box, words });
  });
  return out;
}

/**
 * 分栏检测：用「列间空白」找出栏目边界
 * 原理：把所有单字投影到 X 轴做覆盖直方图，作文纸栏与栏之间
 *       没有任何字符，会形成明显的零覆盖带（gutter），即为分栏点。
 *       必须用单字坐标——行级框横跨三栏，检测不出空白。
 * @param {number} forced 强制栏数（0=自动检测）
 */
function ocrDetectColumns(norm, forced) {
  const wordBoxes = [];
  norm.forEach(b => (b.words || []).forEach(w => wordBoxes.push(w.box)));
  const boxes = wordBoxes.length ? wordBoxes : norm.map(b => b.box).filter(Boolean);
  if (!boxes.length) return null;

  const minX = Math.min(...boxes.map(b => b.x0));
  const maxX = Math.max(...boxes.map(b => b.x1));
  const span = maxX - minX;
  if (!(span > 0)) return null;

  const BINS = 500;
  const hist = new Array(BINS).fill(0);
  boxes.forEach(b => {
    let i0 = Math.floor(((b.x0 - minX) / span) * (BINS - 1));
    let i1 = Math.ceil(((b.x1 - minX) / span) * (BINS - 1));
    i0 = Math.max(0, i0);
    i1 = Math.min(BINS - 1, i1);
    for (let i = i0; i <= i1; i++) hist[i]++;
  });

  // 找零覆盖带
  const gutters = [];
  let i = 0;
  while (i < BINS) {
    if (hist[i] === 0) {
      let j = i;
      while (j < BINS && hist[j] === 0) j++;
      gutters.push({ s: i, e: j - 1, w: j - i, mid: (i + j - 1) / 2 });
      i = j;
    } else i++;
  }

  // 过滤：忽略贴边留白；宽度需达到内容宽度的 2%（滤掉字间距噪声）
  const edge = BINS * 0.03;
  const minW = BINS * 0.02;
  const valid = gutters
    .filter(g => g.s > edge && g.e < BINS - 1 - edge && g.w >= minW)
    .sort((a, b) => b.w - a.w);

  let cuts;
  if (forced > 0) {
    const need = forced - 1;
    if (need <= 0) {
      cuts = [];
    } else if (valid.length >= need) {
      // 取最宽的 need 条空白带作为分栏线
      cuts = valid.slice(0, need).map(g => g.mid).sort((a, b) => a - b);
    } else {
      // 找不到足够空白 → 按宽度均分（作文纸通常对称）
      cuts = [];
      for (let k = 1; k < forced; k++) cuts.push(((BINS - 1) * k) / forced);
    }
  } else {
    cuts = valid.slice(0, 5).map(g => g.mid).sort((a, b) => a - b);
  }

  const toX = bin => minX + (bin / (BINS - 1)) * span;
  const bounds = [];
  let prev = minX - 1;
  cuts.forEach(c => {
    const x = toX(c);
    bounds.push({ x0: prev, x1: x });
    prev = x;
  });
  bounds.push({ x0: prev, x1: maxX + 1 });

  return { bounds, count: bounds.length, detectedGutters: valid.length, minX, maxX };
}

/**
 * 按栏重新切分并排序
 * 关键：一个横跨三栏的检测行，会按单字的 X 坐标被拆成三个片段，
 *       分别归入不同栏，从而修正阅读顺序。
 */
function ocrBuildLines(norm, bounds) {
  const colOf = cx => {
    for (let i = 0; i < bounds.length; i++) if (cx <= bounds[i].x1) return i;
    return bounds.length - 1;
  };

  const frags = [];
  norm.forEach(b => {
    if (b.words && b.words.length) {
      let cur = null;
      b.words.forEach(w => {
        const cx = (w.box.x0 + w.box.x1) / 2;
        const cy = (w.box.y0 + w.box.y1) / 2;
        const c = colOf(cx);
        if (!cur || cur.col !== c) {
          if (cur) frags.push(cur);
          cur = { col: c, text: '', x0: w.box.x0, x1: w.box.x1, ySum: 0, n: 0, h: w.box.y1 - w.box.y0 };
        }
        cur.text += w.ch;
        cur.x0 = Math.min(cur.x0, w.box.x0);
        cur.x1 = Math.max(cur.x1, w.box.x1);
        cur.ySum += cy;
        cur.n++;
        cur.h = Math.max(cur.h, w.box.y1 - w.box.y0);
      });
      if (cur) frags.push(cur);
    } else if (b.box) {
      // 无单字坐标：整行按中心点归栏（粗粒度兜底）
      frags.push({
        col: colOf((b.box.x0 + b.box.x1) / 2),
        text: b.text,
        x0: b.box.x0,
        x1: b.box.x1,
        ySum: (b.box.y0 + b.box.y1) / 2,
        n: 1,
        h: b.box.y1 - b.box.y0
      });
    }
  });

  frags.forEach(f => { f.y = f.n ? f.ySum / f.n : 0; });

  const lineH = ocrMedian(frags.map(f => f.h)) || 20;
  const lines = [];

  // 外层按栏（左→右），内层按 Y（上→下）——这就是正确的阅读顺序
  for (let c = 0; c < bounds.length; c++) {
    const fs = frags.filter(f => f.col === c).sort((a, b) => a.y - b.y || a.x0 - b.x0);
    if (!fs.length) continue;
    const colLeft = Math.min(...fs.map(f => f.x0));

    const groups = [];
    fs.forEach(f => {
      const g = groups[groups.length - 1];
      if (g && Math.abs(f.y - g.y) < lineH * 0.6) {
        g.items.push(f);
        g.y = (g.y * (g.items.length - 1) + f.y) / g.items.length;
      } else {
        groups.push({ y: f.y, items: [f] });
      }
    });

    // 计算「上一行 Y 中心 → 本行 Y 中心」的垂直间距。
    //   正常相邻行：gap ≈ 1×lineH
    //   段间留一空行：gap ≈ 2×lineH
    // 仅在同一栏内比较，避免把「栏底→栏顶」误判为段间距。
    //
    // 关键补充：拍照件常因透视畸变把一行切成 2-3 小段（每段 10-14 字），
    // 这些小段之间的 Y 间距也会 ≥ 1.5×lineH，导致把它们误判成不同段落。
    // 因此只有「上一行 ≥ 15 字 且本行 ≥ 6 字」时，才把空白间距视为段间距。
    //   - 扫描件 / 印刷体：行 30-40 字 → 达标，正常检测段间距
    //   - 拍照件被切碎的小段：< 15 字 → 不达标，不再误判
    let prevY = null;
    let prevText = '';
    groups.forEach(g => {
      g.items.sort((a, b) => a.x0 - b.x0);
      const text = g.items.map(it => it.text).join('');
      const gap = prevY == null ? 0 : g.y - prevY;
      const paraBreak = prevY != null
        && gap > lineH * 1.5
        && prevText.length >= 15
        && text.length >= 6;
      lines.push({
        col: c,
        text,
        x0: g.items[0].x0,
        y: g.y,
        colLeft,
        gap,
        paraBreak
      });
      prevY = g.y;
      prevText = text;
    });
  }

  return { lines, lineH };
}

/**
 * 主入口：blocks → 排好版的文本
 * @param {object} opts { columns: 'auto'|1..6, join: 'flow'|'lines' }
 *   flow  = 连排成文，按首行缩进 + 段间空行的垂直间距自动分段（作文推荐）
 *   lines = 保留每行换行（适合填空题、名单等）
 */
function ocrLayoutText(blocks, opts) {
  opts = opts || {};
  const join = opts.join || 'flow';
  const forced = opts.columns && opts.columns !== 'auto' ? parseInt(opts.columns, 10) || 0 : 0;

  const norm = ocrNormalizeBlocks(blocks);
  if (!norm.length) {
    return { text: '', columns: 0, hasGeometry: false, lineCount: 0 };
  }

  // 只有带坐标的 block 能参与分栏；无坐标的按原顺序附在末尾，保证不丢字
  const withGeo = norm.filter(b => b.box || (b.words && b.words.length));
  const noGeo = norm.filter(b => !(b.box || (b.words && b.words.length)));

  const det = withGeo.length ? ocrDetectColumns(withGeo, forced) : null;
  if (!det) {
    // 完全没有坐标信息 → 按原始行顺序输出（不做分栏，但绝不丢字）
    return {
      text: norm.map(b => b.text).filter(Boolean).join('\n').trim(),
      columns: 1,
      hasGeometry: false,
      lineCount: norm.length
    };
  }

  const { lines, lineH } = ocrBuildLines(withGeo, det.bounds);

  const wordWidths = [];
  withGeo.forEach(b => (b.words || []).forEach(w => wordWidths.push(w.box.x1 - w.box.x0)));
  const charW = ocrMedian(wordWidths) || lineH;

  let text;
  if (join === 'lines') {
    text = lines.map(l => l.text).join('\n');
  } else {
    // 连排成文：分段依据「首行缩进」OR「段间空行间距」（二选一即视为新段）
    //   (a) 首行缩进 > 1.2 字宽 —— 扫描件/印刷体上最可靠
    //   (b) 同栏内上一行→本行 Y 间距 > 1.5×lineH —— 手写拍照件的关键信号
    //       （段间必留一空行 → gap ≈ 2×lineH，正常行 ≈ 1×lineH）
    // 单靠 (a) 时，拍照件因透视畸变几乎测不出缩进，会把所有行挤成一个段落，
    // 视觉上像「一段格子接一段格子」。补上 (b) 后，扫描/拍照都能正确分段。
    const paras = [];
    let cur = '';
    lines.forEach(l => {
      const indent = l.x0 - l.colLeft;
      const isBreak = cur && (indent > charW * 1.2 || l.paraBreak);
      if (isBreak) {
        paras.push(cur);
        cur = l.text;
      } else {
        cur += l.text;
      }
    });
    if (cur) paras.push(cur);
    text = paras.join('\n\n');
  }

  // 无坐标的残余文本附在末尾
  const tail = noGeo.map(b => b.text).filter(Boolean).join('\n');
  if (tail) text += (text ? '\n' : '') + tail;

  return {
    text: text.trim(),
    columns: det.bounds.length,
    detectedGutters: det.detectedGutters,
    hasGeometry: true,
    lineCount: lines.length
  };
}

/* ------------------------------------------------------------------
 * 分栏切图引擎（不依赖 OCR 坐标，最可靠）
 *
 * 思路：作文格子纸的栏与栏之间是整片留白，把图片做「列向暗像素投影」，
 *       三栏格子会形成三个高峰、两条低谷，低谷即分栏线。沿分栏线把图
 *       竖切成 N 张，分别送 OCR，再按左→右顺序拼接，阅读顺序天然正确。
 *       代价是消耗 N 次识别额度。
 * ------------------------------------------------------------------ */

// 计算列向暗像素投影（返回长度 = canvas 宽度的数组）
function ocrColumnProfile(ctx, w, h) {
  const data = ctx.getImageData(0, 0, w, h).data;
  const prof = new Array(w).fill(0);
  // 纵向抽样，避免大图卡顿
  const stepY = Math.max(1, Math.floor(h / 800));
  for (let y = 0; y < h; y += stepY) {
    const rowOff = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = rowOff + x * 4;
      // 灰度：低于阈值算「有内容」
      const g = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      if (g < 190) prof[x]++;
    }
  }
  return prof;
}

/**
 * 在投影里找 (cols-1) 条分栏线
 *
 * 关键修正（2026-07-31）：真实的答题纸常有白边 / 页眉页脚，内容并不占满整图。
 * 若直接对「整图宽」做三等分，第二条分栏线会被推到 2/3 处、切进第 3 栏。
 * 因此这里先检测「实际书写内容」的左右边界 [L,R]，再在 [L,R] 内做等份。
 *
 * 步骤：
 *   1. 用峰值 50% 判定左右是否留白边（页边暗像素极少）
 *   2. 若有白边，从边缘向里扫到暗像素超过峰值 30% 的位置，得到内容边界 L/R
 *   3. 检测不到明显白边（满幅图）或异常时，退回整图等份
 *   4. 在 [L,R] 内做 (cols-1) 条等份 —— 标准多栏格子栏宽相等，分栏线恰在等份点
 *
 * 注：答题纸的栏间留白是「软低谷」而非尖锐谷底，靠「最深的局部谷」反而会被栏内
 *     稀疏文字带偏，所以这里不追求局部谷，直接用内容等份，最稳。
 */
function ocrFindColumnCuts(prof, cols) {
  const w = prof.length;
  const eqSplit = () => {
    const a = [];
    for (let k = 1; k < cols; k++) a.push(Math.round((w * k) / cols));
    return a;
  };
  if (cols < 2 || w < 8) return eqSplit();

  const peak = Math.max(...prof);

  // ---- 1. 检测内容左右边界（排除白页边 / 页眉页脚）----
  const edge = Math.max(20, Math.round(w * 0.05));
  const leftEmpty = Math.min(...prof.slice(0, edge)) < peak * 0.5;
  const rightEmpty = Math.min(...prof.slice(w - edge)) < peak * 0.5;
  let L = 0, R = w - 1;
  const thr = peak * 0.3;
  if (leftEmpty) {
    let x = 0;
    while (x < w && prof[x] < thr) x++;
    L = x;
  }
  if (rightEmpty) {
    let x = w - 1;
    while (x >= 0 && prof[x] < thr) x--;
    R = x;
  }
  // 没检测到明显白边（满幅图），或检测结果异常 → 退回整图等份
  if (R - L < w * 0.5) { L = 0; R = w - 1; }

  // ---- 2. 在内容范围内做等份，得到 (cols-1) 条分栏线 ----
  const cuts = [];
  for (let k = 1; k < cols; k++) {
    cuts.push(Math.round(L + ((R - L) * k) / cols));
  }
  return cuts;
}

/**
 * 把图片按栏切成若干竖条，返回 base64 数组（左→右）
 * @param {HTMLImageElement} img
 * @param {number} cols 栏数
 * @param {number} maxEdge 单条长边上限
 */
function ocrSliceImage(img, cols, maxEdge) {
  maxEdge = maxEdge || 2200;
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  // 先整图画一遍用于投影分析（缩小加速）
  const aw = Math.min(srcW, 1200);
  const ah = Math.round((srcH * aw) / srcW);
  const ac = document.createElement('canvas');
  ac.width = aw; ac.height = ah;
  const actx = ac.getContext('2d', { willReadFrequently: true });
  actx.fillStyle = '#fff';
  actx.fillRect(0, 0, aw, ah);
  actx.drawImage(img, 0, 0, aw, ah);

  let cuts;
  try {
    const prof = ocrColumnProfile(actx, aw, ah);
    cuts = ocrFindColumnCuts(prof, cols).map(x => Math.round((x / aw) * srcW));
  } catch (e) {
    // 跨域图片读像素会抛错 → 退化为等分
    cuts = [];
    for (let k = 1; k < cols; k++) cuts.push(Math.round((srcW * k) / cols));
  }

  const xs = [0].concat(cuts, [srcW]);
  const out = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i];
    const sw = xs[i + 1] - x0;
    if (sw <= 4) continue;

    let dw = sw, dh = srcH;
    if (Math.max(dw, dh) > maxEdge) {
      const s = maxEdge / Math.max(dw, dh);
      dw = Math.round(dw * s);
      dh = Math.round(dh * s);
    }
    const c = document.createElement('canvas');
    c.width = dw; c.height = dh;
    const cx = c.getContext('2d');
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, dw, dh);
    cx.drawImage(img, x0, 0, sw, srcH, 0, 0, dw, dh);

    let q = 0.85;
    let url = c.toDataURL('image/jpeg', q);
    while (url.length > 3 * 1024 * 1024 && q > 0.4) {
      q -= 0.15;
      url = c.toDataURL('image/jpeg', q);
    }
    out.push(url.slice(url.indexOf(',') + 1));
  }
  return out;
}

function ocrLoadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片解析失败'));
      img.onload = () => resolve(img);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ------------------------------------------------------------------
 * UI
 * ------------------------------------------------------------------ */

// 可嵌入版本：不带 card 外壳。作文批改模块内嵌时使用。
// opts.embedded = true  → 隐藏大标题（外层已有标题）
function renderOcrBody(opts) {
  const o = opts || {};
  return `
    ${o.embedded ? '' : `
    <div class="card-header">
      <h2><i class="fas fa-hand-paper" style="color:var(--primary);"></i> 手写试卷识别</h2>
      <span style="color:var(--text-light);">批量上传手写试卷，识别为可复制、可编辑的文字</span>
    </div>`}

    <!-- 上传区 -->
    <div id="ocrDrop" style="border:2px dashed var(--primary);border-radius:var(--radius);padding:36px;text-align:center;cursor:pointer;color:var(--text-light);background:var(--bg);transition:background .2s;">
      📤 点击选择图片，或将多张试卷图片拖拽到此处<br/>
      <span style="font-size:0.8rem;">支持 JPG / PNG，可一次选多张（批量）</span>
    </div>
    <input type="file" id="ocrFileInput" accept="image/*" multiple hidden />

    <!-- 版面还原设置 -->
    <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-top:14px;padding:14px;background:var(--bg);border-radius:var(--radius);border:1px solid rgba(74,111,165,0.2);">
      <span style="font-size:0.9rem;color:var(--text);font-weight:600;">📐 版面还原</span>

      <label style="font-size:0.85rem;color:var(--text-light);display:flex;align-items:center;gap:6px;">
        识别方式
        <select id="ocrModeSel" style="padding:6px 10px;border-radius:6px;border:1px solid #ddd;background:var(--card-bg);color:var(--text);font-size:0.85rem;">
          <option value="slice">分栏切图（作文纸推荐·最准）</option>
          <option value="reflow">整图智能重排（省额度）</option>
        </select>
      </label>

      <label style="font-size:0.85rem;color:var(--text-light);display:flex;align-items:center;gap:6px;">
        栏数
        <select id="ocrColSel" style="padding:6px 10px;border-radius:6px;border:1px solid #ddd;background:var(--card-bg);color:var(--text);font-size:0.85rem;">
          <option value="auto">自动检测</option>
          <option value="1">1 栏（普通答题纸）</option>
          <option value="2">2 栏</option>
          <option value="3">3 栏（作文格子纸）</option>
          <option value="4">4 栏</option>
        </select>
      </label>

      <label style="font-size:0.85rem;color:var(--text-light);display:flex;align-items:center;gap:6px;">
        输出
        <select id="ocrJoinSel" style="padding:6px 10px;border-radius:6px;border:1px solid #ddd;background:var(--card-bg);color:var(--text);font-size:0.85rem;">
          <option value="flow">连排成文（作文推荐）</option>
          <option value="lines">保留每行换行</option>
        </select>
      </label>

      <button id="ocrRelayoutBtn" style="padding:6px 16px;border-radius:6px;border:1px solid var(--primary);background:transparent;color:var(--primary);cursor:pointer;font-size:0.85rem;">🔄 重新排版</button>
      <button id="ocrPreviewCutBtn" style="padding:6px 16px;border-radius:6px;border:1px solid var(--text-light);background:transparent;color:var(--text);cursor:pointer;font-size:0.85rem;">✂ 预览切分线</button>

      <span style="font-size:0.78rem;color:var(--text-light);flex-basis:100%;line-height:1.7;">
        <b>分栏切图</b>：先把整张图按栏竖切成 N 条，逐条识别再拼接，阅读顺序<b>必定正确</b>；代价是消耗 N 次额度。<b>作文格子纸请用这个</b>，并把栏数设为「3 栏」。<br/>
        <b>整图智能重排</b>：只调 1 次接口，靠单字坐标反推分栏；省额度，但栏间留白不明显时可能失效。改完设置点「重新排版」不消耗额度。
      </span>
    </div>

    <!-- 接口地址（前后端分开部署时填写，例如 https://xxx.vercel.app/api/ocr） -->
    <details style="margin-top:12px;">
      <summary style="cursor:pointer;color:var(--text-light);font-size:0.85rem;">⚙️ 识别接口地址（默认自动，一般无需修改）</summary>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <input type="text" id="ocrApiInput" placeholder="/api/ocr 或 https://你的项目.vercel.app/api/ocr"
          style="flex:1;padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:var(--bg);color:var(--text);font-size:0.9rem;" />
        <button id="ocrApiSaveBtn" style="padding:8px 16px;border-radius:8px;border:1px solid var(--primary);background:transparent;color:var(--primary);cursor:pointer;">保存</button>
      </div>
    </details>

    <!-- 操作栏 -->
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin:16px 0;align-items:center;">
      <button id="ocrStartBtn" style="padding:8px 20px;border-radius:8px;border:none;background:var(--primary);color:#fff;cursor:pointer;font-size:0.95rem;">🚀 开始识别</button>
      <button id="ocrSendEssayBtn" class="btn btn-success">✍️ 送去批改</button>
      <button id="ocrCopyAllBtn" style="padding:8px 16px;border-radius:8px;border:1px solid var(--primary);background:transparent;color:var(--primary);cursor:pointer;">📋 复制全部</button>
      <button id="ocrExportTxtBtn" style="padding:8px 16px;border-radius:8px;border:1px solid var(--text-light);background:transparent;color:var(--text);cursor:pointer;">⬇ 导出 TXT</button>
      <button id="ocrExportMdBtn" style="padding:8px 16px;border-radius:8px;border:1px solid var(--text-light);background:transparent;color:var(--text);cursor:pointer;">⬇ 导出 MD</button>
      <span id="ocrProgress" style="color:var(--text-light);font-size:0.9rem;margin-left:auto;"></span>
    </div>

    <!-- 结果列表 -->
    <div id="ocrList"></div>

    <p style="color:var(--text-light);font-size:0.8rem;margin-top:12px;">
      ⚠️ 手写识别非 100% 准确，请对结果进行人工校对。识别在服务器端完成，图片不会留存本地之外。
    </p>
  `;
}

// 独立页面版本（带 card 外壳），保留向后兼容
function renderOcr() {
  return `<div class="card">${renderOcrBody()}</div>`;
}

function initOcr() {
  const drop = document.getElementById('ocrDrop');
  const input = document.getElementById('ocrFileInput');
  const list = document.getElementById('ocrList');
  const progress = document.getElementById('ocrProgress');
  if (!drop || !input || !list) return;

  // item: { id, file, url, status, text, error, blocks, columns, hasGeometry, edited }
  let items = [];
  let counter = 0;

  // ---- 接口地址配置 ----
  const API_KEY_LS = 'ocrApiBase';
  function getApiBase() {
    return localStorage.getItem(API_KEY_LS) || '/api/ocr';
  }
  const apiInput = document.getElementById('ocrApiInput');
  const apiSaveBtn = document.getElementById('ocrApiSaveBtn');
  if (apiInput) apiInput.value = getApiBase();
  if (apiSaveBtn) {
    apiSaveBtn.addEventListener('click', () => {
      const v = (apiInput.value || '').trim() || '/api/ocr';
      localStorage.setItem(API_KEY_LS, v);
      toast('接口地址已保存：' + v);
    });
  }

  // ---- 版面设置（持久化） ----
  const COL_LS = 'ocrColumns';
  const JOIN_LS = 'ocrJoinMode';
  const MODE_LS = 'ocrRecMode';
  const colSel = document.getElementById('ocrColSel');
  const joinSel = document.getElementById('ocrJoinSel');
  const modeSel = document.getElementById('ocrModeSel');
  if (colSel) colSel.value = localStorage.getItem(COL_LS) || 'auto';
  if (joinSel) joinSel.value = localStorage.getItem(JOIN_LS) || 'flow';
  if (modeSel) modeSel.value = localStorage.getItem(MODE_LS) || 'slice';
  if (colSel) colSel.addEventListener('change', () => localStorage.setItem(COL_LS, colSel.value));
  if (joinSel) joinSel.addEventListener('change', () => localStorage.setItem(JOIN_LS, joinSel.value));
  if (modeSel) modeSel.addEventListener('change', () => localStorage.setItem(MODE_LS, modeSel.value));

  function recMode() { return modeSel ? modeSel.value : 'slice'; }
  // 切图模式下的栏数：'auto' 无意义（切图必须给定栏数），默认按 3 栏作文纸
  function sliceCols() {
    const v = colSel ? colSel.value : '3';
    const n = v === 'auto' ? 3 : parseInt(v, 10);
    return Math.min(6, Math.max(1, n || 3));
  }

  function layoutOpts() {
    return {
      columns: colSel ? colSel.value : 'auto',
      join: joinSel ? joinSel.value : 'flow'
    };
  }

  function applyLayoutToItem(item) {
    if (!item.blocks || !item.blocks.length) {
      item.columns = 0;
      item.hasGeometry = false;
      return;
    }
    const res = ocrLayoutText(item.blocks, layoutOpts());
    item.text = res.text || item.rawText || '';
    item.columns = res.columns;
    item.hasGeometry = res.hasGeometry;
    item.edited = false;
  }

  const relayoutBtn = document.getElementById('ocrRelayoutBtn');
  if (relayoutBtn) {
    relayoutBtn.addEventListener('click', () => {
      const done = items.filter(i => i.blocks && i.blocks.length);
      if (!done.length) { alert('还没有可重排的识别结果'); return; }
      if (items.some(i => i.edited) &&
          !confirm('检测到你手动修改过识别结果，重新排版会覆盖这些修改。是否继续？')) {
        return;
      }
      done.forEach(item => { applyLayoutToItem(item); renderItem(item); });
      toast('已按新设置重新排版（未消耗识别额度）');
    });
  }

  // ---- 预览切分线：识别前先确认切在留白处，避免白白消耗额度 ----
  const previewCutBtn = document.getElementById('ocrPreviewCutBtn');
  if (previewCutBtn) {
    previewCutBtn.addEventListener('click', async () => {
      if (!items.length) { alert('请先上传一张图片'); return; }
      const cols = sliceCols();
      if (cols < 2) { alert('当前栏数为 1，无需切分'); return; }
      try {
        const img = await ocrLoadImage(items[0].file);
        showCutPreview(img, cols);
      } catch (e) {
        alert('预览失败：' + (e && e.message ? e.message : e));
      }
    });
  }

  function showCutPreview(img, cols) {
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    const dw = Math.min(900, srcW);
    const dh = Math.round((srcH * dw) / srcW);

    const c = document.createElement('canvas');
    c.width = dw; c.height = dh;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.fillStyle = '#fff';
    cx.fillRect(0, 0, dw, dh);
    cx.drawImage(img, 0, 0, dw, dh);

    let cuts = [];
    try {
      cuts = ocrFindColumnCuts(ocrColumnProfile(cx, dw, dh), cols);
    } catch (e) {
      for (let k = 1; k < cols; k++) cuts.push(Math.round((dw * k) / cols));
    }

    cx.strokeStyle = '#e53935';
    cx.lineWidth = 3;
    cx.setLineDash([10, 6]);
    cuts.forEach(x => {
      cx.beginPath();
      cx.moveTo(x + 0.5, 0);
      cx.lineTo(x + 0.5, dh);
      cx.stroke();
    });

    const mask = document.createElement('div');
    mask.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10001;display:flex;' +
      'align-items:center;justify-content:center;padding:24px;';
    const box = document.createElement('div');
    box.style.cssText =
      'background:var(--card-bg);border-radius:var(--radius);padding:16px;max-height:90vh;' +
      'overflow:auto;text-align:center;max-width:95vw;';
    box.innerHTML =
      '<div style="color:var(--text);font-size:0.95rem;margin-bottom:10px;">' +
      '红色虚线为切分位置（共 ' + cols + ' 栏）。<b>线应落在栏与栏之间的空白处</b>；' +
      '若切到字上，请改「栏数」后重新预览。</div>';
    c.style.cssText = 'max-width:100%;border:1px solid #ddd;border-radius:8px;';
    box.appendChild(c);
    const btn = document.createElement('button');
    btn.textContent = '关闭';
    btn.style.cssText =
      'margin-top:12px;padding:8px 24px;border-radius:8px;border:none;background:var(--primary);color:#fff;cursor:pointer;';
    btn.onclick = () => mask.remove();
    box.appendChild(btn);
    mask.appendChild(box);
    mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
    document.body.appendChild(mask);
  }

  // ---- 点击 / 拖拽上传 ----
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', e => {
    e.preventDefault();
    drop.style.background = 'rgba(74,111,165,0.12)';
  });
  drop.addEventListener('dragleave', () => { drop.style.background = 'var(--bg)'; });
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.style.background = 'var(--bg)';
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });
  input.addEventListener('change', e => {
    addFiles(e.target.files);
    input.value = ''; // 允许重复选同一文件
  });

  function addFiles(fileList) {
    Array.from(fileList).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const id = 'ocr_' + (++counter);
      const item = {
        id, file, url: '', status: '队列', text: '', rawText: '',
        error: '', blocks: null, columns: 0, hasGeometry: false, edited: false
      };
      const reader = new FileReader();
      reader.onload = ev => { item.url = ev.target.result; renderItem(item); };
      reader.readAsDataURL(file);
      items.push(item);
      renderItem(item);
    });
    updateProgress();
  }

  function renderItem(item) {
    let el = document.getElementById(item.id);
    if (!el) {
      el = document.createElement('div');
      el.id = item.id;
      el.style.cssText = 'display:flex;gap:14px;padding:14px;margin-bottom:12px;border:1px solid rgba(0,0,0,0.06);border-radius:var(--radius);background:var(--card-bg);align-items:flex-start;';
      list.appendChild(el);
    }

    const statusColor = item.status === '完成' ? 'var(--c-success)'
      : item.status === '失败' ? 'var(--c-danger)'
      : item.status === '识别中' ? 'var(--c-warning)'
      : 'var(--text-light)';

    const preview = item.url
      ? `<img src="${item.url}" style="width:110px;height:150px;object-fit:cover;border-radius:8px;flex-shrink:0;border:1px solid #eee;" />`
      : `<div style="width:110px;height:150px;border-radius:8px;background:var(--bg);flex-shrink:0;"></div>`;

    // 版面提示徽标
    let layoutBadge = '';
    if (item.status === '完成') {
      if (item.mode === 'slice' && item.sliceCount) {
        layoutBadge = `<span style="font-size:0.75rem;color:var(--c-success-text);background:rgba(46,125,50,0.12);padding:2px 8px;border-radius:10px;">✂ 切图识别 ${item.sliceCount} 栏</span>`;
      } else if (item.hasGeometry && item.columns > 0) {
        layoutBadge = `<span style="font-size:0.75rem;color:var(--primary);background:rgba(74,111,165,0.12);padding:2px 8px;border-radius:10px;">📐 ${item.columns} 栏版面</span>`;
      } else {
        layoutBadge = `<span style="font-size:0.75rem;color:var(--c-warning-text);background:rgba(255,193,7,0.15);padding:2px 8px;border-radius:10px;">⚠ 无坐标，按原始行输出</span>`;
      }
    }

    const textArea = `
      <textarea id="${item.id}_ta" placeholder="识别结果将显示在这里…"
        oninput="window.__ocrOnEdit('${item.id}', this.value)"
        style="flex:1;min-height:150px;padding:10px;border-radius:8px;border:1px solid #ddd;background:var(--bg);color:var(--text);font-size:0.95rem;line-height:1.8;resize:vertical;font-family:'Segoe UI',sans-serif;">${item.text}</textarea>`;

    el.innerHTML = `
      ${preview}
      <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <span style="font-size:0.85rem;color:var(--text);max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.file.name}</span>
          <div style="display:flex;align-items:center;gap:8px;">
            ${layoutBadge}
            <span style="font-size:0.8rem;color:${statusColor};font-weight:600;">${item.status}</span>
          </div>
        </div>
        ${textArea}
        ${item.error ? `<div style="font-size:0.8rem;color:var(--c-danger);">${item.error}</div>` : ''}
        <div style="display:flex;gap:8px;">
          <button onclick="window.__ocrCopyOne('${item.id}')" style="padding:4px 12px;border-radius:6px;border:1px solid var(--primary);background:transparent;color:var(--primary);cursor:pointer;font-size:0.85rem;">📋 复制本条</button>
          <button class="da-link-success" onclick="window.__ocrToEssay('${item.id}')">✍️ 批改本篇</button>
          ${item.rawText
            ? `<button onclick="window.__ocrRawOne('${item.id}')" style="padding:4px 12px;border-radius:6px;border:1px solid var(--text-light);background:transparent;color:var(--text-light);cursor:pointer;font-size:0.85rem;">👁 看原始行</button>`
            : ''}
        </div>
      </div>
    `;
  }

  function updateProgress() {
    const total = items.length;
    const done = items.filter(i => i.status === '完成' || i.status === '失败').length;
    const processing = items.filter(i => i.status === '识别中').length;
    progress.textContent = total ? `共 ${total} 张 · 已处理 ${done} 张 · 识别中 ${processing} 张` : '';
  }

  // ---- 批量识别 ----
  document.getElementById('ocrStartBtn').addEventListener('click', async () => {
    const pending = items.filter(i => i.status === '队列' || i.status === '失败');
    if (pending.length === 0) { alert('请先上传试卷图片'); return; }
    const mode = recMode();
    for (const item of pending) {
      item.status = '识别中';
      item.mode = mode;
      renderItem(item);
      updateProgress();
      try {
        if (mode === 'slice') {
          await recognizeBySlicing(item);
        } else {
          const data = await ocrRecognize(item);
          item.blocks = data.blocks || null;
          item.rawText = data.text || '';
          if (item.blocks && item.blocks.length) {
            applyLayoutToItem(item);
          } else {
            item.text = item.rawText;
            item.hasGeometry = false;
            item.columns = 0;
          }
        }
        item.status = '完成';
        item.error = '';
      } catch (e) {
        item.status = '失败';
        item.error = (e && e.message) ? e.message : '识别失败，请重试';
      }
      renderItem(item);
      updateProgress();
    }
  });

  // ---- 分栏切图识别：切成 N 条竖条，逐条识别再按左→右拼接 ----
  async function recognizeBySlicing(item) {
    const cols = sliceCols();
    const img = await ocrLoadImage(item.file);
    const parts = ocrSliceImage(img, cols, 2200);
    if (!parts.length) throw new Error('图片切分失败');

    const texts = [];
    for (let i = 0; i < parts.length; i++) {
      item.status = `识别中 ${i + 1}/${parts.length} 栏`;
      renderItem(item);
      const data = await postOcr(parts[i]);
      // 单栏内部就是普通竖排阅读顺序，直接按行拼
      const blocks = data.blocks || [];
      let t;
      if (blocks.length) {
        const res = ocrLayoutText(blocks, { columns: 1, join: layoutOpts().join });
        t = res.text;
      } else {
        t = data.text || '';
      }
      if (t) texts.push(t);
    }

    item.blocks = null;             // 切图模式不保留整图坐标
    item.sliceCount = parts.length;
    item.rawText = texts.join('\n');
    item.text = layoutOpts().join === 'flow' ? texts.join('') : texts.join('\n');
    item.columns = parts.length;
    item.hasGeometry = true;
    item.edited = false;
  }

  async function ocrRecognize(item) {
    const base64 = await compressToBase64(item.file);
    return postOcr(base64);
  }

  async function postOcr(base64) {
    let resp;
    try {
      resp = await fetch(getApiBase(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 })
      });
    } catch (netErr) {
      throw new Error('无法连接识别服务，请检查网络或「接口地址」设置');
    }

    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      // 常见于：部署在纯静态托管（无后端），/api/ocr 返回了 404 页面
      throw new Error('识别接口不可用（当前部署没有后端）。请部署到 Vercel/Cloudflare，或在上方填写线上接口地址');
    }

    const data = await resp.json();
    if (!resp.ok || data.error) {
      throw new Error(data.error || ('服务异常 (' + resp.status + ')'));
    }
    return data;
  }

  // 上传前压缩：长边最大 2200px、JPEG 质量 0.85，
  // 既满足腾讯云 OCR 图片限制，也避开 serverless 请求体积上限
  function compressToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('图片解析失败'));
        img.onload = () => {
          const MAX = 2200;
          let { width: w, height: h } = img;
          if (Math.max(w, h) > MAX) {
            const scale = MAX / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          let quality = 0.85;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          // 目标：base64 体积控制在 3MB 以内
          while (dataUrl.length > 3 * 1024 * 1024 && quality > 0.4) {
            quality -= 0.15;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ---- 编辑同步 / 复制 / 导出 ----
  window.__ocrOnEdit = function (id, value) {
    const item = items.find(i => i.id === id);
    if (item) { item.text = value; item.edited = true; }
  };
  window.__ocrCopyOne = function (id) {
    const ta = document.getElementById(id + '_ta');
    if (ta) copyText(ta.value);
  };
  window.__ocrRawOne = function (id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const raw = item.rawText || '(无)';
    alert('OCR 原始物理行（未分栏重排）：\n\n' + raw);
  };

  // ---- 送去作文批改（单篇 / 全部） ----
  window.__ocrToEssay = function (id) {
    const ta = document.getElementById(id + '_ta');
    const item = items.find(i => i.id === id);
    const text = ta ? ta.value : (item ? item.text : '');
    sendToEssay(text, item ? item.file.name : '');
  };

  const sendEssayBtn = document.getElementById('ocrSendEssayBtn');
  if (sendEssayBtn) {
    sendEssayBtn.addEventListener('click', () => {
      const done = items.filter(i => i.text && i.text.trim());
      if (!done.length) { alert('还没有识别结果，请先上传并识别'); return; }
      // 单篇：直接送正文；多篇：带文件名分隔，方便老师逐篇核对
      const text = done.length === 1
        ? done[0].text
        : done.map(i => '【' + i.file.name + '】\n' + i.text).join('\n\n');
      sendToEssay(text, done.length === 1 ? done[0].file.name : done.length + ' 篇');
    });
  }

  function sendToEssay(text, sourceName) {
    if (!text || !text.trim()) { alert('这篇还没有识别结果'); return; }
    if (typeof window.essayReceiveText === 'function') {
      window.essayReceiveText(text, sourceName);
    } else {
      // 极端情况：essay 模块未加载，先暂存
      localStorage.setItem('essayPendingText', text);
      toast('已暂存，请打开「作文批改」查看');
    }
  }

  document.getElementById('ocrCopyAllBtn').addEventListener('click', () => {
    const all = collectAll();
    if (!all) { alert('还没有识别结果'); return; }
    copyText(all);
  });
  document.getElementById('ocrExportTxtBtn').addEventListener('click', () => exportAll('txt'));
  document.getElementById('ocrExportMdBtn').addEventListener('click', () => exportAll('md'));

  function collectAll() {
    return items.filter(i => i.text).map(i => '【' + i.file.name + '】\n' + i.text).join('\n\n');
  }

  function exportAll(type) {
    const all = collectAll();
    if (!all) { alert('还没有识别结果'); return; }
    const blob = new Blob([all], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '手写识别结果.' + type;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('已复制到剪贴板')).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('已复制到剪贴板'); } catch (e) { alert('复制失败，请手动选择'); }
    document.body.removeChild(ta);
  }
  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:10px 20px;border-radius:8px;z-index:10000;font-size:0.9rem;';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1500);
  }
}

renderOcr.init = initOcr;

// 暴露到全局，供作文批改模块内嵌调用
window.renderOcr = renderOcr;
window.renderOcrBody = renderOcrBody;
window.initOcr = initOcr;
