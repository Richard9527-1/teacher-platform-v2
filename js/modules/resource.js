// js/modules/resource.js
// ============================================================
// 教材资源中心 - 完整功能版（默认显示全部132篇）
// ============================================================

// ========== 全局状态 ==========
let currentTab = 'all';  // all / text / wenyan / poetry
let currentFilter = { grade: '', unit: '', type: '', keyword: '' };
let resourceCurrentPage = 1;    // 教材列表分页：当前页
const RESOURCE_PAGE_SIZE = 30;  // 每页卡片数（避免 130+ 篇一次性渲染卡顿）

// ========== 获取数据 ==========
function getResourceData(type) {
  const texts = window.SAMPLE_TEXTS || {};
  const items = [];
  Object.keys(texts).forEach(key => {
    const item = texts[key];
    if (type && item.type !== type) return;
    const filter = currentFilter;
    if (filter.grade && item.grade !== filter.grade) return;
    if (filter.unit && item.unit !== filter.unit) return;
    if (filter.keyword) {
      const kw = filter.keyword.toLowerCase();
      const match = key.toLowerCase().includes(kw) ||
                    (item.author || '').toLowerCase().includes(kw) ||
                    (item.original || '').toLowerCase().includes(kw);
      if (!match) return;
    }
    items.push({ ...item, title: key });
  });
  return items;
}

// ========== 详情完善度徽标 ==========
// 索引中 hasDetail=1 表示该篇已补齐七类详情数据（全文/拼音/注释/译文/讲解/赏析/考点）
function detailBadge(item) {
  if (item.hasDetail || item.fullText) {
    return '<span class="tag tag-success" style="margin-left:6px;vertical-align:middle;">✓ 已完善</span>';
  }
  return '<span class="tag tag-muted" style="margin-left:6px;vertical-align:middle;">待完善</span>';
}

