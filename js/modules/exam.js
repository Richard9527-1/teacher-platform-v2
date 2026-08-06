// js/modules/exam.js
// ============================================================
// 试卷中心 - 批量组卷 + 主观题 + 导出Word
// P1 重构：选择题真阅读化 / 多选题 / 翻译采分点 / 赏析·主观去模板化 /
//          现代文阅读题型 / 默写双模式（直接 + 理解性）
// 富数据来源：detail-*.js 的 appreciation / hardSentences[].explanation /
//            examFocus / notes / wenyan（经 text-loader 合并进 SAMPLE_TEXTS）
// ============================================================

let currentQuestions = [];
let currentPaper = null;
let allTexts = [];

// ========== P2：试卷持久化与单题微调（存储/收藏状态） ==========
const PAPER_STORE_KEY = 'teacher_exam_papers_v1';
const FAV_KEY = 'teacher_exam_favs_v1';
let favSet = new Set();

function genPaperId() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// localStorage 在浏览器可用；VM 校验时可能缺失，做容错
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { console.error('[exam] 本地存储失败：', e); return false; } }

// —— 收藏夹 ——
function getFavs() { try { return JSON.parse(lsGet(FAV_KEY)) || []; } catch (e) { return []; } }
function setFavs(a) { lsSet(FAV_KEY, JSON.stringify(a)); favSet = new Set(a.map(x => x.id)); }
function toggleFav(uid, paper) {
  const target = paper || currentPaper;
  const a = getFavs();
  const i = a.findIndex(x => x.id === uid);
  if (i >= 0) { a.splice(i, 1); }
  else {
    const f = findQInPaper(target, uid);
    if (!f) return;
    a.push({ id: uid, q: JSON.parse(JSON.stringify(f.q)), fromName: target.name || '未命名试卷', addedAt: new Date().toISOString() });
  }
  setFavs(a);
}

