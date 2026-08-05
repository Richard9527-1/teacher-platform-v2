function getStorage(key, defaultVal) {
  if (defaultVal === undefined) defaultVal = null;
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : defaultVal;
  } catch { return defaultVal; }
}
function setStorage(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}
function formatDate(d) {
  const date = new Date(d);
  return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
}

// ========== 教材资源详情页通用工具 ==========

// HTML 转义，防止原文中的特殊字符破坏结构
function htmlEncode(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 判断是否为汉字（含扩展A区）
function isHanChar(ch) {
  return /[一-龥豈-﫿]/.test(ch);
}

// 将文本按换行/空行分段，返回段落数组
function splitParagraphs(text) {
  if (!text) return [];
  return String(text)
    .split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

// 生僻字拼音自动标注
// text: 原文；pinyinMap: 篇目级拼音表（优先）；showPinyin: 是否输出拼音
// 返回 HTML 字符串（含 <ruby> 标注）
function annotatePinyin(text, pinyinMap, showPinyin) {
  if (!text) return '';
  const map = Object.assign({}, window.COMMON_PINYIN || {}, pinyinMap || {});
  let html = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    // 非汉字：标点、空白、数字、字母等原样输出（转义）
    if (!isHanChar(ch)) {
      html += htmlEncode(ch);
      i++;
      continue;
    }
    // 优先尝试 2 字词语匹配（拼音表中有多字词时）
    let key = text.substr(i, 2);
    let py = map[key];
    let wordLen = key.length;
    if (!py) {
      key = text.substr(i, 1);
      py = map[key];
      wordLen = 1;
    }
    if (py && showPinyin) {
      html += '<ruby class="py">' + htmlEncode(key) + '<rt>' + htmlEncode(py) + '</rt></ruby>';
      i += wordLen;
    } else {
      html += htmlEncode(ch);
      i++;
    }
  }
  return html;
}

// 在原文 HTML 中，对重难点句子所在片段做高亮包裹
// 通过 hardSentences 中的 sentence 进行字符串匹配
function highlightHardSentences(htmlText, hardSentences) {
  if (!hardSentences || !hardSentences.length) return htmlText;
  let result = htmlText;
  hardSentences.forEach((h, idx) => {
    const s = (h.sentence || '').trim();
    if (!s) return;
    // 转义用于正则
    const esc = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(esc, 'g');
    result = result.replace(re, match => {
      return '<span class="hard-hl" data-hard="' + idx + '">' + match + '</span>';
    });
  });
  return result;
}

// 简单提取名句（取长度适中的关键句）
function extractFamousLines(text, max) {
  const paras = splitParagraphs(text);
  const lines = [];
  paras.forEach(p => {
    // 按逗号/句号切分短句
    const parts = p.split(/[，。；；！？、]/).map(s => s.trim()).filter(s => s.length >= 4);
    parts.forEach(s => { if (lines.length < (max || 30)) lines.push(s); });
  });
  return lines;
}