// ========== 单卡片渲染（各列表共用） ==========
function resourceCardHtml(item) {
  let borderColor = '#4a6fa5';
  let tagBg = '#e8f0fe';
  if (item.type === '文言文') borderColor = '#17a2b8';
  else if (item.type === '古诗词') { borderColor = '#fd7e14'; tagBg = '#fff3e0'; }
  const cleanTitle = item.title.replace(/^\*\s*/, '');
  const safeTitle = item.title.replace(/'/g, "\\'");
  return `
    <div class="res-card" style="border-left-color:${borderColor};">
      <div style="font-weight:600;font-size:1rem;">${cleanTitle}${detailBadge(item)}</div>
      <div style="font-size:0.85rem;color:var(--text-light);">
        ${item.author || '佚名'} · ${item.dynasty || ''} · ${item.grade || ''}
        <span style="margin-left:8px;background:var(--bg);padding:1px 8px;border-radius:12px;font-size:0.75rem;">${item.type}</span>
      </div>
      <div style="font-size:0.8rem;color:var(--text-light);margin-top:4px;">
        ${item.tags ? item.tags.slice(0,3).map(t => `<span style="background:${tagBg};padding:1px 8px;border-radius:12px;margin:2px;">${t}</span>`).join('') : ''}
      </div>
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-sm" onclick="viewResource('${safeTitle}','${item.type}')">📖 查看</button>
        <button class="btn btn-success btn-sm" onclick="addToLesson('${safeTitle}')">📋 加入备课</button>
      </div>
    </div>`;
}

// ========== 分页渲染（列表共用） ==========
function renderPaginated(items) {
  if (items.length === 0) {
    return '<p class="empty">暂无数据，请调整筛选条件或添加教材资源。</p>';
  }
  const totalPages = Math.max(1, Math.ceil(items.length / RESOURCE_PAGE_SIZE));
  resourceCurrentPage = Math.min(Math.max(resourceCurrentPage, 1), totalPages);
  const start = (resourceCurrentPage - 1) * RESOURCE_PAGE_SIZE;
  const pageItems = items.slice(start, start + RESOURCE_PAGE_SIZE);
  let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">';
  pageItems.forEach(item => { html += resourceCardHtml(item); });
  html += '</div>';
  html += renderResourcePager(items.length, totalPages);
  return html;
}

function renderResourcePager(total, totalPages) {
  if (totalPages <= 1) return '';
  const cur = resourceCurrentPage;
  let from = Math.max(1, cur - 2);
  let to = Math.min(totalPages, from + 4);
  from = Math.max(1, to - 4);
  const pageBtn = (label, page, opts) => {
    opts = opts || {};
    if (opts.disabled) {
      return `<button class="btn" disabled style="padding:3px 10px;font-size:0.78rem;margin:2px;opacity:.45;cursor:not-allowed;">${label}</button>`;
    }
    const activeCls = opts.active ? ' active' : '';
    return `<button class="btn btn-sm${activeCls}" onclick="goResourcePage(${page})" style="margin:2px;">${label}</button>`;
  };
  let btns = '';
  btns += pageBtn('‹ 上一页', cur - 1, { disabled: cur <= 1 });
  for (let p = from; p <= to; p++) btns += pageBtn(String(p), p, { active: p === cur });
  btns += pageBtn('下一页 ›', cur + 1, { disabled: cur >= totalPages });
  return `<div style="display:flex;gap:2px;flex-wrap:wrap;align-items:center;justify-content:center;margin-top:18px;">${btns}<span style="font-size:0.78rem;color:var(--text-light);margin-left:8px;">第 ${cur}/${totalPages} 页 · 共 ${total} 条</span></div>`;
}

function goResourcePage(n) {
  resourceCurrentPage = n;
  refreshResourceView();
}

// ========== 四个分类列表（统一走分页渲染） ==========
function renderAllList() { return renderPaginated(getResourceData('')); }
function renderTextList() { return renderPaginated(getResourceData('课文')); }
function renderWenyanList() { return renderPaginated(getResourceData('文言文')); }
function renderPoetryList() { return renderPaginated(getResourceData('古诗词')); }

// ========== 查看详情（统一入口） ==========
function viewResource(title, type) {
  openDetail(title);
}
function viewWenyanDetail(title) {
  openDetail(title);
}
function viewPoetryDetail(title) {
  openDetail(title);
}

// 详情页运行状态
let detailState = { item: null, title: '', type: '', showPinyin: true, fontSize: 'md', currentTab: 'full', readTimer: null };

// 打开详情（右侧抽屉 + 标签页）
// 详情数据按分片懒加载，故为异步流程：先弹出面板占位，加载完成后再渲染内容
async function openDetail(title) {
  const texts = window.SAMPLE_TEXTS || {};
  const cleanTitle = title.replace(/^\*\s*/, '');
  let item = texts[title] || texts[cleanTitle];
  if (!item) { alert('找不到该篇目数据'); return; }
  const type = item.type || '课文';
  detailState = { item, title: cleanTitle, type, showPinyin: true, fontSize: 'md', currentTab: 'full', readTimer: null };

  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';
  overlay.id = 'detailOverlay';
  overlay.innerHTML = `
    <div class="detail-panel">
      <div class="detail-head">
        <div class="detail-title-wrap">
          <h2 class="detail-title">📖 ${htmlEncode(cleanTitle)}</h2>
          <div class="detail-meta">
            <span>${htmlEncode(item.author || '佚名')} · ${htmlEncode(item.dynasty || '')}</span>
            <span>${htmlEncode(item.grade || '')} ${htmlEncode(item.unit || '')}</span>
            <span>类型：${htmlEncode(type)}</span>
            ${item.背诵要求 && item.背诵要求 !== '无' ? `<span class="detail-recite">📌 ${htmlEncode(item.背诵要求)}</span>` : ''}
          </div>
        </div>
        <div class="detail-actions">
          <button class="detail-btn" id="detailReadBtn" title="语音朗读">🔊 朗读</button>
          <button class="detail-btn" id="detailCopyBtn" title="复制全文">📋 复制</button>
          <button class="detail-btn detail-btn-green" id="detailAddBtn" title="加入备课">➕ 备课</button>
          <button class="detail-btn detail-btn-close" id="detailCloseBtn" title="关闭">✕</button>
        </div>
      </div>
      <div class="detail-tabs" id="detailTabs">
        <span class="detail-tab active" data-tab="full">📄 全文</span>
        <span class="detail-tab" data-tab="pinyin">🔤 拼音</span>
        <span class="detail-tab" data-tab="notes">📝 注释</span>
        <span class="detail-tab" data-tab="translation">🌐 译文</span>
        <span class="detail-tab" data-tab="explain">💡 讲解</span>
        <span class="detail-tab" data-tab="appreciate">🎨 赏析</span>
        <span class="detail-tab" data-tab="exam">🎯 考点</span>
      </div>
      <div class="detail-body" id="detailBody">
        <div class="detail-loading">
          <div class="detail-loading-spin"></div>
          <p>正在载入篇目详情…</p>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // 遮罩点击关闭（仅点背景，而非面板）
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeDetail();
  });
  // Esc 关闭
  document.addEventListener('keydown', detailEscClose);

  bindDetailEvents();

  // 懒加载该篇所属详情分片
  if (typeof window.loadTextDetail === 'function' && item.fullText === undefined) {
    try {
      const loaded = await window.loadTextDetail(title);
      if (loaded) { item = loaded; detailState.item = loaded; }
    } catch (err) {
      console.warn('[resource] 详情加载失败：', err);
    }
    // 加载期间用户可能已关闭面板
    if (!document.getElementById('detailOverlay')) return;
  }

  switchDetailTab('full');
}

function detailEscClose(e) {
  if (e.key === 'Escape') closeDetail();
}

function closeDetail() {
  const overlay = document.getElementById('detailOverlay');
  if (overlay) overlay.remove();
  document.removeEventListener('keydown', detailEscClose);
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

function bindDetailEvents() {
  document.getElementById('detailCloseBtn').addEventListener('click', closeDetail);
  document.getElementById('detailReadBtn').addEventListener('click', detailToggleRead);
  document.getElementById('detailCopyBtn').addEventListener('click', detailCopyFull);
  document.getElementById('detailAddBtn').addEventListener('click', function() {
    addToLesson(detailState.title);
  });
  // 标签切换
  document.querySelectorAll('#detailTabs .detail-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      switchDetailTab(this.dataset.tab);
    });
  });
}

// 标签切换，渲染对应内容
function switchDetailTab(tab) {
  detailState.currentTab = tab;
  document.querySelectorAll('#detailTabs .detail-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  const body = document.getElementById('detailBody');
  if (!body) return;
  let html = '';
  switch (tab) {
    case 'full': html = renderDetailFull(); break;
    case 'pinyin': html = renderDetailPinyin(); break;
    case 'notes': html = renderDetailNotes(); break;
    case 'translation': html = renderDetailTranslation(); break;
    case 'explain': html = renderDetailExplain(); break;
    case 'appreciate': html = renderDetailAppreciate(); break;
    case 'exam': html = renderDetailExam(); break;
    default: html = renderDetailFull();
  }
  body.innerHTML = html;
  body.className = 'detail-body detail-fs-' + detailState.fontSize;
  body.scrollTop = 0;
}

// ---- 全文 ----
function renderDetailFull() {
  const item = detailState.item;
  const hasFull = !!item.fullText;
  const text = item.fullText || item.original || '暂无原文';
  const paras = splitParagraphs(text);
  const reciteAll = (item.背诵要求 && item.背诵要求 === '全文背诵');
  let pinyinBtn = '';
  // 字号调节
  const fsBtns = `
    <div class="detail-toolbar">
      <span class="detail-tool-label">字号：</span>
      <button class="fs-btn ${detailState.fontSize==='sm'?'active':''}" data-fs="sm">小</button>
      <button class="fs-btn ${detailState.fontSize==='md'?'active':''}" data-fs="md">中</button>
      <button class="fs-btn ${detailState.fontSize==='lg'?'active':''}" data-fs="lg">大</button>
      <button class="fs-btn ${detailState.fontSize==='xl'?'active':''}" data-fs="xl">特大</button>
      ${!hasFull ? `<span class="detail-warn">⚠️ 当前展示为节选，全文待补充</span>` : ''}
    </div>`;
  let content = paras.map(p =>
    `<p class="detail-para${reciteAll ? ' recite-all' : ''}">${htmlEncode(p)}</p>`
  ).join('');
  // 绑定字号按钮（事件委托在内容渲染后）
  setTimeout(() => {
    document.querySelectorAll('#detailBody .fs-btn').forEach(b => {
      b.addEventListener('click', function() {
        detailState.fontSize = this.dataset.fs;
        switchDetailTab('full');
      });
    });
  }, 0);
  // 按设置中心的「默认显示」开关，在全文下方内联追加注释/译文/考点
  const s = (typeof window.loadSettings === 'function') ? window.loadSettings() : {};
  let extra = '';
  if (s.showNotes && typeof renderDetailNotes === 'function') extra += `<div class="detail-inline">${renderDetailNotes()}</div>`;
  if (s.showTranslation && typeof renderDetailTranslation === 'function') extra += `<div class="detail-inline">${renderDetailTranslation()}</div>`;
  if (s.showExamPoints && typeof renderDetailExam === 'function') extra += `<div class="detail-inline">${renderDetailExam()}</div>`;
  return fsBtns + '<div class="detail-text">' + content + '</div>' + extra;
}

// ---- 拼音 ----
function renderDetailPinyin() {
  const item = detailState.item;
  const text = item.fullText || item.original || '暂无原文';
  const paras = splitParagraphs(text);
  let content = paras.map(p => {
    // 先标注拼音，再对重难点句子高亮
    const py = annotatePinyin(p, item.pinyinMap, detailState.showPinyin);
    return `<p class="detail-para py-para">${highlightHardSentences(py, item.hardSentences)}</p>`;
  }).join('');
  const toggle = `<div class="detail-toolbar">
      <span class="detail-tool-label">拼音标注：</span>
      <button class="fs-btn ${detailState.showPinyin?'active':''}" id="pyToggle">${detailState.showPinyin?'显示中':'已隐藏'}</button>
    </div>`;
  // 本篇拼音词表
  let wordList = '';
  const pm = item.pinyinMap || {};
  const keys = Object.keys(pm);
  if (keys.length) {
    wordList = `<div class="detail-sub"><strong>🔤 本篇注音词表</strong></div>
      <div class="py-wordlist">` +
      keys.map(k => `<span class="py-word">${htmlEncode(k)} <ruby class="py"><rt>${htmlEncode(pm[k])}</rt></ruby></span>`).join('') +
      `</div>`;
  }
  setTimeout(() => {
    const btn = document.getElementById('pyToggle');
    if (btn) btn.addEventListener('click', function() {
      detailState.showPinyin = !detailState.showPinyin;
      switchDetailTab('pinyin');
    });
  }, 0);
  return toggle + '<div class="detail-text">' + content + '</div>' + wordList;
}

// ---- 注释 ----
function renderDetailNotes() {
  const item = detailState.item;
  let html = '';
  if (item.notes && Object.keys(item.notes).length) {
    html += `<div class="detail-sub"><strong>📝 重点字词释义</strong></div><ul class="detail-notes">`;
    Object.keys(item.notes).forEach(k => {
      html += `<li><b>${htmlEncode(k)}</b>：<span>${htmlEncode(item.notes[k])}</span></li>`;
    });
    html += `</ul>`;
  }
  if (item.wenyan) {
    const w = item.wenyan;
    if (w.tongjia && w.tongjia.length) html += block('通假字', w.tongjia);
    if (w.gjyi && w.gjyi.length) html += block('古今异义', w.gjyi);
    if (w.cihuolei && w.cihuolei.length) html += block('词类活用', w.cihuolei);
    if (w.specialSentence && w.specialSentence.length) html += block('特殊句式', w.specialSentence);
    if (w.keyWords && w.keyWords.length) html += block('重点实词/虚词', w.keyWords);
  }
  if (!html) html = `<p class="detail-empty">📭 本篇暂未配置注释数据</p>`;
  return html;
}

function block(title, arr) {
  return `<div class="detail-sub"><strong>${title}</strong></div>
    <div class="detail-chips">${arr.map(x => `<span class="detail-chip">${htmlEncode(x)}</span>`).join('')}</div>`;
}

// ---- 译文 ----
function renderDetailTranslation() {
  const item = detailState.item;
  let html = '';
  if (item.translation) {
    const paras = splitParagraphs(item.translation);
    html += '<div class="detail-text">' + paras.map(p => `<p class="detail-para">${htmlEncode(p)}</p>`).join('') + '</div>';
  } else if (item.hardSentences && item.hardSentences.length) {
    html += `<div class="detail-sub"><strong>🌐 重点句翻译</strong></div>`;
    item.hardSentences.forEach(h => {
      if (h.translation) {
        html += `<div class="tr-row"><div class="tr-src">${htmlEncode(h.sentence)}</div><div class="tr-dst">${htmlEncode(h.translation)}</div></div>`;
      }
    });
    if (!html.includes('tr-row')) html = `<p class="detail-empty">📭 本篇暂未配置译文数据</p>`;
  } else {
    html = `<p class="detail-empty">📭 本篇暂未配置译文数据</p>`;
  }
  return html;
}

// ---- 讲解（重难点句子） ----
function renderDetailExplain() {
  const item = detailState.item;
  const hs = item.hardSentences || [];
  if (!hs.length) return `<p class="detail-empty">📭 本篇暂未配置重难点句子讲解</p>`;
  let html = `<div class="detail-sub"><strong>💡 重难点句子讲解（${hs.length} 句）</strong></div>`;
  hs.forEach((h, i) => {
    html += `<div class="hard-card">
      <div class="hard-sentence">${i+1}. ${htmlEncode(h.sentence || '')}</div>
      ${h.translation ? `<div class="hard-row"><span class="hard-label">译</span>${htmlEncode(h.translation)}</div>` : ''}
      ${h.explanation ? `<div class="hard-row"><span class="hard-label">析</span>${htmlEncode(h.explanation)}</div>` : ''}
      ${h.tags && h.tags.length ? `<div class="hard-tags">${h.tags.map(t => `<span class="hard-tag">${htmlEncode(t)}</span>`).join('')}</div>` : ''}
    </div>`;
  });
  return html;
}

// ---- 赏析 ----
function renderDetailAppreciate() {
  const item = detailState.item;
  let html = '';
  if (item.appreciation) {
    const a = item.appreciation;
    if (a.theme) html += `<div class="detail-sub"><strong>🎯 主题思想</strong></div><p class="detail-para">${htmlEncode(a.theme)}</p>`;
    if (a.structure) html += `<div class="detail-sub"><strong>🧩 结构思路</strong></div><p class="detail-para">${htmlEncode(a.structure)}</p>`;
    if (a.features && a.features.length) html += block('✨ 艺术特色', a.features);
    if (a.famousLines && a.famousLines.length) html += block('⭐ 名句赏析', a.famousLines);
  }
  if (!html) {
    // 降级：用重点/考点组合
    let fb = '';
    if (item.keyPoints && item.keyPoints.length) fb += block('🎯 学习重点', item.keyPoints);
    if (item.examPoints && item.examPoints.length) fb += block('📝 常见考点', item.examPoints);
    if (fb) html = fb;
    else html = `<p class="detail-empty">📭 本篇暂未配置赏析数据</p>`;
  }
  return html;
}

// ---- 考点 ----
function renderDetailExam() {
  const item = detailState.item;
  let html = '';
  if (item.examFocus) {
    const e = item.examFocus;
    if (e.dictation && e.dictation.length) {
      html += `<div class="detail-sub"><strong>📝 默写名句（${e.dictation.length}）</strong></div><ul class="detail-dictation">`;
      e.dictation.forEach(d => { html += `<li>${htmlEncode(d)}</li>`; });
      html += `</ul>`;
    }
    if (e.questionTypes && e.questionTypes.length) html += block('📋 常见题型', e.questionTypes);
  }
  if (!html) {
    let fb = '';
    if (item.examPoints && item.examPoints.length) fb += block('📝 常见考点', item.examPoints);
    if (item.keyPoints && item.keyPoints.length) fb += block('🎯 学习重点', item.keyPoints);
    if (fb) html = fb;
    else html = `<p class="detail-empty">📭 本篇暂未配置考点数据</p>`;
  }
  return html;
}

// 朗读（复用浏览器 TTS）
function detailToggleRead() {
  const item = detailState.item;
  const text = item.fullText || item.original || '';
  if (!text) { alert('没有可朗读的文本'); return; }
  const btn = document.getElementById('detailReadBtn');
  if (!window.speechSynthesis) { alert('当前浏览器不支持语音朗读'); return; }
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    btn.textContent = '🔊 朗读';
    return;
  }
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-CN';
  utter.rate = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const zh = voices.find(v => v.lang && v.lang.startsWith('zh'));
  if (zh) utter.voice = zh;
  utter.onend = function() { btn.textContent = '🔊 朗读'; };
  window.speechSynthesis.speak(utter);
  btn.textContent = '⏹ 停止';
}

// 复制全文
function detailCopyFull() {
  const item = detailState.item;
  const text = item.fullText || item.original || '';
  if (!text) { alert('没有可复制的内容'); return; }
  const full = `《${detailState.title}》\n${item.author || ''}\n\n${text}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(full).then(() => {
      alert('✅ 全文已复制到剪贴板');
    }).catch(() => {
      fallbackCopy(full);
    });
  } else {
    fallbackCopy(full);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); alert('✅ 全文已复制到剪贴板'); }
  catch(e) { alert('复制失败，请手动选择'); }
  document.body.removeChild(ta);
}