// —— 试卷历史（localStorage） ——
function getPaperStore() { try { return JSON.parse(lsGet(PAPER_STORE_KEY)) || []; } catch (e) { return []; } }
function setPaperStore(a) { lsSet(PAPER_STORE_KEY, JSON.stringify(a)); }
function savePaperToStore(paper, name, asCopy) {
  const store = getPaperStore();
  const id = (!asCopy && paper._id) ? paper._id : genPaperId();
  paper._id = id;
  const clone = JSON.parse(JSON.stringify(paper));
  clone._id = id; clone.name = name; clone.savedAt = new Date().toISOString();
  clone.summary = paperSummary(clone);
  const ex = store.findIndex(r => r._id === id);
  if (ex >= 0) store[ex] = clone; else store.unshift(clone);
  setPaperStore(store);
  return clone;
}
function renderHistoryInto(box) {
  if (!box) return;
  const store = getPaperStore();
  if (!store.length) {
    box.innerHTML = '<div style="background:var(--card-bg);padding:14px 16px;border-radius:8px;color:var(--text-light);font-size:0.85rem;">📂 暂无保存的试卷。组卷后点击「💾 保存试卷」即可在此复用与二次编辑。</div>';
    return;
  }
  box.innerHTML = `<div style="font-weight:600;margin-bottom:8px;">📂 我的试卷（${store.length}）</div>` + store.map(rec => {
    const meta = rec.meta || {};
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--card-bg);padding:10px 12px;border:1px solid #eee;border-radius:8px;margin-bottom:8px;">
      <div style="min-width:0;flex:1;">
        <b style="font-size:0.92rem;">${escapeHtml(rec.name || '未命名')}</b>
        <div style="font-size:0.76rem;color:var(--text-light);margin-top:2px;">${escapeHtml(rec.summary || '')} · ${meta.generatedCount || 0}题 / ${meta.totalScore || 0}分 · 保存于 ${escapeHtml((rec.savedAt || '').slice(0, 10))}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="btn btn-info hist-load" data-id="${rec._id}">打开</button>
        <button class="btn btn-success hist-word" data-id="${rec._id}">Word</button>
        <button class="btn btn-secondary hist-json" data-id="${rec._id}">JSON</button>
        <button class="da-link-danger hist-del" data-id="${rec._id}">删除</button>
      </div>
    </div>`;
  }).join('');
}
function renderFavPanelInto(p) {
  if (!p) return;
  const favs = getFavs();
  if (!favs.length) { p.innerHTML = '<div style="padding:12px;color:var(--text-light);font-size:0.85rem;">暂无收藏的题目。在题目下方点「☆ 收藏」即可加入收藏夹。</div>'; return; }
  const toolbar = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
    <button class="btn btn-info fav-insert-all">＋ 全部插入当前试卷</button>
    <button class="da-link-danger fav-clear">🗑 清空收藏夹</button>
  </div>`;
  p.innerHTML = toolbar + favs.map(f => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;background:var(--card-bg);border:1px solid #eee;border-radius:8px;margin-bottom:8px;">
    <div style="flex:1;min-width:0;"><b style="font-size:0.85rem;">${escapeHtml(f.q.type || '题')}${f.q.mode === '理解性' ? '（理解性）' : ''}</b> <span style="font-size:0.72rem;color:var(--text-light);">来自 ${escapeHtml(f.fromName || '')}</span><div style="font-size:0.8rem;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(f.q.question || '')}</div></div>
    <div style="display:flex;gap:6px;flex-shrink:0;">
      <button class="da-link fav-insert" data-id="${f.id}">＋ 插入试卷</button>
      <button class="da-link-danger fav-remove" data-id="${f.id}">移出</button>
    </div>
  </div>`).join('');
}

// —— 单题微调：在试卷对象内定位/增删/调序/替换 ——
function ensurePaperUids(paper) {
  if (!paper || !Array.isArray(paper.sections)) return;
  paper.sections.forEach(sec => (sec.questions || []).forEach(q => { if (!q._uid) q._uid = genPaperId(); }));
}
function findQInPaper(paper, uid) {
  if (!paper || !Array.isArray(paper.sections)) return null;
  for (const sec of paper.sections) {
    const qs = sec.questions || [];
    const idx = qs.findIndex(q => q._uid === uid);
    if (idx >= 0) return { sec, idx, q: qs[idx] };
  }
  return null;
}
function recomputePaper(paper) {
  if (!paper || !Array.isArray(paper.sections)) return;
  let totalScore = 0, gen = 0, req = 0;
  paper.sections.forEach((sec, si) => {
    const qs = sec.questions || [];
    sec.generated = qs.length;
    sec.label = `第${cnNum(si + 1)}大题　${typeLabelOf(sec.type)}（每小题${sec.score || 0}分，共${(sec.score || 0) * qs.length}分）`;
    totalScore += (sec.score || 0) * qs.length;
    gen += qs.length;
    req += (sec.requested != null ? sec.requested : qs.length);
  });
  if (!paper.meta) paper.meta = {};
  paper.meta.totalScore = totalScore;
  paper.meta.generatedCount = gen;
  paper.meta.totalCount = req;
}
function deleteQuestionInPaper(paper, uid) {
  const f = findQInPaper(paper, uid);
  if (!f) return false;
  f.sec.questions.splice(f.idx, 1);
  recomputePaper(paper);
  return true;
}
function moveQuestionInPaper(paper, uid, dir) {
  const f = findQInPaper(paper, uid);
  if (!f) return false;
  const qs = f.sec.questions;
  const ni = f.idx + dir;
  if (ni < 0 || ni >= qs.length) return false;
  const tmp = qs[f.idx]; qs[f.idx] = qs[ni]; qs[ni] = tmp;
  return true;
}
function replaceQuestionInPaper(paper, uid) {
  const f = findQInPaper(paper, uid);
  if (!f) return false;
  const src = paper._srcTexts || [];
  if (!src.length) return false;
  const type = f.sec.type;
  const clozeMode = paper._clozeMode || 'direct';
  const qs = generateSectionQuestions(src, type, 4, clozeMode);
  const valid = qs.filter(q => q && !q.error);
  if (!valid.length) return false;
  const existing = (f.sec.questions || []).map(q => q.question);
  const pick = valid.find(q => !existing.includes(q.question)) || valid[0];
  if (!pick._uid) pick._uid = genPaperId();
  f.sec.questions[f.idx] = pick;
  recomputePaper(paper);
  return true;
}
function insertFavIntoPaper(paper, favId) {
  const a = getFavs();
  const f = a.find(x => x.id === favId);
  if (!f) return false;
  const q = JSON.parse(JSON.stringify(f.q));
  if (!q._uid) q._uid = genPaperId();
  let sec = (paper.sections || []).find(s => s.type === q.type);
  if (!sec) {
    sec = { type: q.type, score: 3, requested: 0, generated: 0, label: '', questions: [] };
    paper.sections = paper.sections || [];
    paper.sections.push(sec);
  }
  sec.questions.push(q);
  recomputePaper(paper);
  return true;
}

function showToast(msg) {
  let el = document.getElementById('examToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'examToast';
    el.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);background:rgba(0,0,0,.82);color:#fff;padding:10px 18px;border-radius:8px;font-size:0.9rem;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.3);transition:opacity .3s;pointer-events:none;';
    document.body.appendChild(el);
  }
  el.textContent = msg; el.style.opacity = '1';
  clearTimeout(el._t); el._t = setTimeout(function () { el.style.opacity = '0'; }, 1800);
}

function loadSavedPaper(id) {
  const store = getPaperStore();
  const rec = store.find(r => r._id === id);
  if (!rec) return;
  currentPaper = JSON.parse(JSON.stringify(rec));
  ensurePaperUids(currentPaper);
  const rd = document.getElementById('examResult');
  if (rd) { rd.style.display = 'block'; rd.innerHTML = renderQuestions(currentPaper); rd.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}
function deleteSavedPaper(id) {
  const store = getPaperStore().filter(r => r._id !== id);
  setPaperStore(store);
  renderHistoryInto(document.getElementById('paperHistory'));
  showToast('已删除该试卷');
}


// 获取所有课文名称（去掉前面的*号）
function getAllTextNames() {
  const texts = window.SAMPLE_TEXTS || {};
  return Object.keys(texts).map(name => name.replace(/^\*\s*/, ''));
}

// 兼容带 * 前缀的键名，解析出【索引条目】与【清洗后的显示名】
function lookupText(name) {
  const texts = window.SAMPLE_TEXTS || {};
  if (texts[name]) return { key: name, display: name.replace(/^\*\s*/, ''), item: texts[name] };
  const clean = String(name).replace(/^\*\s*/, '');
  if (texts[clean]) return { key: clean, display: clean, item: texts[clean] };
  if (texts['*' + clean]) return { key: '*' + clean, display: clean, item: texts['*' + clean] };
  return null;
}

// 取篇目语料：详情补齐后用 fullText（全文），否则回退 original（节选）
function corpusOf(item) {
  return (item && item.fullText && item.fullText.trim()) ? item.fullText : (item && item.original) || '';
}

// ========== 通用工具 ==========
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pickN(arr, n) {
  return shuffle(arr).slice(0, Math.max(0, n));
}
// 字段归一化：详情数据中 features/famousLines/dictation 部分条目为整段字符串，
// 描述型字段（features/famousLines）整段作为单项；dictation 按换行/顿号拆成多句。
function asArr(x, splitLines) {
  if (Array.isArray(x)) return x;
  if (typeof x === 'string') {
    if (splitLines) {
      const parts = x.split(/[\n、，,；;]/).map(s => s.trim()).filter(Boolean);
      return parts.length ? parts : [x];
    }
    return [x];
  }
  return [];
}
// 同单元 / 同年级的"易混点"篇目（用于生成合理干扰项，而非随机作者）
function peersOf(item) {
  const texts = window.SAMPLE_TEXTS || {};
  const sameUnit = [], sameGrade = [], others = [];
  Object.keys(texts).forEach(k => {
    const t = texts[k];
    if (!t || t === item) return;
    if (t.unit && t.unit === item.unit && t.grade === item.grade) sameUnit.push(t);
    else if (t.grade === item.grade) sameGrade.push(t);
    else others.push(t);
  });
  const base = sameUnit.length >= 3 ? sameUnit : sameUnit.concat(sameGrade);
  return base.length >= 3 ? base : base.concat(others);
}
// 取包含某词的原句片段（用于文言实词题给出语境）
function sentenceContaining(corpus, word) {
  if (!corpus || !word) return '';
  const idx = corpus.indexOf(word);
  if (idx === -1) return '';
  let s = idx;
  while (s > 0 && !/[。！？；]/.test(corpus[s - 1])) s--;
  let e = Math.min(corpus.length, idx + word.length);
  while (e < corpus.length && !/[。！？；]/.test(corpus[e])) e++;
  return corpus.slice(s, e);
}

// ========== 作者字典（知人论世） ==========
// 字典本体已抽离至 data/authors-data.js（window.AUTHOR_INFO），便于维护扩展。
function buildAuthorInfo(author, dynasty) {
  const D = window.AUTHOR_INFO || {};
  if (D[author]) return D[author];
  const role = dynasty && /^(先秦|汉|三国|两晋|南北朝|隋|唐|宋|元|明|清)/.test(dynasty) ? '古代文学家' : '现当代作家';
  return `${author}，${dynasty || ''}时期${role}，其作品思想与艺术个性鲜明，具有较高的文学与认识价值。`;
}

// ========== P2：套卷结构辅助 ==========
// 难度（按年级派生）：高一=基础，高二=提高，高三=培优
function difficultyOf(grade) {
  const map = { '高一': '基础', '高二': '提高', '高三': '培优' };
  return map[grade] || null;
}
// 年级排序（高一<高二<高三，其余按字典序）
function sortGrades(grades) {
  const order = { '高一': 1, '高二': 2, '高三': 3 };
  return grades.slice().sort((a, b) => ((order[a] || 99) - (order[b] || 99)) || (a < b ? -1 : 1));
}
// 从索引动态提取年级/单元/难度，供筛选器使用
function getTextMeta() {
  const texts = window.SAMPLE_TEXTS || {};
  const grades = new Set(), units = new Set(), diffs = new Set();
  Object.keys(texts).forEach(k => {
    const t = texts[k];
    if (t.grade) grades.add(t.grade);
    if (t.unit) units.add(t.unit);
    const d = difficultyOf(t.grade);
    if (d) diffs.add(d);
  });
  return { grades: sortGrades([...grades]), units: [...units].sort(), difficulties: [...diffs] };
}
// 题型友好标签
function typeLabelOf(t) {
  return {
    '选择题': '选择题（单选）', '多选题': '选择题（多选）', '默写': '默写（双模式）',
    '翻译': '翻译', '赏析': '赏析', '主观题': '主观题（结合考点）', '现代文阅读': '现代文阅读'
  }[t] || t;
}
// 中文数字（1..10）
function cnNum(n) {
  const arr = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  return arr[n] || String(n);
}
// 生成"试卷结构"单行 HTML
function sectionRowHtml(idx, selectedType, count, score) {
  const types = ['选择题', '多选题', '默写', '翻译', '赏析', '主观题', '现代文阅读'];
  const opts = types.map(t => `<option value="${t}"${t === selectedType ? ' selected' : ''}>${typeLabelOf(t)}</option>`).join('');
  return `<div class="paper-section-row" data-idx="${idx}" style="background:var(--card-bg);border:1px solid rgba(0,0,0,0.08);border-radius:8px;padding:12px;margin-bottom:10px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;">
      <select class="secType" style="flex:1;min-width:120px;padding:7px 8px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);font-weight:500;">${opts}</select>
      <button type="button" class="da-link-danger secDel">✕ 删除</button>
    </div>
    <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:0.85rem;color:var(--text-light);white-space:nowrap;">题量</span>
        <input type="number" class="secCount" min="1" max="15" value="${count}" style="width:60px;padding:6px 8px;border-radius:6px;border:1px solid #ddd;text-align:center;" />
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:0.85rem;color:var(--text-light);white-space:nowrap;">每题分值</span>
        <input type="number" class="secScore" min="0" value="${score}" style="width:60px;padding:6px 8px;border-radius:6px;border:1px solid #ddd;text-align:center;" />
      </div>
    </div>
  </div>`;
}

// ========== 渲染主界面 ==========
function renderExam() {
  const textNames = getAllTextNames();
  const textOptions = textNames.map(k => `<option value="${k}">${k}</option>`).join('');
  const meta = getTextMeta();
  const gradeOpts = ['全部'].concat(meta.grades).map(g => `<option value="${g}">${g}</option>`).join('');
  const unitOpts = ['全部'].concat(meta.units).map(u => `<option value="${u}">${u}</option>`).join('');
  const diffOpts = ['全部'].concat(meta.difficulties).map(d => `<option value="${d}">${d}</option>`).join('');

  const defaultSections = [
    { type: '选择题', count: 10, score: 3 },
    { type: '默写', count: 6, score: 5 },
    { type: '赏析', count: 2, score: 10 }
  ];
  const sectionRows = defaultSections.map((s, i) => sectionRowHtml(i, s.type, s.count, s.score)).join('');
  const initCount = defaultSections.reduce((s, x) => s + x.count, 0);
  const initScore = defaultSections.reduce((s, x) => s + x.count * x.score, 0);

  const chipHtml = textNames.map(k => `<button type="button" class="text-chip" data-value="${k}" style="min-width:0;padding:8px 12px;font-size:0.85rem;cursor:pointer;text-align:center;transition:all .15s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${k}</button>`).join('');

  return `
    <div class="card">
      <div class="panel-head"><h2 class="panel-title">📋 高考题库与智能组卷</h2></div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:20px;align-items:stretch;">
        <!-- 左列：筛选与课文 -->
        <div style="display:flex;flex-direction:column;">
          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;margin-bottom:14px;">
            <div>
              <label style="display:block;font-size:0.85rem;margin-bottom:4px;color:var(--text-light);">年级筛选</label>
              <select id="examGradeFilter" style="width:100%;padding:7px 10px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);">${gradeOpts}</select>
            </div>
            <div>
              <label style="display:block;font-size:0.85rem;margin-bottom:4px;color:var(--text-light);">单元筛选</label>
              <select id="examUnitFilter" style="width:100%;padding:7px 10px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);">${unitOpts}</select>
            </div>
            <div>
              <label style="display:block;font-size:0.85rem;margin-bottom:4px;color:var(--text-light);">难度筛选</label>
              <select id="examDiffFilter" style="width:100%;padding:7px 10px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);">${diffOpts}</select>
              <div style="font-size:0.7rem;color:var(--text-light);margin-top:3px;">高一=基础 / 高二=提高</div>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px;">
            <label style="font-weight:600;">选择课文（点击切换）</label>
            <span id="examSelCount" style="font-size:0.85rem;color:var(--text-light);">已选 0 篇</span>
          </div>
          <div style="flex:1;min-height:0;display:flex;flex-direction:column;background:var(--bg);border:1px solid #ddd;border-radius:8px;padding:10px;">
            <div id="examText" class="text-chip-scroll" style="flex:1;min-height:0;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(100px, 120px);grid-template-rows:repeat(auto-fill, minmax(38px, 1fr));gap:8px;overflow-x:auto;scroll-behavior:smooth;padding-bottom:6px;scrollbar-width:none;-ms-overflow-style:none;">
              ${chipHtml}
            </div>
            <div style="display:flex;justify-content:center;align-items:center;gap:16px;margin-top:8px;padding-top:8px;border-top:1px solid #eee;flex-shrink:0;">
              <button type="button" class="btn text-scroll-left" style="margin:0;padding:6px 16px;background:#fff;border:1px solid #ddd;border-radius:6px;color:var(--text);font-size:0.85rem;cursor:pointer;">← 左滑</button>
              <span style="font-size:0.8rem;color:var(--text-light);">左右滑动查看更多课文</span>
              <button type="button" class="btn text-scroll-right" style="margin:0;padding:6px 16px;background:#fff;border:1px solid #ddd;border-radius:6px;color:var(--text);font-size:0.85rem;cursor:pointer;">右滑 →</button>
            </div>
          </div>

          <div style="margin-top:8px;font-size:0.82rem;color:var(--text-light);line-height:1.4;">
            💡 系统将按右侧试卷结构跨篇混合出题；题目以详情富数据（全文/译文/难句解析/赏析/考点）为语料与答案骨架。
          </div>
        </div>

        <!-- 右列：试卷结构 -->
        <div style="background:var(--bg);border:1px solid rgba(0,0,0,0.08);border-radius:10px;padding:14px;display:flex;flex-direction:column;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div style="font-weight:600;font-size:1rem;">📐 试卷结构</div>
            <div style="font-size:0.8rem;color:var(--text-light);">题型 × 数量 × 分值</div>
          </div>
          <div id="paperSections" style="flex:1 1 auto;">${sectionRows}</div>

          <div id="clozeModeRow" style="margin:10px 0;font-size:0.85rem;color:var(--text-light);background:#fff;border:1px dashed #ddd;border-radius:6px;padding:8px 10px;display:none;">
            ✍️ 默写模式：
            <label style="margin-right:12px;"><input type="radio" name="clozeMode" value="direct" checked /> 直接默写</label>
            <label><input type="radio" name="clozeMode" value="scenario" /> 理解性默写</label>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;flex-wrap:wrap;gap:10px;">
            <button type="button" class="btn btn-success" id="addSectionBtn" style="font-size:0.85rem;margin:0;">＋ 添加题型</button>
            <span style="font-size:0.95rem;color:var(--text);font-weight:500;">📊 全卷合计：<b id="paperTotalCount">${initCount}</b> 题 / <b id="paperTotalScore">${initScore}</b> 分</span>
          </div>

          <div style="margin-top:14px;">
            <button class="btn" id="genExamBtn" style="width:100%;margin-top:0;padding:10px 0;font-size:1rem;">🚀 智能组卷（生成混合套卷）</button>
          </div>
        </div>
      </div>

      <div id="examResult" style="display:none;background:var(--bg);padding:16px;border-radius:8px;min-height:100px;margin-top:18px;">
        配置试卷结构并选择课文，点击「智能组卷」生成真实试题
      </div>
      <div id="paperHistory" style="margin-top:18px;"></div>
    </div>
  `;
}

// ========== 题目生成引擎（支持多篇课文，单题型节） ==========
// 抽取：单一题型 × 总题量，跨所选篇目分配后生成扁平题数组
function generateSectionQuestions(textNames, type, totalCount, clozeMode) {
  const allQuestions = [];
  let errorMsgs = [];
  clozeMode = clozeMode || 'direct';

  if (!textNames || textNames.length === 0) {
    return [{ error: '请至少选择一篇课文' }];
  }

  const resolved = textNames.map(n => lookupText(n)).filter(Boolean);
  if (resolved.length === 0) {
    return [{ error: '未找到选中的课文数据' }];
  }

  const baseCount = Math.floor(totalCount / resolved.length);
  const extra = totalCount - baseCount * resolved.length;
  const counts = resolved.map((_, idx) => baseCount + (idx < extra ? 1 : 0));

  resolved.forEach((r, idx) => {
    const item = r.item;
    const display = r.display;
    const count = counts[idx];
    if (!item) return;

    let qs = [];
    if (type === '选择题') {
      qs = generateChoiceQuestions(item, display, count);
    } else if (type === '多选题') {
      qs = generateMultipleChoiceQuestions(item, display, count);
    } else if (type === '默写') {
      qs = generateClozeQuestions(item, display, count, clozeMode);
    } else if (type === '翻译') {
      qs = generateTranslationQuestions(item, display, count);
    } else if (type === '赏析') {
      qs = generateAppreciationQuestions(item, display, count);
    } else if (type === '主观题') {
      qs = generateSubjectiveQuestions(item, display, count);
    } else if (type === '现代文阅读') {
      qs = generateModernReadingQuestions(item, display, count);
    }
    const valid = qs.filter(q => q && !q.error);
    allQuestions.push(...valid);
    if (qs.some(q => q && q.error)) {
      errorMsgs.push(`${display}: ${qs.find(q => q.error).error}`);
    }
  });

  if (allQuestions.length === 0) {
    if (errorMsgs.length > 0) {
      return [{ error: errorMsgs.join('；') }];
    }
    return [{ error: '无法生成题目，请检查课文数据是否完整' }];
  }

  const shuffled = allQuestions.sort(() => Math.random() - 0.5);
  return shuffled;
}

// 兼容旧调用（单一题型）：返回扁平题数组
function generateQuestionsFromTexts(textNames, type, totalCount, clozeMode) {
  return generateSectionQuestions(textNames, type, totalCount, clozeMode);
}

// ========== P2：混合套卷（多题型 × 数量 × 分值） ==========
function generateMixedPaper(textNames, sections, clozeMode) {
  const paper = { meta: { totalScore: 0, totalCount: 0, generatedCount: 0 }, sections: [] };
  const allErrors = [];
  (sections || []).forEach((sec, si) => {
    const type = sec.type;
    const count = Math.max(0, parseInt(sec.count) || 0);
    const score = Math.max(0, parseInt(sec.score) || 0);
    if (!type || count <= 0) return;
    const qs = generateSectionQuestions(textNames, type, count, clozeMode);
    const valid = qs.filter(q => q && !q.error).map(q => { if (!q._uid) q._uid = genPaperId(); return q; });
    const errs = qs.filter(q => q && q.error);
    const generated = valid.length;
    const realScore = score * generated;
    paper.sections.push({
      type: type,
      score: score,
      requested: count,
      generated: generated,
      label: `第${cnNum(si + 1)}大题　${typeLabelOf(type)}（每小题${score}分，共${realScore}分）`,
      questions: valid
    });
    if (errs.length) allErrors.push(`${typeLabelOf(type)}：${errs[0].error}`);
    paper.meta.totalScore += realScore;
    paper.meta.totalCount += count;
    paper.meta.generatedCount += generated;
  });
  if (paper.meta.generatedCount === 0) {
    return { error: allErrors.length ? allErrors.join('；') : '未能生成任何题目，请检查所选篇目与题型配置' };
  }
  return paper;
}

// ---- 通用：组装一道单选题 ----
function buildSingleChoice(question, correctText, pool, explanation, name) {
  const distractors = [];
  pool.forEach(o => {
    if (o && o !== correctText && !distractors.includes(o)) distractors.push(o);
  });
  shuffle(distractors);
  const wrongs = distractors.slice(0, 3);
  if (wrongs.length < 1) return null;
  const opts = shuffle([correctText, ...wrongs]);
  const labels = ['A', 'B', 'C', 'D'];
  const ci = opts.indexOf(correctText);
  return {
    type: '选择题',
    question,
    options: opts,
    answer: labels[ci],
    correctText,
    explanation: explanation || `正确答案为 ${labels[ci]}：${correctText}。`,
    source: name
  };
}

// ---- 选择题（P1：真阅读化 + 同侪易混点干扰项） ----
function generateChoiceQuestions(item, name, count) {
  const questions = [];
  const peers = peersOf(item);
  const appr = item.appreciation || {};
  const hs = item.hardSentences || [];
  const isPoem = item.type === '古诗词';
  const isWenyan = item.type === '文言文';
  const corpus = corpusOf(item);
  const builders = [];

  // 模板1：主旨/内容理解（用 appreciation.theme 为真，同侪 theme 为假）
  if (appr.theme) {
    builders.push(() => {
      const correct = `《${name}》${appr.theme}`;
      const pool = peers.map(p => (p.appreciation && p.appreciation.theme) ? `《${name}》${p.appreciation.theme}` : null).filter(Boolean);
      return buildSingleChoice(`下列关于《${name}》的理解，正确的一项是（ ）`, correct, pool,
        `本题考查对《${name}》主旨与内容的把握。该作品${appr.theme}`, name);
    });
  }

  // 模板2：名句理解（用 hardSentences[].explanation 为真，他句/同侪句为假）
  hs.forEach(h => {
    if (h && h.sentence && h.explanation) {
      builders.push(() => {
        const correct = h.explanation;
        const pool = [];
        hs.forEach(o => { if (o !== h && o.explanation && !pool.includes(o.explanation)) pool.push(o.explanation); });
        peers.forEach(p => (p.hardSentences || []).forEach(o => { if (o.explanation && !pool.includes(o.explanation)) pool.push(o.explanation); }));
        return buildSingleChoice(`下列对《${name}》中“${h.sentence}”一句的理解，正确的一项是（ ）`, correct, pool,
          `本题考查对关键语句的细读。“${h.sentence}”意为：${h.explanation}`, name);
      });
    }
  });

  // 模板3：文言实词释义（用 notes 为真，他词为假）
  if (isWenyan && item.notes) {
    const words = Object.keys(item.notes);
    words.forEach(w => {
      builders.push(() => {
        const correct = `“${w}”：${item.notes[w]}`;
        const ctx = sentenceContaining(corpus, w);
        const pool = [];
        words.forEach(k => { if (k !== w) pool.push(`“${k}”：${item.notes[k]}`); });
        const q = buildSingleChoice(`下列句子中加点词的解释，正确的一项是（ ）`, correct, pool,
          `“${w}”在此处意为${item.notes[w]}。` + (ctx ? `例句：“${ctx}”。` : ''), name);
        if (q && ctx) q.note = `例句：${ctx}`;
        return q;
      });
    });
  }

  // 模板4：手法/艺术特色辨识（用 appreciation.features 为真，他作特色为假）
  const feats4 = asArr(appr.features);
  if (feats4.length) {
    feats4.forEach(f => {
      builders.push(() => {
        const correct = `《${name}》${f}`;
        const pool = [];
        peers.forEach(p => asArr(p.appreciation && p.appreciation.features).forEach(pf => { if (pf !== f && !pool.includes(`《${name}》${pf}`)) pool.push(`《${name}》${pf}`); }));
        return buildSingleChoice(`下列关于《${name}》艺术特色的理解，正确的一项是（ ）`, correct, pool,
          `《${name}》在艺术上${f}，是其显著特色。`, name);
      });
    });
  }

  // 模板5：意象/意境（诗词，用 hardSentences 中带意象标签者）
  if (isPoem) {
    const img = hs.find(h => h.tags && h.tags.some(t => /意象|意境|写景|炼字/.test(t))) || hs[0];
    if (img) {
      builders.push(() => {
        const correct = img.explanation;
        const pool = [];
        hs.forEach(o => { if (o !== img && o.explanation) pool.push(o.explanation); });
        peers.forEach(p => (p.hardSentences || []).forEach(o => { if (o.explanation && !pool.includes(o.explanation)) pool.push(o.explanation); }));
        return buildSingleChoice(`《${name}》中“${img.sentence}”营造了怎样的意境？下列理解正确的一项是（ ）`, correct, pool,
          `“${img.sentence}”${img.explanation}`, name);
      });
    }
  }

  // 模板6：作者（同年级/同单元易混点，而非随机作者）
  if (item.author) {
    builders.push(() => {
      const correct = item.author;
      const pool = [];
      peers.forEach(p => { if (p.author && p.author !== correct && !pool.includes(p.author)) pool.push(p.author); });
      return buildSingleChoice(`《${name}》的作者是（ ）`, correct, pool, `《${name}》的作者是${correct}。`, name);
    });
  }

  // 模板7：朝代（同侪朝代，去重）
  if (item.dynasty) {
    builders.push(() => {
      const correct = item.dynasty;
      const pool = [];
      peers.forEach(p => { if (p.dynasty && p.dynasty !== correct && !pool.includes(p.dynasty)) pool.push(p.dynasty); });
      if (pool.length < 1) pool.push('先秦', '唐代', '宋代', '现代');
      return buildSingleChoice(`《${name}》创作于哪个时期？（ ）`, correct, pool, `《${name}》创作于${correct}。`, name);
    });
  }

  // 模板8：文体（大类，避免散文/小说与文言文/诗歌混列）
  if (item.type) {
    const typeLabel = { '课文': '现代文/散文小说', '文言文': '文言文', '古诗词': '诗歌' }[item.type] || item.type;
    const wrongSet = { '课文': ['文言文', '诗歌'], '文言文': ['现代文/散文小说', '诗歌'], '古诗词': ['文言文', '现代文/散文小说'] }[item.type] || ['文言文', '诗歌', '现代文/散文小说'];
    builders.push(() => {
      const correct = typeLabel;
      const pool = wrongSet.filter(t => t !== correct);
      return buildSingleChoice(`《${name}》从文学体裁上看属于（ ）`, correct, pool, `《${name}》属于${correct}。`, name);
    });
  }

  if (builders.length === 0) {
    return [{ error: '该篇目数据不足，无法生成选择题' }];
  }

  const used = [];
  const shuffledBuilders = shuffle(builders);
  for (let i = 0; i < shuffledBuilders.length && questions.length < count; i++) {
    const q = shuffledBuilders[i]();
    if (q && !questions.some(x => x.question === q.question && x.correctText === q.correctText)) {
      questions.push(q);
      used.push(i);
    }
  }
  // 若数量不足，放宽去重再补
  for (let i = 0; i < shuffledBuilders.length && questions.length < count; i++) {
    if (used.includes(i)) continue;
    const q = shuffledBuilders[i]();
    if (q) questions.push(q);
  }

  if (questions.length === 0) {
    return [{ error: '该篇目无法生成选择题' }];
  }
  return questions.slice(0, count);
}

// ---- 多选题（P1 新增：答案为多选项） ----
function generateMultipleChoiceQuestions(item, name, count) {
  const questions = [];
  const peers = peersOf(item);
  const appr = item.appreciation || {};
  const hs = item.hardSentences || [];
  const builders = [];

  // 手法多选：2 正确（本作特色）+ 2 错误（他作特色）
  const mFeats = asArr(appr.features);
  if (mFeats.length >= 2) {
    builders.push(() => {
      const feats = shuffle(mFeats.slice());
      const correct2 = feats.slice(0, 2);
      const wrongPool = [];
      peers.forEach(p => asArr(p.appreciation && p.appreciation.features).forEach(f => {
        if (!correct2.includes(f) && !wrongPool.includes(f)) wrongPool.push(f);
      }));
      const wrongs = pickN(wrongPool, 2);
      if (wrongs.length < 2) return null;
      const opts = shuffle(correct2.concat(wrongs));
      const labels = ['A', 'B', 'C', 'D'];
      const ans = correct2.map(c => labels[opts.indexOf(c)]).sort();
      return {
        type: '多选题',
        question: `下列关于《${name}》艺术特色的说法，正确的有（多选）`,
        options: opts,
        answer: ans,
        correctText: correct2.join('；'),
        explanation: `正确项均出自《${name}》的艺术特色：${correct2.join('；')}。`,
        source: name
      };
    });
  }

  // 内容多选：2 正确（主旨 + 思路）+ 2 错误（他作主旨）
  if (appr.theme) {
    const trueStmts = [`《${name}》${appr.theme}`];
    if (appr.structure) trueStmts.push(`《${name}》行文思路为：${appr.structure}`);
    if (trueStmts.length >= 2) {
      builders.push(() => {
        const correct2 = trueStmts.slice(0, 2);
        const wrongPool = peers.map(p => (p.appreciation && p.appreciation.theme) ? `《${name}》${p.appreciation.theme}` : null).filter(Boolean);
        const wrongs = pickN(wrongPool, 2);
        if (wrongs.length < 2) return null;
        const opts = shuffle(correct2.concat(wrongs));
        const labels = ['A', 'B', 'C', 'D'];
        const ans = correct2.map(c => labels[opts.indexOf(c)]).sort();
        return {
          type: '多选题',
          question: `下列关于《${name}》内容的理解，正确的有（多选）`,
          options: opts,
          answer: ans,
          correctText: correct2.join('；'),
          explanation: `正确项准确概括了《${name}》的主旨与行文思路。`,
          source: name
        };
      });
    }
  }

  // 名句理解多选：2 正确（本作难句解析）+ 2 错误（他句/他作解析）
  if (hs.length >= 2) {
    builders.push(() => {
      const pick = pickN(hs, 2);
      const correct2 = pick.map(h => h.explanation);
      const pool = hs.filter(h => !pick.includes(h)).map(h => h.explanation);
      peers.forEach(p => (p.hardSentences || []).forEach(h => { if (h.explanation && !pool.includes(h.explanation)) pool.push(h.explanation); }));
      const wrongs = pickN(pool, 2);
      if (wrongs.length < 2) return null;
      const opts = shuffle(correct2.concat(wrongs));
      const labels = ['A', 'B', 'C', 'D'];
      const ans = correct2.map(c => labels[opts.indexOf(c)]).sort();
      return {
        type: '多选题',
        question: `下列关于《${name}》语句理解的说法，正确的有（多选）`,
        options: opts,
        answer: ans,
        correctText: correct2.join('；'),
        explanation: `正确项准确理解了《${name}》中的关键语句。`,
        source: name
      };
    });
  }

  if (builders.length === 0) return [{ error: '该篇目数据不足，无法生成多选题' }];

  const shuffledBuilders = shuffle(builders);
  for (let i = 0; i < shuffledBuilders.length && questions.length < count; i++) {
    const q = shuffledBuilders[i]();
    if (q) questions.push(q);
  }
  if (questions.length === 0) return [{ error: '该篇目无法生成多选题（可改用单选题型）' }];
  return questions.slice(0, count);
}

// ---- 默写题（P1：双模式：直接默写 / 理解性默写） ----
function generateClozeQuestions(item, name, count, mode) {
  if (mode === 'scenario') return generateScenarioCloze(item, name, count);

  // ===== 直接默写（上下句填空 / 句中挖空） =====
  const questions = [];
  const fullText = corpusOf(item);
  if (!fullText) return [{ error: '该篇目暂无正文数据，无法生成默写题' }];

  const segments = fullText.match(/[^，。；：！？]*[，。；：！？]?/g) || [];
  const validSegments = segments.filter(s => s.replace(/[，。；：！？\s]/g, '').length >= 2);
  if (validSegments.length < 3) return [{ error: '原文句子数量不足，无法生成默写题' }];

  const avgLength = validSegments.reduce((sum, s) => sum + s.length, 0) / validSegments.length;
  const isPoem = avgLength < 12 && validSegments.length > 4;

  const used = [];
  for (let i = 0; i < count && i < validSegments.length; i++) {
    const candidates = [];
    for (let j = 0; j < validSegments.length; j++) {
      if (!used.includes(j) && j !== 0 && j !== validSegments.length - 1) candidates.push(j);
    }
    if (candidates.length === 0) {
      for (let j = 0; j < validSegments.length; j++) if (!used.includes(j)) candidates.push(j);
    }
    if (candidates.length === 0) break;
    const targetIdx = candidates[Math.floor(Math.random() * candidates.length)];
    used.push(targetIdx);

    const curr = validSegments[targetIdx].trim();
    let prev = targetIdx > 0 ? validSegments[targetIdx - 1].trim() : '';
    let next = targetIdx < validSegments.length - 1 ? validSegments[targetIdx + 1].trim() : '';
    if (!prev && targetIdx + 1 < validSegments.length) { prev = validSegments[targetIdx + 1].trim(); next = targetIdx + 2 < validSegments.length ? validSegments[targetIdx + 2].trim() : ''; }
    if (!next && targetIdx - 1 >= 0) { next = validSegments[targetIdx - 1].trim(); prev = targetIdx - 2 >= 0 ? validSegments[targetIdx - 2].trim() : ''; }
    if (!curr) continue;

    let questionText = '', answerText = curr, hintText = '';
    if (isPoem) {
      if (prev && next) {
        const m = Math.floor(Math.random() * 3);
        if (m === 0) { questionText = `${prev}\n____\n${next}`; hintText = `提示：填“${curr}”`; }
        else if (m === 1) { questionText = `____\n${curr}`; hintText = `提示：填上一句（${prev}）`; answerText = prev || curr; }
        else { questionText = `${curr}\n____`; hintText = `提示：填下一句（${next}）`; answerText = next || curr; }
      } else if (prev) { questionText = `${prev}\n____`; hintText = `提示：填下一句`; answerText = curr; }
      else if (next) { questionText = `____\n${next}`; hintText = `提示：填上一句`; answerText = curr; }
      else {
        const words = curr.match(/[\u4e00-\u9fa5]{2,}/g) || [];
        if (words.length > 0) { const t = words[Math.floor(Math.random() * words.length)]; questionText = `${curr.replace(t, '____')}`; hintText = `提示：填“${t}”`; }
        else { questionText = `____`; hintText = `提示：填“${curr}”`; }
      }
    } else {
      const words = curr.match(/[\u4e00-\u9fa5]{2,}/g) || [];
      if (words.length >= 2) {
        const sh = shuffle(words);
        const pc = Math.min(1 + Math.floor(Math.random() * 2), sh.length);
        const picked = sh.slice(0, pc);
        let blank = curr;
        picked.forEach(w => { blank = blank.replace(w, '____'); });
        if (blank !== curr) { questionText = prev ? `${prev}\n${blank}\n${next || ''}` : `${blank}`; hintText = `提示：填“${picked.join('、')}”`; }
        else { questionText = prev ? `${prev}\n____\n${next || ''}` : `____`; hintText = `提示：填“${curr}”`; }
      } else if (words.length === 1) {
        const t = words[0]; questionText = prev ? `${prev}\n${curr.replace(t, '____')}\n${next || ''}` : `${curr.replace(t, '____')}`; hintText = `提示：填“${t}”`;
      } else {
        const chars = curr.replace(/[，。；：！？]/g, '').split('');
        if (chars.length > 2) { const idx = Math.floor(Math.random() * chars.length); const t = chars[idx]; questionText = prev ? `${prev}\n${curr.replace(t, '____')}\n${next || ''}` : `${curr.replace(t, '____')}`; hintText = `提示：填“${t}”字`; }
        else { questionText = prev ? `${prev}\n____\n${next || ''}` : `____`; hintText = `提示：填“${curr}”`; }
      }
    }
    const key = answerText;
    if (!questions.some(q => q.answer === key)) {
      questions.push({ type: '默写', question: `补写下列句子：\n${questionText}`, answer: answerText, source: name, hint: hintText });
    }
  }
  if (questions.length === 0) return [{ error: '无法生成默写题，请检查原文格式' }];
  return questions.slice(0, count);
}

// ---- 理解性默写（情境填句）：基于 examFocus.dictation + hardSentences 解析 ----
function generateScenarioCloze(item, name, count) {
  const dict = asArr(item.examFocus && item.examFocus.dictation, true);
  if (!dict.length) return [{ error: '该篇目暂无指定默写句，无法生成理解性默写（可改用“直接默写”）' }];
  const hs = item.hardSentences || [];
  const chosen = pickN(dict, count);
  const questions = [];
  chosen.forEach(line => {
    let scenario = '';
    const m = hs.find(h => h.sentence && line.indexOf(h.sentence.slice(0, 6)) !== -1);
    if (m && m.explanation) scenario = m.explanation;
    else if (item.appreciation && item.appreciation.theme) scenario = `在《${name}》中，${item.appreciation.theme}`;
    else scenario = `请结合对《${name}》内容的理解作答`;
    questions.push({
      type: '默写',
      mode: '理解性',
      source: name,
      question: `理解性默写（情境填句）：\n情境：${scenario}\n请写出《${name}》中对应的原句：`,
      answer: line,
      hint: '根据情境回忆原文'
    });
  });
  return questions;
}

// ---- 翻译题（P1：对齐译文 + 重点字词采分点） ----
function generateTranslationQuestions(item, name, count) {
  const questions = [];
  if (item.type === '课文') return [{ error: '现代文无需翻译题，请改用其他题型（如现代文阅读）' }];

  let pool = (item.hardSentences || []).filter(h => h && h.sentence && h.translation && h.translation.trim());
  if (pool.length === 0 && item.translation && item.translation.trim()) {
    const corpus = corpusOf(item);
    const src = corpus.split(/[。！？]/).map(s => s.trim()).filter(s => s.length > 4);
    const tgt = item.translation.split(/[。！？]/).map(s => s.trim()).filter(s => s.length > 2);
    src.forEach((s, i) => { const t = tgt[i] || ''; if (t) pool.push({ sentence: s, translation: t, tags: [] }); });
  }
  if (pool.length === 0) return [{ error: '该篇目暂无可供翻译的译文' }];

  // 按句长排序，优先取中段（更有翻译/采分价值），避免总取前 N
  const ranked = pool.slice().sort((a, b) => a.sentence.length - b.sentence.length);
  const lo = Math.floor(ranked.length * 0.2), hi = Math.floor(ranked.length * 0.8);
  const chooseFrom = (hi - lo >= count) ? ranked.slice(lo, hi) : ranked;
  const chosen = pickN(chooseFrom, count);

  const notes = item.notes || {};
  const wenyan = item.wenyan || {};
  chosen.forEach(h => {
    const points = [];
    const words = h.sentence.match(/[\u4e00-\u9fa5]{1,3}/g) || [];
    words.forEach(w => { if (notes[w]) points.push(`“${w}”：${notes[w]}`); });
    if (wenyan.keyWords) {
      wenyan.keyWords.forEach(kw => {
        const token = (kw.split('（')[0] || '').replace(/[，。]/g, '').trim();
        if (token && h.sentence.indexOf(token) !== -1) points.push(kw);
      });
    }
    if (h.tags && h.tags.length) points.push('考点：' + h.tags.join('、'));
    questions.push({
      type: '翻译',
      question: `请将下列句子译成现代汉语：\n${h.sentence}`,
      answer: h.translation,
      hint: points.length ? ('采分点：' + points.join('；')) : '注意关键词语与句式的准确翻译',
      source: name
    });
  });
  return questions;
}

// ---- 赏析题（P1：以 appreciation / hardSentences[].explanation 为骨架，去模板化） ----
function generateAppreciationQuestions(item, name, count) {
  const questions = [];
  const appr = item.appreciation || {};
  const hs = item.hardSentences || [];
  const isPoem = item.type === '古诗词';
  const isWenyan = item.type === '文言文';
  const builders = [];

  // 名句赏析：用 hardSentences 的 explanation（真实解析）
  hs.forEach(h => {
    if (h && h.sentence && h.explanation) {
      builders.push(() => ({
        type: '赏析', source: name,
        question: `请赏析《${name}》中的句子：\n“${h.sentence}”`,
        answer: `【赏析】${h.explanation}` + (appr.theme ? `\n结合全篇，《${name}》${appr.theme}` : ''),
        hint: `参考：${(h.tags && h.tags.join('、')) || '名句赏析'}`
      }));
    }
  });

  // 主旨/情感赏析
  if (appr.theme) {
    builders.push(() => ({
      type: '赏析', source: name,
      question: `《${name}》表达了作者怎样的思想情感（或主旨）？请结合内容简要分析。`,
      answer: `【主旨】${appr.theme}` + (appr.structure ? `\n【思路】${appr.structure}` : ''),
      hint: '思想情感/主旨分析'
    }));
  }

  // 艺术特色赏析
  const apprFeats = asArr(appr.features);
  if (apprFeats.length) {
    const feats = apprFeats;
    const fl = asArr(appr.famousLines);
    const line = (fl[0] && fl[0].length <= 30) ? fl[0] : (hs[0] && hs[0].sentence) || '';
    builders.push(() => ({
      type: '赏析', source: name,
      question: `《${name}》在艺术表现上有哪些特色？请结合具体内容简要赏析。`,
      answer: `【艺术特色】${feats.join('；')}。` + (line ? `\n例如：“${line}”即体现了上述特色。` : '') + (appr.structure ? `\n【结构】${appr.structure}` : ''),
      hint: '艺术特色赏析'
    }));
  }

  // 意象/意境（诗词）
  if (isPoem && hs.length) {
    const sample = hs.find(h => h.tags && h.tags.some(t => /意象|意境|写景|炼字/.test(t))) || hs[0];
    builders.push(() => ({
      type: '赏析', source: name,
      question: `《${name}》中“${sample.sentence}”营造了怎样的意境？请简要分析。`,
      answer: `【意境】${sample.explanation || ''}` + (appr.theme ? `\n全诗${appr.theme}` : ''),
      hint: '意象/意境分析'
    }));
  }

  // 人物形象（文言/小说）
  if ((isWenyan || item.type === '课文') && appr.theme) {
    builders.push(() => ({
      type: '赏析', source: name,
      question: `《${name}》塑造了怎样的人物形象？请结合内容分析。`,
      answer: `【形象】${appr.theme}` + (appr.structure ? `\n【情节/结构】${appr.structure}` : ''),
      hint: '人物形象分析'
    }));
  }

  if (builders.length === 0) return [{ error: '该篇目暂无可供赏析的详情数据' }];
  const chosen = pickN(shuffle(builders), count);
  chosen.forEach(b => { const q = b(); if (q) questions.push(q); });
  return questions;
}

// ---- 主观题（P1：要点式踩分，去模板化，答案基于真实语料） ----
function generateSubjectiveQuestions(item, name, count) {
  const questions = [];
  const appr = item.appreciation || {};
  const hs = item.hardSentences || [];
  const author = item.author || '作者';
  const dynasty = item.dynasty || '';
  const bio = buildAuthorInfo(author, dynasty);
  const builders = [];
  const firstLine = (hs[0] && hs[0].sentence) || corpusOf(item).slice(0, 20);
  const themeLine = appr.theme || `《${name}》思想深刻、意蕴丰富`;
  const structLine = appr.structure || '';
  const featLine = asArr(appr.features).join('、');

  // 知人论世
  if (author && dynasty) {
    builders.push(() => ({
      type: '主观题', source: name,
      question: `结合${author}的生平与${dynasty}的时代背景，谈谈《${name}》的创作动机与思想内涵。`,
      answer: `【参考答案（要点）】\n1. 作者简介：${bio}\n2. 时代背景：${dynasty}时期的社会文化环境深刻影响了作者的创作取向。\n3. 创作动机：从“${firstLine}”等语句可见，作者立足现实、有感而发。\n4. 思想内涵：${themeLine}` + (structLine ? `\n5. 行文思路：${structLine}` : ''),
      hint: `知人论世（${author}·${dynasty}）`
    }));
  }

  // 文本细读（用 hardSentences explanations 作要点）
  if (hs.length) {
    builders.push(() => {
      const pick = pickN(hs.slice(), Math.min(3, hs.length));
      const pts = pick.map((h, i) => `${i + 1}. “${h.sentence}”——${h.explanation || ''}`).join('\n');
      return {
        type: '主观题', source: name,
        question: `请结合《${name}》中的具体语句，深入解读其思想内容与艺术表达。`,
        answer: `【参考答案（要点）】\n${pts}` + (themeLine ? `\n综上，《${name}》${themeLine}` : ''),
        hint: '文本细读'
      };
    });
  }

  // 手法综合
  if (featLine && hs.length) {
    const fl = asArr(appr.famousLines);
    const line = (fl[0] && fl[0].length <= 30) ? fl[0] : hs[0].sentence;
    const hMatch = hs.find(h => h.sentence === line) || hs[0];
    builders.push(() => ({
      type: '主观题', source: name,
      question: `《${name}》运用了哪些艺术手法？请结合具体内容分析其表达效果。`,
      answer: `【参考答案（要点）】\n1. 主要手法：${featLine}。\n2. 具体分析：如“${line}”，${hMatch.explanation || ''}\n3. 表达效果：多种手法综合运用，使作品意蕴丰厚——${themeLine}`,
      hint: '手法综合分析'
    }));
  }

  // 情感脉络
  if (hs.length) {
    builders.push(() => {
      const a = hs[0], b = hs[hs.length - 1], mid = hs[Math.floor(hs.length / 2)];
      return {
        type: '主观题', source: name,
        question: `《${name}》的情感是如何发展变化的？请梳理其脉络。`,
        answer: `【参考答案（要点）】\n1. 起：${a ? a.explanation : '开篇奠定基调'}。\n2. 承转：${mid ? mid.explanation : '情感逐步推进'}。\n3. 合：${b ? b.explanation : '结尾情感收束升华'}。\n4. 整体：${themeLine}`,
        hint: '情感脉络'
      };
    });
  }

  // 现实意义
  builders.push(() => ({
    type: '主观题', source: name,
    question: `《${name}》的思想内涵在今天仍有启示意义，请结合文本谈谈你的理解。`,
    answer: `【参考答案（要点）】\n1. 核心思想：${themeLine}\n2. 当代价值：上述思想对今人认识社会与自我仍有借鉴意义。\n3. 个人启示：阅读经典可涵养精神、提升审美与思辨能力。`,
    hint: '现实意义'
  }));

  if (builders.length === 0) return [{ error: '该篇目无法生成主观题' }];
  const chosen = pickN(shuffle(builders), count);
  chosen.forEach(b => { const q = b(); if (q) questions.push(q); });
  return questions;
}

// ---- 现代文阅读题型（P1 新增，仅课文；基于 hardSentences + appreciation） ----
function generateModernReadingQuestions(item, name, count) {
  const questions = [];
  if (item.type !== '课文') return [{ error: '现代文阅读题型仅适用于现代文（课文）篇目' }];
  const appr = item.appreciation || {};
  const hs = item.hardSentences || [];
  if (hs.length === 0) return [{ error: '该现代文暂无难句解析，无法生成现代文阅读题' }];
  const builders = [];
  const themeLine = appr.theme || `《${name}》意蕴丰富`;

  // 词语含义（语境义，由难句解析推导）
  hs.forEach(h => {
    if (!h.sentence || !h.explanation) return;
    const words = h.sentence.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    const cand = words.find(w => h.explanation.indexOf(w) !== -1 && w.length >= 2) || words[0];
    if (cand) {
      builders.push(() => ({
        type: '现代文阅读', source: name,
        question: `解释《${name}》中“${cand}”一词在文中的含义（语境义）。\n语境：“${h.sentence}”`,
        answer: `【参考答案（要点）】\n1. 语境义：在“${h.sentence}”中，“${cand}”所承载的意思是——${h.explanation}。\n2. 表达效果：该词准确传达了作者的情感与态度，使表达更贴切传神。`,
        hint: '词语含义（语境）'
      }));
    }
  });

  // 句子作用
  hs.forEach(h => {
    if (!h.sentence || !h.explanation) return;
    builders.push(() => ({
      type: '现代文阅读', source: name,
      question: `《${name}》中“${h.sentence}”在文中有何作用？请从内容、结构、情感等方面分析。`,
      answer: `【参考答案（要点）】\n1. 内容：${h.explanation}\n2. 结构：照应/推动/铺垫（结合全文思路${appr.structure ? '：' + appr.structure : ''}）。\n3. 情感：强化《${name}》${themeLine}。`,
      hint: '句子作用'
    }));
  });

  // 语段赏析
  if (asArr(appr.features).length) {
    builders.push(() => {
      const h = hs[0];
      return {
        type: '现代文阅读', source: name,
        question: `请赏析《${name}》中“${h.sentence}”的表达艺术。`,
        answer: `【参考答案（要点）】\n1. 艺术特色：${asArr(appr.features).join('；')}。\n2. 具体分析：${h.explanation}\n3. 整体效果：服务于《${name}》${themeLine}。`,
        hint: '语段赏析'
      };
    });
  }

  // 开放探究
  builders.push(() => ({
    type: '现代文阅读', source: name,
    question: `《${name}》给你带来哪些启示？请结合文本，谈谈你的理解与思考。`,
    answer: `【参考答案（要点）】\n1. 文本内涵：${themeLine}\n2. 个性解读：结合自身经验，谈谈对其中人物、事件或观点的看法。\n3. 价值提升：经典阅读有助于我们认识社会、观照自我。`,
    hint: '开放探究'
  }));

  if (builders.length === 0) return [{ error: '该篇目无法生成现代文阅读题' }];
  const chosen = pickN(shuffle(builders), count);
  chosen.forEach(b => { const q = b(); if (q) questions.push(q); });
  return questions;
}

// ========== 显示题目 ==========
// 兼容：传入 paper 对象（{meta, sections}）按大题分节渲染；传入扁平数组则按旧样式渲染
function renderQuestions(paper) {
  if (paper && paper.error) {
    return `<div style="background:var(--c-danger-bg);padding:16px;border-radius:8px;color:var(--c-danger-text);">⚠️ 组卷失败：${paper.error}</div>`;
  }
  let sections, isPaper = false, totalScore = 0, meta = null;
  if (paper && Array.isArray(paper.sections)) {
    isPaper = true;
    sections = paper.sections;
    meta = paper.meta || {};
    totalScore = meta.totalScore || 0;
  } else if (Array.isArray(paper)) {
    sections = [{ type: '试题', score: 0, generated: paper.length, label: '试题', questions: paper.filter(q => q && !q.error) }];
  } else {
    return '<p class="empty">无题目生成</p>';
  }

  let html = '<div style="display:flex;flex-direction:column;gap:18px;">';
  if (isPaper && !paper.error) {
    html += `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:var(--card-bg);padding:12px 14px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <input id="paperNameInput" placeholder="试卷名称（如：高三一轮复习卷）" value="${escapeAttr(paper.name || '')}" style="flex:1;min-width:200px;padding:8px 12px;border-radius:6px;border:1px solid #ddd;background:var(--bg);color:var(--text);" />
      <button class="btn btn-success" id="savePaperBtn">💾 保存试卷</button>
      <button class="btn btn-secondary" id="clonePaperBtn">📋 另存副本</button>
      <button class="btn btn-warning" id="favToggleBtn">★ 收藏夹(${favSet.size})</button>
    </div>`;
  }
  if (isPaper) {
    let headExtra = '';
    if (meta.totalCount && meta.generatedCount < meta.totalCount) {
      headExtra = `<div style="text-align:center;color:var(--c-warning-text);font-size:0.82rem;margin-top:4px;">⚠️ 部分题型题量不足，已按实际可生成题量出题（实 ${meta.generatedCount} / 应 ${meta.totalCount}）</div>`;
    }
    html += `<div style="background:var(--card-bg);padding:14px 18px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <div style="font-size:1.1rem;font-weight:700;text-align:center;">📝 语文综合练习卷</div>
      <div style="text-align:center;color:var(--text-light);margin-top:4px;">全卷共 ${meta.generatedCount || 0} 题（应 ${meta.totalCount || 0} 题），满分 ${totalScore} 分</div>${headExtra}
    </div>`;
  }

  let index = 1;
  sections.forEach(sec => {
    const qlist = sec.questions || [];
    if (qlist.length === 0) {
      html += `<div style="background:var(--c-warning-bg);padding:10px 12px;border-radius:8px;color:var(--c-warning-text);">⚠️ ${sec.label}：本大题未生成题目（${sec.type === '现代文阅读' || sec.type === '翻译' ? '篇目类型不匹配或数据不足' : '请检查配置或所选篇目'}）。</div>`;
      return;
    }
    let titleExtra = sec.label;
    if (sec.requested && sec.generated < sec.requested) {
      titleExtra += `　<span style="color:var(--c-warning-text);font-size:0.85rem;font-weight:400;">（实出 ${sec.generated} / 应 ${sec.requested} 题）</span>`;
    }
    html += `<div style="background:var(--card-bg);padding:14px 16px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">`;
    html += `<div style="font-weight:700;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #eee;">${titleExtra}</div>`;
    qlist.forEach(q => {
      if (q.error) {
        html += `<div style="background:var(--c-danger-bg);padding:12px;border-radius:8px;color:var(--c-danger-text);margin-bottom:14px;">⚠️ ${q.error}</div>`;
        return;
      }
      html += `<div style="margin-bottom:14px;">`;
      html += `<div style="display:flex;justify-content:space-between;margin-bottom:6px;">`;
      html += `<span style="font-weight:600;">${index}. ${q.type}${q.mode === '理解性' ? '（理解性）' : ''}</span>`;
      if (q.source) html += `<span style="color:var(--text-light);font-size:0.8rem;">📖 ${q.source}</span>`;
      html += `</div>`;
      html += `<div style="white-space:pre-wrap;margin-bottom:6px;">${q.question}</div>`;
      if (q.note) html += `<div style="color:var(--text-light);font-size:0.82rem;margin-bottom:6px;">📝 ${q.note}</div>`;
      if (q.options) {
        const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0;">`;
        q.options.forEach((opt, idx) => {
          html += `<div style="padding:4px 8px;background:var(--bg);border-radius:4px;">${labels[idx]}. ${opt}</div>`;
        });
        html += `</div>`;
        if (Array.isArray(q.answer)) {
          html += `<div style="color:var(--c-success);font-weight:500;">✅ 正确答案：${q.answer.join('、')}${q.correctText ? '（' + q.correctText + '）' : ''}</div>`;
        } else {
          html += `<div style="color:var(--c-success);font-weight:500;">✅ 正确答案：${q.answer}（${q.correctText}）</div>`;
        }
      } else if (q.answer) {
        html += `<div style="color:var(--c-success);font-weight:500;">✅ 参考答案：${q.answer}</div>`;
        if (q.hint) html += `<div style="color:var(--text-light);font-size:0.85rem;">💡 提示：${q.hint}</div>`;
      }
      if (isPaper && q._uid) {
        const isF = favSet.has(q._uid);
        html += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
          <button class="da-link-danger q-del" data-uid="${q._uid}">🗑 删除</button>
          <button class="da-link q-up" data-uid="${q._uid}">↑ 上移</button>
          <button class="da-link q-down" data-uid="${q._uid}">↓ 下移</button>
          <button class="da-link q-replace" data-uid="${q._uid}">🔄 替换</button>
          <button class="btn q-fav ${isF ? 'active' : ''}" data-uid="${q._uid}" style="margin:0;padding:3px 10px;font-size:0.78rem;background:${isF ? '#fcf3cf' : '#fff'};color:${isF ? 'var(--c-warning-text)' : 'var(--text-light)'};border:1px solid ${isF ? '#f0d98c' : '#ddd'};border-radius:6px;cursor:pointer;">${isF ? '★ 已收藏' : '☆ 收藏'}</button>
        </div>`;
      }
      html += `</div>`;
      index++;
    });
    html += `</div>`;
  });
  html += '</div>';

  html += `
    <div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap;">
      <button class="btn btn-info" id="exportStudentBtn">📄 导出学生卷（Word）</button>
      <button class="btn btn-info" id="exportAnswerBtn">📄 导出答案卷（Word）</button>
      <button class="btn btn-secondary" id="exportJsonBtn">📥 导出JSON（含答案）</button>
    </div>
    <div id="favPanel" style="display:none;margin-top:14px;"></div>
  `;
  return html;
}

// 试卷结构摘要（用于导出文件名，如 选10默6赏2）
function paperSummary(paper) {
  if (!paper || !Array.isArray(paper.sections)) return '';
  const abbr = { '选择题': '选', '多选题': '多', '默写': '默', '翻译': '译', '赏析': '赏', '主观题': '主', '现代文阅读': '阅' };
  return paper.sections.map(s => (abbr[s.type] || s.type) + (s.requested != null ? s.requested : (s.generated || 0))).join('');
}

// ========== 导出Word ==========
// 纯函数：构建 Word(HTML) 文档字符串，mode = 'full' | 'student' | 'answer'
function buildWordHtml(paper, opts) {
  opts = opts || {};
  const mode = opts.mode || 'full';
  const title = opts.title || '语文综合练习卷';
  let sections, meta = null;
  if (paper && Array.isArray(paper.sections)) {
    sections = paper.sections;
    meta = paper.meta || null;
  } else if (Array.isArray(paper)) {
    sections = [{ type: '试题', score: 0, generated: paper.length, label: '试题', questions: paper.filter(q => q && !q.error) }];
  } else {
    return '';
  }

  let html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${title}</title>
    <style>
      body { font-family: '宋体', SimSun; font-size: 14pt; line-height: 1.8; padding: 40px; }
      h1 { text-align: center; font-size: 22pt; margin-bottom: 8px; }
      .sub { text-align: center; margin-bottom: 16px; color: #444; }
      .fields { display: flex; justify-content: space-between; margin: 0 40px 12px; font-size: 12pt; }
      h2 { font-size: 16pt; margin-top: 18px; border-left: 6px solid #2b5797; padding-left: 8px; }
      .question { margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px dashed #ccc; }
      .q-title { font-weight: bold; }
      .options { margin-left: 20px; margin-top: 4px; }
      .answer { color: #2b5797; margin-top: 6px; padding: 4px 10px; background: #f0f4f8; border-radius: 4px; }
      .source { color: #888; font-size: 12pt; float: right; }
      .seal { text-align: center; color: #999; font-size: 11pt; margin: 24px 0; border-top: 1px dashed #aaa; padding-top: 6px; letter-spacing: 2px; }
    </style>
    </head>
    <body>
  `;

  if (mode === 'student') {
    // 学生卷：含学校/班级/姓名/学号栏 + 密封线，不含任何答案与提示
    html += `<h1>${title}</h1>`;
    html += `<div class="fields"><span>学校：____________</span><span>班级：____________</span><span>姓名：____________</span><span>学号：____________</span></div>`;
    html += `<div class="seal">— 密 封 线 内 不 要 答 题 —</div>`;
  } else if (mode === 'answer') {
    // 答案卷：仅题号 + 答案（含选项标注），供教师阅卷
    html += `<h1>参考答案</h1>`;
    html += `<div class="sub">（本卷为答案卷，仅供教师阅卷参考）</div>`;
  } else {
    html += `<h1>📝 ${title}</h1>`;
    if (meta) html += `<div class="sub">全卷共 ${meta.generatedCount} 题（应 ${meta.totalCount} 题）　满分 ${meta.totalScore} 分</div>`;
  }

  let index = 1;
  const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
  sections.forEach(sec => {
    const qlist = sec.questions || [];
    if (qlist.length === 0) return;
    if (mode !== 'answer') html += `<h2>${sec.label}</h2>`;
    qlist.forEach(q => {
      if (q.error) return;
      if (mode === 'answer') {
        let ansText = Array.isArray(q.answer) ? q.answer.join('、') : (q.answer || '').replace(/\n/g, '；');
        const optMark = (q.options && Array.isArray(q.answer))
          ? `（选项：${q.options.map((o, i) => labels[i] + '. ' + o).join('；')}）` : '';
        html += `<div class="question" style="border-bottom:1px solid #eee;">
          <div class="q-title">${index}. 【${q.type}${q.mode === '理解性' ? '·理解性' : ''}】${q.source ? '（《' + q.source + '》）' : ''}</div>
          <div class="answer">答案：${ansText}${optMark}</div>
        </div>`;
        index++;
        return;
      }
      // student / full
      html += `<div class="question">`;
      html += `<div class="q-title">${index}. ${q.type}${q.mode === '理解性' ? '（理解性默写）' : ''}</div>`;
      if (q.source && mode === 'full') html += `<span class="source">（${q.source}）</span>`;
      html += `<div style="margin-top:4px;">${q.question.replace(/\n/g, '<br>')}</div>`;
      if (q.note && mode === 'full') html += `<div style="color:#555;font-size:12pt;">${q.note.replace(/\n/g, '<br>')}</div>`;
      if (q.options) {
        html += `<div class="options">`;
        q.options.forEach((opt, i) => { html += `<div>${labels[i]}. ${opt}</div>`; });
        html += `</div>`;
        if (mode === 'full') {
          if (Array.isArray(q.answer)) {
            html += `<div class="answer">✅ 正确答案：${q.answer.join('、')}${q.correctText ? '（' + q.correctText + '）' : ''}</div>`;
          } else {
            html += `<div class="answer">✅ 正确答案：${q.answer}（${q.correctText}）</div>`;
          }
        }
      } else if (q.answer && mode === 'full') {
        html += `<div class="answer">✅ 参考答案：${q.answer.replace(/\n/g, '<br>')}</div>`;
      }
      html += `</div>`;
      index++;
    });
  });

  html += `</body></html>`;
  return html;
}

// 下载包装：根据 mode 生成 学生卷 / 答案卷 / 含答案试卷
function exportToWord(paper, opts) {
  if (!paper || (paper && paper.error) || (Array.isArray(paper) && paper.length === 0)) {
    alert('没有题目可导出');
    return;
  }
  const html = buildWordHtml(paper, opts);
  if (!html) { alert('没有题目可导出'); return; }
  const mode = (opts && opts.mode) || 'full';
  const suffix = mode === 'student' ? '学生卷' : (mode === 'answer' ? '答案卷' : '试卷');
  const sum = paperSummary(paper);
  const nameBase = `语文${suffix}` + (sum ? '_' + sum : '');
  const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${nameBase}_${new Date().toISOString().slice(0, 10)}.doc`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ========== 导出JSON ==========
function exportToJson(paper) {
  let sections, meta = null;
  if (paper && Array.isArray(paper.sections)) {
    sections = paper.sections;
    meta = paper.meta || null;
  } else if (Array.isArray(paper)) {
    sections = [{ type: '试题', score: 0, generated: paper.length, label: '试题', questions: paper.filter(q => q && !q.error) }];
  } else {
    alert('没有题目可导出');
    return;
  }
  const data = {
    meta: meta || {
      totalScore: 0,
      totalCount: sections.reduce((s, x) => s + (x.generated || 0), 0),
      generatedCount: sections.reduce((s, x) => s + (x.generated || 0), 0)
    },
    sections: sections.map(sec => ({
      type: sec.type,
      score: sec.score || 0,
      requested: sec.requested != null ? sec.requested : (sec.generated || 0),
      generated: sec.generated || 0,
      title: sec.label,
      questions: (sec.questions || []).map(q => ({
        type: q.type,
        mode: q.mode || null,
        question: q.question,
        answer: q.answer,
        correctText: q.correctText || null,
        options: q.options || null,
        source: q.source || null,
        hint: q.hint || null,
        note: q.note || null
      }))
    }))
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const sum = paperSummary(paper);
  link.download = `试卷数据${sum ? '_' + sum : ''}_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ========== 初始化 ==========
function initExam() {
  const textSel = document.getElementById('examText');
  const gradeFilter = document.getElementById('examGradeFilter');
  const unitFilter = document.getElementById('examUnitFilter');
  const diffFilter = document.getElementById('examDiffFilter');
  const sectionsBox = document.getElementById('paperSections');
  const totalCountEl = document.getElementById('paperTotalCount');
  const totalScoreEl = document.getElementById('paperTotalScore');
  const resultDiv = document.getElementById('examResult');

  // 收藏态初始化
  favSet = new Set(getFavs().map(x => x.id));

  // —— 筛选器：根据年级/单元/难度收窄课文列表 ——
  function applyTextFilter() {
    if (!textSel) return;
    const g = gradeFilter ? gradeFilter.value : '全部';
    const u = unitFilter ? unitFilter.value : '全部';
    const d = diffFilter ? diffFilter.value : '全部';
    const all = getAllTextNames();
    const selected = new Set(Array.from(textSel.querySelectorAll('.text-chip.selected')).map(btn => btn.dataset.value));
    const kept = [];
    all.forEach(name => {
      const item = lookupText(name);
      const it = item ? item.item : null;
      const grade = it ? it.grade : '';
      const unit = it ? it.unit : '';
      const diff = difficultyOf(grade);
      if (g !== '全部' && grade !== g) return;
      if (u !== '全部' && unit !== u) return;
      if (d !== '全部' && diff !== d) return;
      kept.push(name);
    });
    textSel.innerHTML = kept.map(k => {
      const isSel = selected.has(k);
      return `<button type="button" class="text-chip${isSel ? ' selected' : ''}" data-value="${k}" style="min-width:0;padding:8px 12px;border:1px solid ${isSel ? 'var(--primary)' : '#e0e0e0'};border-radius:6px;background:${isSel ? 'var(--primary)' : '#fff'};color:${isSel ? '#fff' : 'var(--text)'};font-size:0.85rem;cursor:pointer;text-align:center;transition:all .15s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${k}</button>`;
    }).join('');
    updateSelCount();
  }
  function updateSelCount() {
    const el = document.getElementById('examSelCount');
    if (el && textSel) {
      const n = textSel.querySelectorAll('.text-chip.selected').length;
      el.textContent = '已选 ' + n + ' 篇';
    }
  }
  // 年级与难度联动（难度按年级派生，二选一即可，避免组合后课文列表为空）
  function syncGradeDiff(src) {
    if (src === gradeFilter && gradeFilter) {
      const g = gradeFilter.value;
      if (diffFilter) diffFilter.value = (g === '全部') ? '全部' : (difficultyOf(g) || '全部');
    } else if (src === diffFilter && diffFilter) {
      const d = diffFilter.value;
      if (gradeFilter) {
        const grades = getTextMeta().grades;
        gradeFilter.value = (d === '全部') ? '全部' : (grades.find(g => difficultyOf(g) === d) || '全部');
      }
    }
  }
  if (gradeFilter) gradeFilter.addEventListener('change', function () { syncGradeDiff(gradeFilter); applyTextFilter(); });
  if (unitFilter) unitFilter.addEventListener('change', applyTextFilter);
  if (diffFilter) diffFilter.addEventListener('change', function () { syncGradeDiff(diffFilter); applyTextFilter(); });
  if (textSel) {
    textSel.addEventListener('click', function (e) {
      const chip = e.target.closest('.text-chip');
      if (!chip) return;
      chip.classList.toggle('selected');
      const isSel = chip.classList.contains('selected');
      chip.style.background = isSel ? 'var(--primary)' : '#fff';
      chip.style.color = isSel ? '#fff' : 'var(--text)';
      chip.style.borderColor = isSel ? 'var(--primary)' : '#e0e0e0';
      updateSelCount();
    });
    // 课文列表左右滑动按钮
    const scrollWrap = textSel.parentElement;
    if (scrollWrap) {
      scrollWrap.addEventListener('click', function (e) {
        if (e.target.closest('.text-scroll-left')) {
          textSel.scrollBy({ left: -200, behavior: 'smooth' });
        } else if (e.target.closest('.text-scroll-right')) {
          textSel.scrollBy({ left: 200, behavior: 'smooth' });
        }
      });
    }
  }

  // —— 试卷结构：增删行 + 实时合计 + 默写模式联动 ——
  function recalcTotal() {
    if (!sectionsBox) return;
    let c = 0, s = 0;
    sectionsBox.querySelectorAll('.paper-section-row').forEach(row => {
      const cnt = parseInt(row.querySelector('.secCount').value) || 0;
      const sc = parseInt(row.querySelector('.secScore').value) || 0;
      c += cnt; s += cnt * sc;
    });
    if (totalCountEl) totalCountEl.textContent = c;
    if (totalScoreEl) totalScoreEl.textContent = s;
  }
  function syncClozeVisibility() {
    if (!sectionsBox) return;
    const hasCloze = Array.from(sectionsBox.querySelectorAll('.secType')).some(s => s.value === '默写');
    const row = document.getElementById('clozeModeRow');
    if (row) row.style.display = hasCloze ? 'block' : 'none';
  }
  if (sectionsBox) {
    sectionsBox.addEventListener('input', function (e) {
      if (e.target.classList.contains('secCount') || e.target.classList.contains('secScore')) recalcTotal();
      if (e.target.classList.contains('secType')) syncClozeVisibility();
    });
    sectionsBox.addEventListener('click', function (e) {
      const delBtn = e.target.closest('.secDel');
      if (delBtn) {
        const row = delBtn.closest('.paper-section-row');
        if (row && sectionsBox.querySelectorAll('.paper-section-row').length > 1) {
          row.remove(); recalcTotal(); syncClozeVisibility();
        }
      }
    });
  }
  const addBtn = document.getElementById('addSectionBtn');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      if (!sectionsBox) return;
      const idx = sectionsBox.querySelectorAll('.paper-section-row').length;
      sectionsBox.insertAdjacentHTML('beforeend', sectionRowHtml(idx, '选择题', 5, 3));
      recalcTotal(); syncClozeVisibility();
    });
  }
  recalcTotal(); syncClozeVisibility(); applyTextFilter();

  // —— 结果区事件委托（导出 / 保存 / 微调 / 收藏 / 历史 全部在此统一处理） ——
  function afterTune() { if (resultDiv) resultDiv.innerHTML = renderQuestions(currentPaper); }
  function doSave(asCopy) {
    if (!currentPaper || currentPaper.error) { alert('当前没有可保存的试卷'); return; }
    const nameInput = document.getElementById('paperNameInput');
    const name = (nameInput && nameInput.value.trim()) || currentPaper.name || ('未命名试卷_' + new Date().toLocaleDateString('zh-CN'));
    const rec = savePaperToStore(currentPaper, name, asCopy);
    currentPaper._id = rec._id; currentPaper.name = rec.name;
    renderHistoryInto(document.getElementById('paperHistory'));
    showToast(asCopy ? '已另存副本：' + rec.name : '已保存：' + rec.name);
  }
  function toggleFavPanel() {
    const p = document.getElementById('favPanel');
    if (!p) return;
    if (p.style.display === 'block') { p.style.display = 'none'; return; }
    renderFavPanelInto(p);
    p.style.display = 'block';
  }
  // 确保存在可插入的当前试卷（必要时建空卷并展示）
  function ensureCurrentPaper() {
    if (!currentPaper || !Array.isArray(currentPaper.sections)) {
      currentPaper = { meta: {}, sections: [] };
      if (resultDiv) { resultDiv.style.display = 'block'; resultDiv.innerHTML = renderQuestions(currentPaper); }
    }
    return currentPaper;
  }
  if (resultDiv) {
    resultDiv.addEventListener('click', function (e) {
      const t = e.target.closest('button');
      if (!t) return;
      const id = t.id;
      if (id === 'exportStudentBtn') { exportToWord(currentPaper, { mode: 'student' }); return; }
      if (id === 'exportAnswerBtn') { exportToWord(currentPaper, { mode: 'answer' }); return; }
      if (id === 'exportJsonBtn') { exportToJson(currentPaper); return; }
      if (id === 'savePaperBtn') { doSave(false); return; }
      if (id === 'clonePaperBtn') { doSave(true); return; }
      if (id === 'favToggleBtn') { toggleFavPanel(); return; }
      if (t.classList.contains('q-del')) { if (deleteQuestionInPaper(currentPaper, t.dataset.uid)) afterTune(); return; }
      if (t.classList.contains('q-up')) { if (moveQuestionInPaper(currentPaper, t.dataset.uid, -1)) afterTune(); return; }
      if (t.classList.contains('q-down')) { if (moveQuestionInPaper(currentPaper, t.dataset.uid, 1)) afterTune(); return; }
      if (t.classList.contains('q-replace')) { if (!replaceQuestionInPaper(currentPaper, t.dataset.uid)) alert('没有可替换的新题，请重新组卷后再试'); else afterTune(); return; }
      if (t.classList.contains('q-fav')) { toggleFav(t.dataset.uid); afterTune(); return; }
      if (t.classList.contains('hist-load')) { loadSavedPaper(t.dataset.id); return; }
      if (t.classList.contains('hist-word')) { const r1 = getPaperStore().find(r => r._id === t.dataset.id); if (r1) exportToWord(r1, { mode: 'student' }); return; }
      if (t.classList.contains('hist-json')) { const r2 = getPaperStore().find(r => r._id === t.dataset.id); if (r2) exportToJson(r2); return; }
      if (t.classList.contains('hist-del')) { deleteSavedPaper(t.dataset.id); return; }
      if (t.classList.contains('fav-insert')) { const ppr = ensureCurrentPaper(); if (insertFavIntoPaper(ppr, t.dataset.id)) { afterTune(); showToast('已插入当前试卷'); } return; }
      if (t.classList.contains('fav-insert-all')) { const all = getFavs(); if (!all.length) return; const ppr2 = ensureCurrentPaper(); all.forEach(f => insertFavIntoPaper(ppr2, f.id)); afterTune(); showToast('已插入全部收藏（' + all.length + ' 题）'); return; }
      if (t.classList.contains('fav-clear')) { setFavs([]); renderFavPanelInto(document.getElementById('favPanel')); afterTune(); showToast('已清空收藏夹'); return; }
      if (t.classList.contains('fav-remove')) { const fa = getFavs().filter(x => x.id !== t.dataset.id); setFavs(fa); renderFavPanelInto(document.getElementById('favPanel')); afterTune(); return; }
    });
  }
  // 初始渲染历史面板
  renderHistoryInto(document.getElementById('paperHistory'));

  // —— 组卷 ——
  const genBtn = document.getElementById('genExamBtn');
  if (!genBtn) return;
  genBtn.addEventListener('click', function () {
    const selectedTexts = Array.from(textSel.querySelectorAll('.text-chip.selected')).map(btn => btn.dataset.value);
    const sections = [];
    if (sectionsBox) {
      sectionsBox.querySelectorAll('.paper-section-row').forEach(row => {
        sections.push({
          type: row.querySelector('.secType').value,
          count: parseInt(row.querySelector('.secCount').value) || 0,
          score: parseInt(row.querySelector('.secScore').value) || 0
        });
      });
    }
    const clozeModeEl = document.querySelector('input[name="clozeMode"]:checked');
    const clozeMode = clozeModeEl ? clozeModeEl.value : 'direct';

    if (selectedTexts.length === 0) { alert('请至少选择一篇课文（点击左侧课文按钮）'); return; }
    if (sections.length === 0 || sections.every(s => (s.count || 0) <= 0)) { alert('请至少配置一个大题并设定题量'); return; }

    if (resultDiv) resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<p style="color:var(--text-light);padding:20px;">⏳ 正在加载课文详情（全文/译文/难句）…</p>';

    // P0：先按需加载选中课文的详情分片（富数据），合并进 SAMPLE_TEXTS 后再组卷
    const loader = (window.loadTextDetail
      ? Promise.all(selectedTexts.map(t => window.loadTextDetail(t)))
      : Promise.resolve(null));

    loader.then(function () {
      const paper = generateMixedPaper(selectedTexts, sections, clozeMode);
      currentPaper = paper;
      currentPaper._srcTexts = selectedTexts;
      currentPaper._clozeMode = clozeMode;
      ensurePaperUids(currentPaper);
      resultDiv.innerHTML = renderQuestions(currentPaper);
    }).catch(function (err) {
      console.error('[exam] 加载详情失败：', err);
      resultDiv.innerHTML = '<p style="color:var(--c-danger);padding:20px;">⚠️ 加载课文详情失败，请重试。' + (err && err.message ? err.message : '') + '</p>';
    });
  });
}

// ========== 暴露到全局 ==========
window.renderExam = renderExam;
window.initExam = initExam;