// ========== 加入备课中心 ==========
function addToLesson(title) {
  const tasks = JSON.parse(localStorage.getItem('lessonTasks') || '[]');
  if (tasks.some(t => t.title === title)) {
    alert(`⚠️ 《${title}》已经在备课中心中`);
    return;
  }
  const texts = window.SAMPLE_TEXTS || {};
  const item = texts[title];
  if (!item) { alert('找不到该篇目数据'); return; }
  tasks.push({
    id: 'task_' + Date.now(),
    title: title,
    type: item.type || '课文',
    grade: item.grade || '高一',
    classes: ['全年级'],
    deadline: new Date(Date.now() + 7*24*60*60*1000).toISOString().slice(0,10),
    classTime: new Date(Date.now() + 7*24*60*60*1000 + 8*60*60*1000).toISOString().slice(0,16),
    priority: '普通',
    status: '待备课',
    materials: [title],
    note: `来自教材资源：${item.author || ''}，标签：${(item.tags || []).join('、')}`,
    draft: item.original ? `原文：\n${item.original.substring(0,100)}...` : '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    archived: false
  });
  localStorage.setItem('lessonTasks', JSON.stringify(tasks));
  window.dispatchEvent(new Event('taskUpdated'));
  alert(`✅ 《${title}》已加入备课中心，状态：待备课`);
}

// ========== 刷新视图 ==========
function refreshResourceView() {
  const content = document.getElementById('resourceContent');
  if (!content) return;
  if (currentTab === 'all') content.innerHTML = renderAllList();
  else if (currentTab === 'text') content.innerHTML = renderTextList();
  else if (currentTab === 'wenyan') content.innerHTML = renderWenyanList();
  else if (currentTab === 'poetry') content.innerHTML = renderPoetryList();
  else content.innerHTML = renderAllList();
  updateCount();
}

function updateCount() {
  const el = document.getElementById('resultCount');
  if (!el) return;
  let items = [];
  if (currentTab === 'all') items = getResourceData('');
  else if (currentTab === 'text') items = getResourceData('课文');
  else if (currentTab === 'wenyan') items = getResourceData('文言文');
  else if (currentTab === 'poetry') items = getResourceData('古诗词');
  else items = getResourceData('');
  el.textContent = `共 ${items.length} 条`;
}

// ========== 主渲染 ==========
function renderResource() {
  return `
    <div class="card">
      <div class="panel-head"><h2 class="panel-title">📁 教材资源中心</h2></div>
      <div class="toolbar" style="flex-wrap:nowrap;overflow-x:auto;">
        <button class="btn btn-sm active" id="tabAll">📚 全部</button>
        <button class="btn btn-sm btn-secondary" id="tabText">📖 课文</button>
        <button class="btn btn-sm btn-secondary" id="tabWenyan">📜 文言文</button>
        <button class="btn btn-sm btn-secondary" id="tabPoetry">📝 古诗词</button>
        <button class="btn btn-sm btn-secondary" id="tabExport">📥 导出</button>
        <select id="filterGrade" class="da-select">
          <option value="">年级</option>
          <option value="高一">高一</option>
          <option value="高二">高二</option>
          <option value="高三">高三</option>
        </select>
        <select id="filterUnit" class="da-select">
          <option value="">单元</option>
          <option value="第一单元">第一单元</option>
          <option value="第二单元">第二单元</option>
          <option value="第三单元">第三单元</option>
          <option value="第六单元">第六单元</option>
          <option value="第七单元">第七单元</option>
          <option value="第八单元">第八单元</option>
          <option value="古诗词诵读">古诗词诵读</option>
        </select>
        <select id="filterType" class="da-select">
          <option value="">类型</option>
          <option value="课文">课文</option>
          <option value="文言文">文言文</option>
          <option value="古诗词">古诗词</option>
        </select>
        <button class="btn btn-sm" id="filterBtn">筛选</button>
        <button class="btn btn-sm btn-secondary" id="resetFilterBtn">重置</button>
        <span style="color:var(--text-light);font-size:0.75rem;white-space:nowrap;margin-left:auto;" id="resultCount">共0条</span>
      </div>
      <div id="resourceContent" style="background:var(--bg);padding:16px;border-radius:8px;min-height:300px;">
        ${renderAllList()}
      </div>
    </div>
  `;
}

// ========== 初始化 ==========
function initResource() {
  // 标签切换
  document.getElementById('tabAll').addEventListener('click', function() {
    currentTab = 'all';
    resourceCurrentPage = 1;
    setActiveTab(this);
    document.getElementById('resourceContent').innerHTML = renderAllList();
    document.getElementById('filterType').value = '';
    updateCount();
  });
  document.getElementById('tabText').addEventListener('click', function() {
    currentTab = 'text';
    resourceCurrentPage = 1;
    setActiveTab(this);
    document.getElementById('resourceContent').innerHTML = renderTextList();
    document.getElementById('filterType').value = '课文';
    updateCount();
  });
  document.getElementById('tabWenyan').addEventListener('click', function() {
    currentTab = 'wenyan';
    resourceCurrentPage = 1;
    setActiveTab(this);
    document.getElementById('resourceContent').innerHTML = renderWenyanList();
    document.getElementById('filterType').value = '文言文';
    updateCount();
  });
  document.getElementById('tabPoetry').addEventListener('click', function() {
    currentTab = 'poetry';
    resourceCurrentPage = 1;
    setActiveTab(this);
    document.getElementById('resourceContent').innerHTML = renderPoetryList();
    document.getElementById('filterType').value = '古诗词';
    updateCount();
  });

  // 新增篇目功能暂未开放（见优化清单 #8：要么实现要么隐藏入口，本次选择隐藏）

  // 导出（详情为懒加载，导出前先拉全所有分片，保证备份完整）
  document.getElementById('tabExport').addEventListener('click', async function() {
    const btn = this;
    const originText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ 正在汇总…';
    try {
      if (typeof window.loadAllTextDetails === 'function') {
        await window.loadAllTextDetails();
      }
      const data = window.SAMPLE_TEXTS || {};
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `教材资源备份_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      const total = Object.keys(data).length;
      const detailed = Object.keys(data).filter(k => data[k].fullText).length;
      alert(`✅ 数据已导出！\n\n共 ${total} 篇，其中 ${detailed} 篇含完整详情。`);
    } catch (err) {
      console.warn('[resource] 导出失败：', err);
      alert('❌ 导出失败，请重试。');
    } finally {
      btn.disabled = false;
      btn.textContent = originText;
    }
  });


  // 筛选
  document.getElementById('filterBtn').addEventListener('click', function() {
    currentFilter.grade = document.getElementById('filterGrade').value;
    currentFilter.unit = document.getElementById('filterUnit').value;
    // 根据筛选下拉框更新类型筛选
    const typeVal = document.getElementById('filterType').value;
    if (typeVal === '课文') { currentTab = 'text'; }
    else if (typeVal === '文言文') { currentTab = 'wenyan'; }
    else if (typeVal === '古诗词') { currentTab = 'poetry'; }
    else { currentTab = 'all'; }
    resourceCurrentPage = 1;
    refreshResourceView();
    // 更新标签高亮
    const activeTabId = currentTab === 'all' ? 'tabAll' : currentTab === 'text' ? 'tabText' : currentTab === 'wenyan' ? 'tabWenyan' : 'tabPoetry';
    setActiveTab(document.getElementById(activeTabId));
  });

  document.getElementById('resetFilterBtn').addEventListener('click', function() {
    document.getElementById('filterGrade').value = '';
    document.getElementById('filterUnit').value = '';
    document.getElementById('filterType').value = '';
    currentFilter = { grade: '', unit: '', type: '', keyword: '' };
    currentTab = 'all';
    resourceCurrentPage = 1;
    refreshResourceView();
    setActiveTab(document.getElementById('tabAll'));
  });

  function setActiveTab(activeBtn) {
    document.querySelectorAll('#tabAll, #tabText, #tabWenyan, #tabPoetry').forEach(b => {
      b.classList.remove('active');
    });
    activeBtn.classList.add('active');
  }

  // 默认显示全部
  currentTab = 'all';
  document.getElementById('tabAll').classList.add('active');
  updateCount();
}

// ========== 暴露到全局 ==========
window.renderResource = renderResource;
window.initResource = initResource;
window.viewResource = viewResource;
window.viewWenyanDetail = viewWenyanDetail;
window.viewPoetryDetail = viewPoetryDetail;
window.addToLesson = addToLesson;
window.refreshResourceView = refreshResourceView;
window.goResourcePage = goResourcePage;